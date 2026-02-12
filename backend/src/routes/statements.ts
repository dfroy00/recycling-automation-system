// backend/src/routes/statements.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { generateMonthlyStatements, generateCustomerStatement, generateTripStatement } from '../services/statement.service'
import { sendStatementEmail } from '../services/notification.service'
import { parsePagination, paginationResponse } from '../middleware/pagination'

const router = Router()

// GET /api/statements（支援分頁）
router.get('/', async (req: Request, res: Response) => {
  const { yearMonth, status, customerId } = req.query
  const where: any = {}
  if (yearMonth) where.yearMonth = yearMonth as string
  if (status) where.status = status as string
  if (customerId) where.customerId = Number(customerId)

  const { page, pageSize, skip, all } = parsePagination(req)
  const include = { customer: { select: { id: true, name: true } } }

  if (all) {
    const statements = await prisma.statement.findMany({
      where, include, orderBy: { id: 'desc' },
    })
    res.json(statements)
    return
  }

  const [statements, total] = await Promise.all([
    prisma.statement.findMany({
      where, include, orderBy: { id: 'desc' }, skip, take: pageSize,
    }),
    prisma.statement.count({ where }),
  ])
  res.json(paginationResponse(statements, total, page, pageSize))
})

// GET /api/statements/:id
router.get('/:id', async (req: Request, res: Response) => {
  const statement = await prisma.statement.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: { select: { id: true, name: true } },
      trip: { select: { id: true, tripDate: true } },
    },
  })
  if (!statement) {
    res.status(404).json({ error: '明細不存在' })
    return
  }
  res.json(statement)
})

// POST /api/statements/generate
router.post('/generate', async (req: Request, res: Response) => {
  const { yearMonth, customerId } = req.body

  if (!yearMonth) {
    res.status(400).json({ error: '請提供結算月份 (yearMonth)' })
    return
  }

  try {
    if (customerId) {
      // 指定單一客戶：同步回傳
      const statement = await generateCustomerStatement(customerId, yearMonth)
      res.status(201).json(statement)
    } else {
      // 批次產出：非同步處理，立即回傳 202
      res.status(202).json({ message: '月結明細正在產出中，請稍後查詢結果' })

      // 背景執行
      generateMonthlyStatements(yearMonth)
        .then(async (result) => {
          await prisma.systemLog.create({
            data: {
              eventType: 'monthly_statement_generate',
              eventContent: `月結明細產出完成：新增 ${result.created}，跳過 ${result.skipped}，失敗 ${result.errors.length}`,
            },
          })
        })
        .catch(async (e: any) => {
          await prisma.systemLog.create({
            data: {
              eventType: 'monthly_statement_generate_error',
              eventContent: `月結明細批次產出失敗：${e.message}`,
            },
          })
        })
    }
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// POST /api/statements/generate-trip
router.post('/generate-trip', async (req: Request, res: Response) => {
  const { tripId } = req.body
  if (!tripId) {
    res.status(400).json({ error: '請提供車趟 ID' })
    return
  }

  try {
    const statement = await generateTripStatement(tripId)
    res.status(201).json(statement)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PATCH /api/statements/:id/review
router.patch('/:id/review', async (req: AuthRequest, res: Response) => {
  const { action } = req.body
  if (!['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action 必須是 approve 或 reject' })
    return
  }

  const statement = await prisma.statement.findUnique({
    where: { id: Number(req.params.id) },
  })
  if (!statement) {
    res.status(404).json({ error: '明細不存在' })
    return
  }

  // 只有 draft 可以審核
  if (statement.status !== 'draft') {
    res.status(400).json({ error: '只有草稿狀態的明細可以審核' })
    return
  }

  const updated = await prisma.statement.update({
    where: { id: statement.id },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: req.userId,
      reviewedAt: new Date(),
    },
  })
  res.json(updated)
})

// PATCH /api/statements/:id/invoice
router.patch('/:id/invoice', async (_req: Request, res: Response) => {
  const statement = await prisma.statement.findUnique({
    where: { id: Number(_req.params.id) },
  })
  if (!statement) {
    res.status(404).json({ error: '明細不存在' })
    return
  }

  if (statement.status !== 'approved') {
    res.status(400).json({ error: '只有已審核的明細可以標記開票' })
    return
  }

  const updated = await prisma.statement.update({
    where: { id: statement.id },
    data: { status: 'invoiced' },
  })
  res.json(updated)
})

// POST /api/statements/:id/send
router.post('/:id/send', async (_req: Request, res: Response) => {
  const statement = await prisma.statement.findUnique({
    where: { id: Number(_req.params.id) },
    include: { customer: true },
  })
  if (!statement) {
    res.status(404).json({ error: '明細不存在' })
    return
  }

  // 需開票客戶：必須是 invoiced；不需開票：approved 即可
  const validStatus = statement.customer.invoiceRequired
    ? ['invoiced']
    : ['approved', 'invoiced']
  if (!validStatus.includes(statement.status)) {
    res.status(400).json({ error: '明細狀態不允許寄送' })
    return
  }

  const method = statement.customer.notificationMethod || 'email'

  try {
    if (method === 'email' || method === 'both') {
      if (!statement.customer.notificationEmail) {
        res.status(400).json({ error: '客戶未設定通知 Email' })
        return
      }
      await sendStatementEmail(statement.id)
    }

    if (method === 'line' || method === 'both') {
      // LINE 通知尚未實作，記錄 log
      await prisma.systemLog.create({
        data: {
          eventType: 'statement_send_skip',
          eventContent: `明細 #${statement.id} LINE 通知跳過（尚未實作）`,
        },
      })
    }

    // sendStatementEmail 已更新狀態，若是 line only 需手動更新
    if (method === 'line') {
      await prisma.statement.update({
        where: { id: statement.id },
        data: { status: 'sent', sentAt: new Date(), sentMethod: 'line' },
      })
    }

    const updated = await prisma.statement.findUnique({
      where: { id: statement.id },
      include: { customer: { select: { id: true, name: true } } },
    })
    res.json(updated)
  } catch (err: any) {
    // 寄送失敗：記錄錯誤並增加重試次數
    await prisma.statement.update({
      where: { id: statement.id },
      data: {
        sendRetryCount: { increment: 1 },
        sendError: err.message || '寄送失敗',
      },
    })
    res.status(500).json({ error: `寄送失敗：${err.message}` })
  }
})

// POST /api/statements/:id/void
router.post('/:id/void', async (req: AuthRequest, res: Response) => {
  const { reason } = req.body
  if (!reason) {
    res.status(400).json({ error: '請提供作廢原因' })
    return
  }

  const statement = await prisma.statement.findUnique({
    where: { id: Number(req.params.id) },
  })
  if (!statement) {
    res.status(404).json({ error: '明細不存在' })
    return
  }

  // 只有 sent 或 invoiced 可以作廢
  if (!['sent', 'invoiced'].includes(statement.status)) {
    res.status(400).json({ error: '只有已寄送或已開票的明細可以作廢' })
    return
  }

  const updated = await prisma.statement.update({
    where: { id: statement.id },
    data: {
      status: 'voided',
      voidedAt: new Date(),
      voidedBy: req.userId,
      voidReason: reason,
    },
  })
  res.json(updated)
})

export default router

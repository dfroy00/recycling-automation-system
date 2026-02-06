// backend/src/routes/notifications.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { sendAllNotifications, sendCustomerNotification } from '../services/notification.service'
import { sendPreviewEmail } from '../services/email.service'

const router = Router()

// POST /api/notifications/send - 批次發送通知
router.post('/send', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { yearMonth } = req.body
    if (!yearMonth) return res.status(400).json({ message: '請指定 yearMonth' })

    const result = await sendAllNotifications(yearMonth)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: '發送失敗', error: error.message })
  }
})

// POST /api/notifications/preview - 發送預覽給管理員
router.post('/preview', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { yearMonth, adminEmail } = req.body
    if (!yearMonth || !adminEmail) {
      return res.status(400).json({ message: '請指定 yearMonth 和 adminEmail' })
    }

    const statements = await prisma.monthlyStatement.findMany({
      where: { yearMonth },
    })

    const totalAmount = statements.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const anomalyCount = statements.filter(s => (s.detailJson as any)?.anomaly).length

    const result = await sendPreviewEmail(adminEmail, yearMonth, statements.length, anomalyCount, totalAmount)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: '預覽發送失敗', error: error.message })
  }
})

// POST /api/notifications/retry/:statementId - 重新發送單一通知
router.post('/retry/:statementId', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const statement = await prisma.monthlyStatement.findUniqueOrThrow({
      where: { statementId: Number(req.params.statementId) },
      include: { customer: true },
    })

    const result = await sendCustomerNotification({
      customerId: statement.customerId,
      customerName: statement.customer.customerName,
      notificationMethod: statement.customer.notificationMethod,
      email: statement.customer.email,
      lineId: statement.customer.lineId,
      yearMonth: statement.yearMonth,
      totalAmount: Number(statement.totalAmount),
      pdfPath: statement.pdfPath || '',
    })

    await prisma.monthlyStatement.update({
      where: { statementId: statement.statementId },
      data: {
        sendStatus: result.success ? 'success' : 'failed',
        sentAt: result.success ? new Date() : null,
      },
    })

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: '重發失敗', error: error.message })
  }
})

// GET /api/notifications/logs - 發送記錄
router.get('/logs', authenticate, async (req: Request, res: Response) => {
  try {
    const { yearMonth, status, page = '1', pageSize = '20' } = req.query
    const where: any = {}

    if (yearMonth) where.yearMonth = yearMonth
    if (status) where.sendStatus = status

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.monthlyStatement.findMany({
        where,
        include: { customer: { select: { customerName: true, notificationMethod: true } } },
        skip,
        take: Number(pageSize),
        orderBy: { generatedAt: 'desc' },
      }),
      prisma.monthlyStatement.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

export default router

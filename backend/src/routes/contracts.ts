// backend/src/routes/contracts.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'

const router = Router()

// ==================== 合約 CRUD ====================

// GET /api/contracts — 列表（支援分頁、篩選）
router.get('/', async (req: Request, res: Response) => {
  const { customerId, status } = req.query
  const where: any = {}
  if (customerId) where.customerId = Number(customerId)
  if (status) where.status = status as string

  const { page, pageSize, skip, all } = parsePagination(req)
  const include = {
    customer: { select: { id: true, name: true } },
    items: {
      include: { item: { select: { id: true, name: true, unit: true } } },
    },
  }

  if (all) {
    const contracts = await prisma.contract.findMany({
      where, include, orderBy: { id: 'desc' },
    })
    res.json(contracts)
    return
  }

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where, include, orderBy: { id: 'desc' }, skip, take: pageSize,
    }),
    prisma.contract.count({ where }),
  ])
  res.json(paginationResponse(contracts, total, page, pageSize))
})

// GET /api/contracts/:id — 詳情
router.get('/:id', async (req: Request, res: Response) => {
  const contract = await prisma.contract.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: { select: { id: true, name: true } },
      items: {
        include: { item: { select: { id: true, name: true, unit: true } } },
      },
    },
  })
  if (!contract) {
    res.status(404).json({ error: '合約不存在' })
    return
  }
  res.json(contract)
})

// POST /api/contracts — 新增
router.post('/', async (req: Request, res: Response) => {
  const { customerId, contractNumber, startDate, endDate, status: contractStatus, notes } = req.body

  if (!customerId || !contractNumber || !startDate || !endDate) {
    res.status(400).json({ error: '客戶、合約編號、起始日和到期日為必填' })
    return
  }

  try {
    const contract = await prisma.contract.create({
      data: {
        customerId,
        contractNumber,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: contractStatus || 'draft',
        notes,
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
    })
    res.status(201).json(contract)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '合約編號已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/contracts/:id — 更新
router.patch('/:id', async (req: Request, res: Response) => {
  const { contractNumber, startDate, endDate, status: contractStatus, notes } = req.body
  const data: any = {}
  if (contractNumber) data.contractNumber = contractNumber
  if (startDate) data.startDate = new Date(startDate)
  if (endDate) data.endDate = new Date(endDate)
  if (contractStatus) data.status = contractStatus
  if (notes !== undefined) data.notes = notes

  try {
    const contract = await prisma.contract.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        customer: { select: { id: true, name: true } },
      },
    })
    res.json(contract)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約不存在' })
      return
    }
    if (e.code === 'P2002') {
      res.status(409).json({ error: '合約編號已存在' })
      return
    }
    throw e
  }
})

// DELETE /api/contracts/:id — 刪除（設為 terminated）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.contract.update({
      where: { id: Number(req.params.id) },
      data: { status: 'terminated' },
    })
    res.json({ message: '已終止' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約不存在' })
      return
    }
    throw e
  }
})

// ==================== 合約品項 CRUD ====================

// GET /api/contracts/:id/items — 合約品項列表
router.get('/:id/items', async (req: Request, res: Response) => {
  const contractId = Number(req.params.id)
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) {
    res.status(404).json({ error: '合約不存在' })
    return
  }

  const items = await prisma.contractItem.findMany({
    where: { contractId },
    include: { item: { select: { id: true, name: true, unit: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(items)
})

// POST /api/contracts/:id/items — 新增合約品項
router.post('/:id/items', async (req: Request, res: Response) => {
  const contractId = Number(req.params.id)
  const { itemId, unitPrice, billingDirection } = req.body

  if (!itemId || unitPrice === undefined || !billingDirection) {
    res.status(400).json({ error: '品項、單價和計費方向為必填' })
    return
  }

  // 驗證 billingDirection
  if (!['receivable', 'payable', 'free'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須為 receivable、payable 或 free' })
    return
  }

  // 驗證合約存在
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) {
    res.status(404).json({ error: '合約不存在' })
    return
  }

  const contractItem = await prisma.contractItem.create({
    data: { contractId, itemId, unitPrice, billingDirection },
    include: { item: { select: { id: true, name: true, unit: true } } },
  })
  res.status(201).json(contractItem)
})

// PATCH /api/contracts/:cid/items/:iid — 更新合約品項
router.patch('/:cid/items/:iid', async (req: Request, res: Response) => {
  const { unitPrice, billingDirection } = req.body

  // 驗證 billingDirection（若有提供）
  if (billingDirection && !['receivable', 'payable', 'free'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須為 receivable、payable 或 free' })
    return
  }

  try {
    const contractItem = await prisma.contractItem.update({
      where: { id: Number(req.params.iid) },
      data: {
        ...(unitPrice !== undefined && { unitPrice }),
        ...(billingDirection && { billingDirection }),
      },
      include: { item: { select: { id: true, name: true, unit: true } } },
    })
    res.json(contractItem)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約品項不存在' })
      return
    }
    throw e
  }
})

// DELETE /api/contracts/:cid/items/:iid — 刪除合約品項
router.delete('/:cid/items/:iid', async (req: Request, res: Response) => {
  try {
    await prisma.contractItem.delete({ where: { id: Number(req.params.iid) } })
    res.json({ message: '已刪除' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約品項不存在' })
      return
    }
    throw e
  }
})

export default router

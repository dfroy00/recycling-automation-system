// backend/src/routes/customers.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'

const router = Router()

// GET /api/customers（支援分頁）
router.get('/', async (req: Request, res: Response) => {
  const { siteId, type, status } = req.query
  const where: any = {}
  if (siteId) where.siteId = Number(siteId)
  if (type) where.type = type as string
  if (status) where.status = status as string

  const { page, pageSize, skip, all } = parsePagination(req)

  if (all) {
    const customers = await prisma.customer.findMany({
      where,
      include: { site: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
    })
    res.json(customers)
    return
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { site: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ])
  res.json(paginationResponse(customers, total, page, pageSize))
})

// GET /api/customers/:id
router.get('/:id', async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      site: { select: { id: true, name: true } },
      fees: { where: { status: 'active' } },
    },
  })
  if (!customer) {
    res.status(404).json({ error: '客戶不存在' })
    return
  }
  res.json(customer)
})

// POST /api/customers
router.post('/', async (req: Request, res: Response) => {
  const data = req.body

  if (!data.siteId || !data.name || !data.type) {
    res.status(400).json({ error: '站區、客戶名稱、類型為必填' })
    return
  }

  if (!['contracted', 'temporary'].includes(data.type)) {
    res.status(400).json({ error: 'type 必須是 contracted 或 temporary' })
    return
  }

  if (data.statementType === 'per_trip') {
    data.paymentType = 'lump_sum'
  }

  if (data.tripFeeEnabled) {
    if (!data.tripFeeType || data.tripFeeAmount == null) {
      res.status(400).json({ error: '啟用車趣費時，車趣費類型和金額為必填' })
      return
    }
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        siteId: data.siteId,
        name: data.name,
        contactPerson: data.contactPerson,
        phone: data.phone,
        address: data.address,
        type: data.type,
        tripFeeEnabled: data.tripFeeEnabled ?? false,
        tripFeeType: data.tripFeeType,
        tripFeeAmount: data.tripFeeAmount,
        statementType: data.statementType ?? 'monthly',
        paymentType: data.paymentType ?? 'lump_sum',
        statementSendDay: data.statementSendDay,
        paymentDueDay: data.paymentDueDay,
        invoiceRequired: data.invoiceRequired ?? false,
        invoiceType: data.invoiceType,
        notificationMethod: data.notificationMethod ?? 'email',
        notificationEmail: data.notificationEmail,
        notificationLineId: data.notificationLineId,
        paymentAccount: data.paymentAccount,
      },
      include: { site: { select: { id: true, name: true } } },
    })
    res.status(201).json(customer)
  } catch (e: any) {
    if (e.code === 'P2003') {
      res.status(400).json({ error: '站區不存在' })
      return
    }
    throw e
  }
})

// PATCH /api/customers/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const data = req.body

  if (data.type && !['contracted', 'temporary'].includes(data.type)) {
    res.status(400).json({ error: 'type 必須是 contracted 或 temporary' })
    return
  }

  if (data.statementType === 'per_trip') {
    data.paymentType = 'lump_sum'
  }

  if (data.tripFeeEnabled === true) {
    if (!data.tripFeeType || data.tripFeeAmount == null) {
      const existing = await prisma.customer.findUnique({
        where: { id: Number(req.params.id) },
      })
      if (existing) {
        const tripFeeType = data.tripFeeType ?? existing.tripFeeType
        const tripFeeAmount = data.tripFeeAmount ?? existing.tripFeeAmount
        if (!tripFeeType || tripFeeAmount == null) {
          res.status(400).json({ error: '啟用車趣費時，車趣費類型和金額為必填' })
          return
        }
      }
    }
  }

  const updateData: any = {}
  const fields = [
    'siteId', 'name', 'contactPerson', 'phone', 'address', 'type',
    'tripFeeEnabled', 'tripFeeType', 'tripFeeAmount',
    'statementType', 'paymentType', 'statementSendDay', 'paymentDueDay',
    'invoiceRequired', 'invoiceType', 'notificationMethod',
    'notificationEmail', 'notificationLineId', 'paymentAccount', 'status',
  ]
  for (const field of fields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field]
    }
  }

  try {
    const customer = await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: updateData,
      include: { site: { select: { id: true, name: true } } },
    })
    res.json(customer)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '客戶不存在' })
      return
    }
    throw e
  }
})

// DELETE /api/customers/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: { status: 'inactive' },
    })
    res.json({ message: '已停用' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '客戶不存在' })
      return
    }
    throw e
  }
})

// ==================== 客戶附加費用子路由 ====================

// GET /api/customers/:id/fees
router.get('/:id/fees', async (req: Request, res: Response) => {
  const fees = await prisma.customerFee.findMany({
    where: { customerId: Number(req.params.id) },
    orderBy: { id: 'asc' },
  })
  res.json(fees)
})

// POST /api/customers/:id/fees
router.post('/:id/fees', async (req: Request, res: Response) => {
  const { name, amount, billingDirection, frequency } = req.body
  const customerId = Number(req.params.id)

  if (!name || amount == null || !billingDirection || !frequency) {
    res.status(400).json({ error: '名稱、金額、計費方向、頻率為必填' })
    return
  }

  if (!['receivable', 'payable'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須是 receivable 或 payable' })
    return
  }

  if (!['monthly', 'per_trip'].includes(frequency)) {
    res.status(400).json({ error: 'frequency 必須是 monthly 或 per_trip' })
    return
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) {
    res.status(404).json({ error: '客戶不存在' })
    return
  }
  if (customer.statementType === 'per_trip' && frequency === 'monthly') {
    res.status(400).json({ error: '按趣結算客戶只能使用 per_trip 頻率' })
    return
  }

  const fee = await prisma.customerFee.create({
    data: { customerId, name, amount, billingDirection, frequency },
  })
  res.status(201).json(fee)
})

// PATCH /api/customers/:cid/fees/:fid
router.patch('/:cid/fees/:fid', async (req: Request, res: Response) => {
  const { name, amount, billingDirection, frequency, status } = req.body

  if (billingDirection && !['receivable', 'payable'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須是 receivable 或 payable' })
    return
  }

  if (frequency && !['monthly', 'per_trip'].includes(frequency)) {
    res.status(400).json({ error: 'frequency 必須是 monthly 或 per_trip' })
    return
  }

  if (frequency === 'monthly') {
    const customer = await prisma.customer.findUnique({
      where: { id: Number(req.params.cid) },
    })
    if (customer?.statementType === 'per_trip') {
      res.status(400).json({ error: '按趣結算客戶只能使用 per_trip 頻率' })
      return
    }
  }

  const data: any = {}
  if (name) data.name = name
  if (amount !== undefined) data.amount = amount
  if (billingDirection) data.billingDirection = billingDirection
  if (frequency) data.frequency = frequency
  if (status) data.status = status

  try {
    const fee = await prisma.customerFee.update({
      where: { id: Number(req.params.fid) },
      data,
    })
    res.json(fee)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '附加費用不存在' })
      return
    }
    throw e
  }
})

// DELETE /api/customers/:cid/fees/:fid
router.delete('/:cid/fees/:fid', async (req: Request, res: Response) => {
  try {
    await prisma.customerFee.update({
      where: { id: Number(req.params.fid) },
      data: { status: 'inactive' },
    })
    res.json({ message: '已停用' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '附加費用不存在' })
      return
    }
    throw e
  }
})

export default router

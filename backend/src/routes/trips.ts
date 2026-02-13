// backend/src/routes/trips.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'
import { authorize } from '../middleware/authorize'
import { siteScope, ScopedRequest } from '../middleware/site-scope'

const router = Router()

// GET /api/trips（支援分頁）— 所有角色可讀+siteScope
router.get('/', siteScope(), async (req: Request, res: Response) => {
  const scopedReq = req as ScopedRequest
  const { customerId, siteId, dateFrom, dateTo } = req.query
  const where: any = {}
  if (customerId) where.customerId = Number(customerId)
  // 站區範圍過濾（scopedSiteId 優先）
  if (scopedReq.scopedSiteId) {
    where.siteId = scopedReq.scopedSiteId
  } else if (siteId) {
    where.siteId = Number(siteId)
  }
  if (dateFrom || dateTo) {
    where.tripDate = {}
    if (dateFrom) where.tripDate.gte = new Date(dateFrom as string)
    if (dateTo) where.tripDate.lte = new Date(dateTo as string)
  }

  const { page, pageSize, skip, all } = parsePagination(req)
  const include = {
    customer: { select: { id: true, name: true, type: true } },
    site: { select: { id: true, name: true } },
    items: {
      include: { item: { select: { id: true, name: true } } },
    },
  }

  if (all) {
    const trips = await prisma.trip.findMany({
      where, include, orderBy: { id: 'desc' },
    })
    res.json(trips)
    return
  }

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where, include, orderBy: { id: 'desc' }, skip, take: pageSize,
    }),
    prisma.trip.count({ where }),
  ])
  res.json(paginationResponse(trips, total, page, pageSize))
})

// GET /api/trips/:id — 所有角色可讀
router.get('/:id', siteScope(), async (req: Request, res: Response) => {
  const trip = await prisma.trip.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: { select: { id: true, name: true, type: true } },
      site: { select: { id: true, name: true } },
      items: {
        include: { item: { select: { id: true, name: true } } },
      },
    },
  })
  if (!trip) {
    res.status(404).json({ error: '車趟不存在' })
    return
  }
  res.json(trip)
})

// POST /api/trips — 僅 super_admin 和 site_manager
router.post('/', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const { customerId, siteId, tripDate, tripTime, driver, vehiclePlate, notes } = req.body

  if (!customerId || !siteId || !tripDate) {
    res.status(400).json({ error: '客戶、站區、收運日期為必填' })
    return
  }

  try {
    const trip = await prisma.trip.create({
      data: {
        customerId,
        siteId,
        tripDate: new Date(tripDate),
        tripTime,
        driver,
        vehiclePlate,
        source: 'manual',
        notes,
      },
      include: {
        customer: { select: { id: true, name: true, type: true } },
        site: { select: { id: true, name: true } },
      },
    })
    res.status(201).json(trip)
  } catch (e: any) {
    if (e.code === 'P2003') {
      res.status(400).json({ error: '客戶或站區不存在' })
      return
    }
    throw e
  }
})

// PATCH /api/trips/:id — 僅 super_admin 和 site_manager
router.patch('/:id', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const { tripDate, tripTime, driver, vehiclePlate, notes } = req.body
  const data: any = {}
  if (tripDate) data.tripDate = new Date(tripDate)
  if (tripTime !== undefined) data.tripTime = tripTime
  if (driver !== undefined) data.driver = driver
  if (vehiclePlate !== undefined) data.vehiclePlate = vehiclePlate
  if (notes !== undefined) data.notes = notes

  try {
    const trip = await prisma.trip.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        customer: { select: { id: true, name: true, type: true } },
        site: { select: { id: true, name: true } },
      },
    })
    res.json(trip)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '車趟不存在' })
      return
    }
    throw e
  }
})

// DELETE /api/trips/:id — 僅 super_admin 和 site_manager
router.delete('/:id', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  try {
    // 先刪除車趟品項，再刪除車趟
    await prisma.tripItem.deleteMany({ where: { tripId: Number(req.params.id) } })
    await prisma.trip.delete({ where: { id: Number(req.params.id) } })
    res.json({ message: '已刪除' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '車趟不存在' })
      return
    }
    throw e
  }
})

// ==================== 車趟品項（快照邏輯） ====================

// GET /api/trips/:id/items — 所有角色可讀
router.get('/:id/items', siteScope(), async (req: Request, res: Response) => {
  const tripId = Number(req.params.id)
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) {
    res.status(404).json({ error: '車趟不存在' })
    return
  }

  const items = await prisma.tripItem.findMany({
    where: { tripId },
    include: { item: { select: { id: true, name: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(items)
})

// POST /api/trips/:id/items — 僅 super_admin 和 site_manager
router.post('/:id/items', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const tripId = Number(req.params.id)
  const { itemId, quantity, unitPrice: manualPrice, billingDirection: manualDirection } = req.body

  if (!itemId || quantity == null) {
    res.status(400).json({ error: '品項和數量為必填' })
    return
  }

  // 查詢車趟和客戶資料
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      customer: {
        include: {
          contracts: {
            where: { status: 'active' },
            include: { items: true },
          },
        },
      },
    },
  })

  if (!trip) {
    res.status(404).json({ error: '車趟不存在' })
    return
  }

  // 查詢品項主檔
  const item = await prisma.item.findUnique({ where: { id: itemId } })
  if (!item) {
    res.status(400).json({ error: '品項不存在' })
    return
  }

  let unitPrice: number
  let billingDirection: string
  const unit = item.unit

  if (trip.customer.type === 'contracted') {
    // 簽約客戶：從有效合約找品項定價
    const contractItem = trip.customer.contracts
      .flatMap(c => c.items)
      .find(ci => ci.itemId === itemId)

    if (contractItem) {
      unitPrice = Number(contractItem.unitPrice)
      billingDirection = contractItem.billingDirection
    } else {
      // 合約中無此品項：降級為手動輸入
      if (manualPrice === undefined || !manualDirection) {
        res.status(400).json({ error: '此客戶合約中無此品項，請手動輸入單價和費用方向' })
        return
      }
      unitPrice = manualPrice
      billingDirection = manualDirection
    }
  } else {
    // 臨時客戶：手動輸入
    if (manualPrice === undefined || !manualDirection) {
      res.status(400).json({ error: '臨時客戶須手動輸入單價和費用方向' })
      return
    }
    unitPrice = manualPrice
    billingDirection = manualDirection
  }

  // 驗證 billingDirection
  if (!['receivable', 'payable', 'free'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須為 receivable、payable 或 free' })
    return
  }

  const amount = billingDirection === 'free' ? 0 : unitPrice * Number(quantity)

  const tripItem = await prisma.tripItem.create({
    data: { tripId, itemId, quantity, unit, unitPrice, billingDirection, amount },
    include: { item: { select: { id: true, name: true } } },
  })
  res.status(201).json(tripItem)
})

// PATCH /api/trips/:tid/items/:iid — 僅 super_admin 和 site_manager
router.patch('/:tid/items/:iid', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const { quantity, unitPrice, billingDirection } = req.body

  if (billingDirection && !['receivable', 'payable', 'free'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須為 receivable、payable 或 free' })
    return
  }

  try {
    // 取得現有資料以計算金額
    const existing = await prisma.tripItem.findUnique({ where: { id: Number(req.params.iid) } })
    if (!existing) {
      res.status(404).json({ error: '車趟品項不存在' })
      return
    }

    const newQuantity = quantity ?? existing.quantity
    const newUnitPrice = unitPrice ?? existing.unitPrice
    const newDirection = billingDirection ?? existing.billingDirection
    const newAmount = newDirection === 'free' ? 0 : Number(newUnitPrice) * Number(newQuantity)

    const tripItem = await prisma.tripItem.update({
      where: { id: Number(req.params.iid) },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(billingDirection && { billingDirection }),
        amount: newAmount,
      },
      include: { item: { select: { id: true, name: true } } },
    })
    res.json(tripItem)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '車趟品項不存在' })
      return
    }
    throw e
  }
})

// DELETE /api/trips/:tid/items/:iid — 僅 super_admin 和 site_manager
router.delete('/:tid/items/:iid', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  try {
    await prisma.tripItem.delete({ where: { id: Number(req.params.iid) } })
    res.json({ message: '已刪除' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '車趟品項不存在' })
      return
    }
    throw e
  }
})

export default router

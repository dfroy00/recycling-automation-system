import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/data/trips - 查詢車趟記錄
router.get('/trips', authenticate, async (req: Request, res: Response) => {
  try {
    const { siteId, customerId, startDate, endDate, driver, page = '1', pageSize = '20' } = req.query
    const where: any = {}

    if (siteId) where.siteId = siteId
    if (customerId) where.customerId = customerId
    if (driver) where.driver = { contains: String(driver), mode: 'insensitive' }
    if (startDate || endDate) {
      where.tripDate = {}
      if (startDate) where.tripDate.gte = new Date(String(startDate))
      if (endDate) where.tripDate.lte = new Date(String(endDate))
    }

    // 站點管理員限制
    if (req.user?.role === 'site_admin' && req.user.siteId) {
      where.siteId = req.user.siteId
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: { customer: { select: { customerName: true } } },
        skip,
        take: Number(pageSize),
        orderBy: [{ tripDate: 'desc' }, { tripTime: 'desc' }],
      }),
      prisma.trip.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// GET /api/data/items - 查詢品項收取記錄
router.get('/items', authenticate, async (req: Request, res: Response) => {
  try {
    const { siteId, customerId, itemName, startDate, endDate, page = '1', pageSize = '20' } = req.query
    const where: any = {}

    if (siteId) where.siteId = siteId
    if (customerId) where.customerId = customerId
    if (itemName) where.itemName = { contains: String(itemName), mode: 'insensitive' }
    if (startDate || endDate) {
      where.collectionDate = {}
      if (startDate) where.collectionDate.gte = new Date(String(startDate))
      if (endDate) where.collectionDate.lte = new Date(String(endDate))
    }

    if (req.user?.role === 'site_admin' && req.user.siteId) {
      where.siteId = req.user.siteId
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total, stats] = await Promise.all([
      prisma.itemCollected.findMany({
        where,
        include: { customer: { select: { customerName: true } } },
        skip,
        take: Number(pageSize),
        orderBy: [{ collectionDate: 'desc' }],
      }),
      prisma.itemCollected.count({ where }),
      prisma.itemCollected.aggregate({
        where,
        _sum: { weightKg: true },
        _avg: { weightKg: true },
      }),
    ])

    res.json({
      data,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      stats: {
        totalWeight: stats._sum.weightKg || 0,
        avgWeight: stats._avg.weightKg || 0,
      },
    })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// PUT /api/data/items/:id - 修正品項收取記錄
router.put(
  '/items/:id',
  authenticate,
  authorize('system_admin', 'site_admin'),
  async (req: Request, res: Response) => {
    try {
      const { itemName, weightKg, customerId } = req.body

      const updated = await prisma.itemCollected.update({
        where: { collectionId: Number(req.params.id) },
        data: {
          ...(itemName && { itemName }),
          ...(weightKg !== undefined && { weightKg }),
          ...(customerId && { customerId }),
        },
      })

      // 記錄修正日誌
      await prisma.systemLog.create({
        data: {
          siteId: updated.siteId,
          eventType: 'data_correction',
          eventContent: `品項記錄 ${req.params.id} 已修正 by ${req.user?.username}`,
        },
      })

      res.json(updated)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: '記錄不存在' })
      }
      res.status(500).json({ message: '修正失敗', error: error.message })
    }
  }
)

// PUT /api/data/trips/:id - 修正車趟記錄
router.put(
  '/trips/:id',
  authenticate,
  authorize('system_admin', 'site_admin'),
  async (req: Request, res: Response) => {
    try {
      const updated = await prisma.trip.update({
        where: { tripId: Number(req.params.id) },
        data: req.body,
      })

      await prisma.systemLog.create({
        data: {
          siteId: updated.siteId,
          eventType: 'data_correction',
          eventContent: `車趟記錄 ${req.params.id} 已修正 by ${req.user?.username}`,
        },
      })

      res.json(updated)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: '記錄不存在' })
      }
      res.status(500).json({ message: '修正失敗', error: error.message })
    }
  }
)

export default router

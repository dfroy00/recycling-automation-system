// backend/src/routes/dashboard.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

const router = Router()

// GET /api/dashboard/stats - 儀表板統計數據
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 站點限制
    const siteFilter: any = {}
    if (req.user?.role === 'site_admin' && req.user.siteId) {
      siteFilter.siteId = req.user.siteId
    }

    const [todayTrips, todayItems, monthTrips, pendingStatements, expiringContracts] = await Promise.all([
      // 今日匯入車趟數
      prisma.trip.count({ where: { ...siteFilter, importedAt: { gte: today, lt: tomorrow } } }),
      // 今日匯入品項數
      prisma.itemCollected.count({ where: { ...siteFilter, importedAt: { gte: today, lt: tomorrow } } }),
      // 本月車趟總數
      prisma.trip.count({
        where: {
          ...siteFilter,
          tripDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
            lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          },
        },
      }),
      // 待發送明細數
      prisma.monthlyStatement.count({ where: { ...siteFilter, sendStatus: 'pending' } }),
      // 30 天內到期合約
      prisma.contractPrice.findMany({
        where: {
          endDate: {
            gte: today,
            lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          customer: { select: { customerName: true, siteId: true } },
        },
        orderBy: { endDate: 'asc' },
      }),
    ])

    res.json({
      todayTrips,
      todayItems,
      monthTrips,
      pendingStatements,
      expiringContracts: expiringContracts.map(c => ({
        customerId: c.customerId,
        customerName: c.customer.customerName,
        siteId: c.customer.siteId,
        itemName: c.itemName,
        endDate: c.endDate,
        daysLeft: Math.ceil((c.endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
      })),
    })
  } catch (error: any) {
    res.status(500).json({ message: '查詢統計失敗', error: error.message })
  }
})

export default router

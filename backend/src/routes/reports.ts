// backend/src/routes/reports.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { generateAllStatements, generateMonthlyStatement } from '../services/monthly-statement.service'

const router = Router()

// POST /api/reports/monthly/generate - 產生月結明細
router.post(
  '/monthly/generate',
  authenticate,
  authorize('system_admin'),
  async (req: Request, res: Response) => {
    try {
      const { yearMonth, siteId } = req.body
      if (!yearMonth) {
        res.status(400).json({ message: '請指定 yearMonth (YYYY-MM)' })
        return
      }

      const results = await generateAllStatements(yearMonth, siteId)

      res.json({
        yearMonth,
        total: results.length,
        results: results.map(r => ({
          customerId: r.customerId,
          totalAmount: r.totalAmount.toNumber(),
          tripCount: r.tripCount,
        })),
      })
    } catch (error: any) {
      console.error('產生月結明細失敗:', error)
      res.status(500).json({ message: '產生失敗', error: error.message })
    }
  }
)

// GET /api/reports/monthly - 查詢月結明細
router.get('/monthly', authenticate, async (req: Request, res: Response) => {
  try {
    const { yearMonth, siteId, customerId, page = '1', pageSize = '20' } = req.query

    const where: any = {}
    if (yearMonth) where.yearMonth = yearMonth
    if (siteId) where.siteId = siteId
    if (customerId) where.customerId = customerId

    // 站點管理員只能看自己站點
    if (req.user?.role === 'site_admin' && req.user.siteId) {
      where.siteId = req.user.siteId
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.monthlyStatement.findMany({
        where,
        include: { customer: { select: { customerName: true, billingType: true } } },
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

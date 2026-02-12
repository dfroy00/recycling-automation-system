// backend/src/routes/dashboard.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

// GET /api/dashboard/stats — 儀表板統計
router.get('/stats', async (_req: Request, res: Response) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0) // 當月最後一天

  // 本月車趟數
  const tripCount = await prisma.trip.count({
    where: {
      tripDate: { gte: monthStart, lte: monthEnd },
    },
  })

  // 本月應收/應付總額（從月結明細）
  const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`
  const statements = await prisma.statement.findMany({
    where: { yearMonth, status: { not: 'draft' } },
    select: { totalReceivable: true, totalPayable: true },
  })
  const totalReceivable = statements.reduce(
    (sum, s) => sum + Number(s.totalReceivable), 0
  )
  const totalPayable = statements.reduce(
    (sum, s) => sum + Number(s.totalPayable), 0
  )

  // 有效客戶數
  const activeCustomerCount = await prisma.customer.count({
    where: { status: 'active' },
  })

  // 待審核明細數
  const pendingReviewCount = await prisma.statement.count({
    where: { status: 'draft' },
  })

  // 合約即將到期提醒（30 天內）
  const thirtyDaysLater = new Date(now)
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
  const rawExpiringContracts = await prisma.contract.findMany({
    where: {
      status: 'active',
      endDate: { gte: now, lte: thirtyDaysLater },
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: { endDate: 'asc' },
  })

  // 計算每個合約距到期的天數，欄位名稱對齊前端 DashboardStats 型別
  const expiringContracts = rawExpiringContracts.map((c) => {
    const daysRemaining = Math.ceil(
      (new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    return {
      customerId: c.customer.id,
      customerName: c.customer.name,
      contractNumber: c.contractNumber,
      endDate: c.endDate,
      daysRemaining,
    }
  })

  // 組合待處理項目清單
  const pendingItems: { type: string; count: number; label: string; link: string }[] = []
  if (pendingReviewCount > 0) {
    pendingItems.push({
      type: 'statement_review',
      count: pendingReviewCount,
      label: '待審核明細',
      link: '/statements?status=draft',
    })
  }

  res.json({
    monthlyTrips: tripCount,
    totalReceivable,
    totalPayable,
    customerCount: activeCustomerCount,
    pendingReviews: pendingReviewCount,
    expiringContracts,
    pendingItems,
  })
})

export default router

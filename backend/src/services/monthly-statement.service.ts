// backend/src/services/monthly-statement.service.ts
import { Decimal } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  calculateTypeA,
  calculateTypeB,
  calculateTypeC,
  calculateTypeD,
  type TripSummary,
  type ItemSummary,
  type BillingResult,
} from './billing.service'

export interface StatementResult {
  customerId: string
  yearMonth: string
  tripCount: number
  totalAmount: Decimal
  billingResult: BillingResult
}

// 取得客戶某月的車趟摘要（按日期彙總）
async function getTripSummary(customerId: string, startDate: Date, endDate: Date): Promise<TripSummary[]> {
  const trips = await prisma.trip.groupBy({
    by: ['tripDate'],
    where: {
      customerId,
      tripDate: { gte: startDate, lt: endDate },
    },
    _count: { tripId: true },
    orderBy: { tripDate: 'asc' },
  })

  return trips.map(t => ({
    tripDate: t.tripDate,
    tripCount: t._count.tripId,
  }))
}

// 取得客戶某月的品項摘要（按品項彙總），並查找對應單價
async function getItemSummary(
  customerId: string,
  startDate: Date,
  endDate: Date,
  billingType: string
): Promise<ItemSummary[]> {
  // 彙總品項重量
  const items = await prisma.itemCollected.groupBy({
    by: ['itemName'],
    where: {
      customerId,
      collectionDate: { gte: startDate, lt: endDate },
    },
    _sum: { weightKg: true },
  })

  // C 類客戶：查找合約價
  let contractPrices: Map<string, Decimal> = new Map()
  if (billingType === 'C') {
    const contracts = await prisma.contractPrice.findMany({
      where: {
        customerId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    })
    for (const c of contracts) {
      contractPrices.set(c.itemName, c.contractPrice)
    }
  }

  // 組合品項摘要
  const summaries: ItemSummary[] = []
  for (const item of items) {
    const totalWeight = item._sum.weightKg || new Decimal(0)
    const contractPrice = contractPrices.get(item.itemName)

    if (contractPrice) {
      // 使用合約價
      summaries.push({
        itemName: item.itemName,
        totalWeight,
        unitPrice: contractPrice,
        priceType: 'contract',
      })
    } else {
      // 使用牌價
      const priceRecord = await prisma.itemPrice.findFirst({
        where: {
          itemName: item.itemName,
          effectiveDate: { lte: endDate },
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: startDate } },
          ],
        },
        orderBy: { effectiveDate: 'desc' },
      })

      summaries.push({
        itemName: item.itemName,
        totalWeight,
        unitPrice: priceRecord?.standardPrice || new Decimal(0),
        priceType: 'standard',
      })
    }
  }

  return summaries
}

// 為單一客戶產生月結明細
export async function generateMonthlyStatement(
  customerId: string,
  yearMonth: string
): Promise<StatementResult> {
  const [year, month] = yearMonth.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  // 查詢客戶資料
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { customerId },
  })

  // 取得車趟和品項摘要
  const trips = await getTripSummary(customerId, startDate, endDate)
  const items = await getItemSummary(customerId, startDate, endDate, customer.billingType)

  // 根據計費類型計算
  let billingResult: BillingResult
  switch (customer.billingType) {
    case 'A':
      billingResult = calculateTypeA(trips, items, customer.tripPrice || new Decimal(0))
      break
    case 'B':
      billingResult = calculateTypeB(trips, customer.tripPrice || new Decimal(0))
      break
    case 'C':
      billingResult = calculateTypeC(trips, items)
      break
    case 'D':
      billingResult = calculateTypeD(trips, items)
      break
    default:
      throw new Error(`不支援的計費類型：${customer.billingType}`)
  }

  // 先刪再建（同客戶同月份只保留一筆）
  await prisma.monthlyStatement.deleteMany({
    where: { customerId, yearMonth },
  })

  await prisma.monthlyStatement.create({
    data: {
      siteId: customer.siteId,
      customerId,
      yearMonth,
      totalAmount: billingResult.totalAmount,
      detailJson: JSON.parse(JSON.stringify(billingResult)),
      sendStatus: 'pending',
    },
  })

  return {
    customerId,
    yearMonth,
    tripCount: billingResult.tripCount,
    totalAmount: billingResult.totalAmount,
    billingResult,
  }
}

// 為某站點所有客戶產生月結明細
export async function generateAllStatements(
  yearMonth: string,
  siteId?: string
): Promise<StatementResult[]> {
  const where: any = { status: '啟用' }
  if (siteId) where.siteId = siteId

  const customers = await prisma.customer.findMany({ where })
  const results: StatementResult[] = []

  for (const customer of customers) {
    try {
      const result = await generateMonthlyStatement(customer.customerId, yearMonth)
      results.push(result)
    } catch (error: any) {
      console.error(`計算 ${customer.customerId} 月結明細失敗:`, error.message)
    }
  }

  return results
}

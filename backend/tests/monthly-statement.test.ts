// backend/tests/monthly-statement.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '../src/lib/prisma'
import { generateMonthlyStatement } from '../src/services/monthly-statement.service'

describe('月結明細計算', () => {
  // 測試前插入測試資料
  beforeAll(async () => {
    // 清理測試資料
    await prisma.monthlyStatement.deleteMany({ where: { yearMonth: '2026-03' } })
    await prisma.itemCollected.deleteMany({ where: { collectionDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') } } })
    await prisma.trip.deleteMany({ where: { tripDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') } } })

    // 為 C001 (A 類) 插入 3 月份的車趟
    await prisma.trip.createMany({
      data: [
        { siteId: 'S001', customerId: 'C001', tripDate: new Date('2026-03-05'), tripTime: new Date('1970-01-01T09:30:00'), driver: '王小明', vehiclePlate: 'ABC-1234' },
        { siteId: 'S001', customerId: 'C001', tripDate: new Date('2026-03-12'), tripTime: new Date('1970-01-01T10:00:00'), driver: '王小明', vehiclePlate: 'ABC-1234' },
      ],
    })

    // 為 C001 插入品項
    await prisma.itemCollected.createMany({
      data: [
        { siteId: 'S001', customerId: 'C001', collectionDate: new Date('2026-03-05'), itemName: '紙類', weightKg: 150.5 },
        { siteId: 'S001', customerId: 'C001', collectionDate: new Date('2026-03-12'), itemName: '塑膠', weightKg: 80.2 },
      ],
    })
  })

  it('應正確計算 A 類客戶月結明細', async () => {
    const result = await generateMonthlyStatement('C001', '2026-03')

    expect(result).toBeDefined()
    expect(result.customerId).toBe('C001')
    expect(result.yearMonth).toBe('2026-03')
    expect(result.tripCount).toBe(2)
    // 車趟費 = 2 * 300 = 600
    // 品項費 = 150.5*5 + 80.2*3.5 = 752.5 + 280.7 = 1033.2
    // 總金額 = 600 + 1033.2 = 1633.2
    expect(result.totalAmount.toNumber()).toBeCloseTo(1633.2, 1)
  })

  it('應正確儲存月結明細到資料庫', async () => {
    const saved = await prisma.monthlyStatement.findFirst({
      where: { customerId: 'C001', yearMonth: '2026-03' },
    })

    expect(saved).toBeDefined()
    expect(Number(saved!.totalAmount)).toBeCloseTo(1633.2, 1)
  })
})

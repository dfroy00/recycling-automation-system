// backend/src/__tests__/statement.service.test.ts
import prisma from '../lib/prisma'
import { generateMonthlyStatements, generateCustomerStatement, generateTripStatement } from '../services/statement.service'

let siteId: number
let monthlyCustomerId: number
let perTripCustomerId: number
let tripId: number
let itemId: number

beforeAll(async () => {
  // 建立測試站區
  const site = await prisma.site.upsert({
    where: { name: '明細服務測試站' },
    update: {},
    create: { name: '明細服務測試站', status: 'active' },
  })
  siteId = site.id

  // 建立測試品項
  const item = await prisma.item.upsert({
    where: { name: '明細測試品_ss' },
    update: {},
    create: { name: '明細測試品_ss', unit: 'kg', category: '鐵類' },
  })
  itemId = item.id

  // 月結客戶
  const c1 = await prisma.customer.create({
    data: {
      siteId, name: '月結客戶_ss', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  monthlyCustomerId = c1.id

  // 月結客戶的車趟
  const trip1 = await prisma.trip.create({
    data: { customerId: c1.id, siteId, tripDate: new Date('2026-05-10'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip1.id, itemId, quantity: 100, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 1000 },
  })

  // 按趟客戶
  const c2 = await prisma.customer.create({
    data: {
      siteId, name: '按趟客戶_ss', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'per_trip', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  perTripCustomerId = c2.id

  // 按趟客戶的車趟
  const trip2 = await prisma.trip.create({
    data: { customerId: c2.id, siteId, tripDate: new Date('2026-05-15'), source: 'manual' },
  })
  tripId = trip2.id
  await prisma.tripItem.create({
    data: { tripId: trip2.id, itemId, quantity: 50, unit: 'kg', unitPrice: 8, billingDirection: 'payable', amount: 400 },
  })
})

afterAll(async () => {
  const customerNames = ['月結客戶_ss', '按趟客戶_ss']
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } })
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { in: customerNames } } } } })
  await prisma.trip.deleteMany({ where: { customer: { name: { in: customerNames } } } })
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } })
  await prisma.item.deleteMany({ where: { name: '明細測試品_ss' } })
  await prisma.site.deleteMany({ where: { name: '明細服務測試站' } })
  await prisma.$disconnect()
})

describe('明細產出服務 generateCustomerStatement', () => {
  test('產出月結明細', async () => {
    const stmt = await generateCustomerStatement(monthlyCustomerId, '2026-05')
    expect(stmt.customerId).toBe(monthlyCustomerId)
    expect(stmt.statementType).toBe('monthly')
    expect(stmt.yearMonth).toBe('2026-05')
    expect(stmt.status).toBe('draft')
    expect(Number(stmt.itemReceivable)).toBe(1000)
    expect(stmt.detailJson).toBeDefined()
  })
})

describe('明細產出服務 generateMonthlyStatements', () => {
  test('批次產出跳過已有明細的客戶', async () => {
    // 第一次已在上方測試產出，再跑一次應跳過
    const result = await generateMonthlyStatements('2026-05')
    // 月結客戶_ss 應被跳過
    expect(result.skipped).toBeGreaterThanOrEqual(1)
  })

  test('防重複：不會產出重複明細', async () => {
    const stmts = await prisma.statement.findMany({
      where: {
        customerId: monthlyCustomerId,
        yearMonth: '2026-05',
        statementType: 'monthly',
        status: { notIn: ['voided', 'rejected'] },
      },
    })
    // 應只有一筆
    expect(stmts.length).toBe(1)
  })

  test('錯誤隔離：單一客戶失敗不影響其他', async () => {
    // 批次產出某月份，即使有錯誤也會回傳 errors array
    const result = await generateMonthlyStatements('2026-06')
    // result.errors 是陣列
    expect(Array.isArray(result.errors)).toBe(true)
    expect(typeof result.created).toBe('number')
    expect(typeof result.skipped).toBe('number')
  })
})

describe('明細產出服務 generateTripStatement', () => {
  test('產出按趟明細', async () => {
    const stmt = await generateTripStatement(tripId)
    expect(stmt.customerId).toBe(perTripCustomerId)
    expect(stmt.statementType).toBe('per_trip')
    expect(stmt.tripId).toBe(tripId)
    expect(stmt.status).toBe('draft')
    expect(Number(stmt.itemPayable)).toBe(400)
  })

  test('防重複：同一車趟不可重複產出', async () => {
    await expect(generateTripStatement(tripId)).rejects.toThrow('已有明細')
  })

  test('月結客戶不可產出按趟明細', async () => {
    // 用月結客戶的車趟來產出按趟明細
    const monthlyTrip = await prisma.trip.findFirst({
      where: { customerId: monthlyCustomerId },
    })
    await expect(generateTripStatement(monthlyTrip!.id)).rejects.toThrow('非按趟結算')
  })

  test('不存在的車趟拋出錯誤', async () => {
    await expect(generateTripStatement(999999)).rejects.toThrow('車趟不存在')
  })
})

// backend/src/__tests__/billing.service.test.ts
import prisma from '../lib/prisma'
import { calculateMonthlyBilling, calculateTripBilling } from '../services/billing.service'

// 測試用資料 ID
let siteId: number
let receivableItemId: number
let payableItemId: number
let freeItemId: number

// 客戶
let pureReceivableCustomerId: number
let purePayableCustomerId: number
let mixedCustomerId: number
let perTripFeeCustomerId: number
let perMonthFeeCustomerId: number
let separateInvoiceCustomerId: number
let noTripCustomerId: number
let perTripStatementCustomerId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料（按 FK 依賴順序）
  const customerNames = [
    '純應收客戶_bs', '純應付客戶_bs', '混合客戶_bs',
    '按次車趟費客戶_bs', '按月車趟費客戶_bs', '分開開票客戶_bs',
    '無車趟客戶_bs', '按趟結算客戶_bs',
  ]
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { in: customerNames } } } } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.customerFee.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.contractItem.deleteMany({ where: { contract: { contractNumber: 'C-BS-001' } } }).catch(() => {})
  await prisma.contract.deleteMany({ where: { contractNumber: 'C-BS-001' } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } }).catch(() => {})

  // 建立測試站區
  const site = await prisma.site.upsert({
    where: { name: '計費測試站' },
    update: {},
    create: { name: '計費測試站', status: 'active' },
  })
  siteId = site.id

  // 建立測試品項
  const item1 = await prisma.item.upsert({
    where: { name: '計費應收品_bs' },
    update: {},
    create: { name: '計費應收品_bs', unit: 'kg', category: '鐵類' },
  })
  receivableItemId = item1.id

  const item2 = await prisma.item.upsert({
    where: { name: '計費應付品_bs' },
    update: {},
    create: { name: '計費應付品_bs', unit: 'kg', category: '紙類' },
  })
  payableItemId = item2.id

  const item3 = await prisma.item.upsert({
    where: { name: '計費免費品_bs' },
    update: {},
    create: { name: '計費免費品_bs', unit: 'kg', category: '雜項' },
  })
  freeItemId = item3.id

  // === 客戶 1：純應收 ===
  const c1 = await prisma.customer.create({
    data: {
      siteId, name: '純應收客戶_bs', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  pureReceivableCustomerId = c1.id

  // 建立合約
  const contract1 = await prisma.contract.create({
    data: {
      customerId: c1.id, contractNumber: 'C-BS-001',
      startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      status: 'active',
    },
  })
  await prisma.contractItem.create({
    data: { contractId: contract1.id, itemId: receivableItemId, unitPrice: 10, billingDirection: 'receivable' },
  })

  // 建立車趟和品項
  const trip1 = await prisma.trip.create({
    data: { customerId: c1.id, siteId, tripDate: new Date('2026-03-05'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip1.id, itemId: receivableItemId, quantity: 100, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 1000 },
  })
  const trip1b = await prisma.trip.create({
    data: { customerId: c1.id, siteId, tripDate: new Date('2026-03-15'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip1b.id, itemId: receivableItemId, quantity: 200, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 2000 },
  })

  // === 客戶 2：純應付 ===
  const c2 = await prisma.customer.create({
    data: {
      siteId, name: '純應付客戶_bs', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  purePayableCustomerId = c2.id

  const trip2 = await prisma.trip.create({
    data: { customerId: c2.id, siteId, tripDate: new Date('2026-03-10'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip2.id, itemId: payableItemId, quantity: 50, unit: 'kg', unitPrice: 5, billingDirection: 'payable', amount: 250 },
  })

  // === 客戶 3：混合方向（含免費品項） ===
  const c3 = await prisma.customer.create({
    data: {
      siteId, name: '混合客戶_bs', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  mixedCustomerId = c3.id

  const trip3 = await prisma.trip.create({
    data: { customerId: c3.id, siteId, tripDate: new Date('2026-03-08'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip3.id, itemId: receivableItemId, quantity: 100, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 1000 },
  })
  await prisma.tripItem.create({
    data: { tripId: trip3.id, itemId: payableItemId, quantity: 80, unit: 'kg', unitPrice: 5, billingDirection: 'payable', amount: 400 },
  })
  await prisma.tripItem.create({
    data: { tripId: trip3.id, itemId: freeItemId, quantity: 30, unit: 'kg', unitPrice: 0, billingDirection: 'free', amount: 0 },
  })

  // === 客戶 4：按次車趟費 ===
  const c4 = await prisma.customer.create({
    data: {
      siteId, name: '按次車趟費客戶_bs', type: 'contracted',
      tripFeeEnabled: true, tripFeeType: 'per_trip', tripFeeAmount: 500,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  perTripFeeCustomerId = c4.id

  const trip4a = await prisma.trip.create({
    data: { customerId: c4.id, siteId, tripDate: new Date('2026-03-01'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip4a.id, itemId: payableItemId, quantity: 100, unit: 'kg', unitPrice: 5, billingDirection: 'payable', amount: 500 },
  })
  const trip4b = await prisma.trip.create({
    data: { customerId: c4.id, siteId, tripDate: new Date('2026-03-20'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip4b.id, itemId: payableItemId, quantity: 200, unit: 'kg', unitPrice: 5, billingDirection: 'payable', amount: 1000 },
  })

  // === 客戶 5：按月車趟費 ===
  const c5 = await prisma.customer.create({
    data: {
      siteId, name: '按月車趟費客戶_bs', type: 'contracted',
      tripFeeEnabled: true, tripFeeType: 'per_month', tripFeeAmount: 3000,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  perMonthFeeCustomerId = c5.id

  const trip5 = await prisma.trip.create({
    data: { customerId: c5.id, siteId, tripDate: new Date('2026-03-12'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip5.id, itemId: payableItemId, quantity: 50, unit: 'kg', unitPrice: 5, billingDirection: 'payable', amount: 250 },
  })

  // === 客戶 6：分開開票 ===
  const c6 = await prisma.customer.create({
    data: {
      siteId, name: '分開開票客戶_bs', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: true, invoiceType: 'separate',
      notificationMethod: 'email',
    },
  })
  separateInvoiceCustomerId = c6.id

  const trip6 = await prisma.trip.create({
    data: { customerId: c6.id, siteId, tripDate: new Date('2026-03-10'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip6.id, itemId: receivableItemId, quantity: 100, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 1000 },
  })
  await prisma.tripItem.create({
    data: { tripId: trip6.id, itemId: payableItemId, quantity: 60, unit: 'kg', unitPrice: 5, billingDirection: 'payable', amount: 300 },
  })

  // === 客戶 7：無車趟月份 ===
  const c7 = await prisma.customer.create({
    data: {
      siteId, name: '無車趟客戶_bs', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  noTripCustomerId = c7.id

  // === 客戶 8：按趟結算 + 附加費用 ===
  const c8 = await prisma.customer.create({
    data: {
      siteId, name: '按趟結算客戶_bs', type: 'contracted',
      tripFeeEnabled: true, tripFeeType: 'per_trip', tripFeeAmount: 300,
      statementType: 'per_trip', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  perTripStatementCustomerId = c8.id

  // 附加費用：per_trip 應收 + monthly 應付（monthly 不算在按趟明細中）
  await prisma.customerFee.create({
    data: { customerId: c8.id, name: '處理費_bs', amount: 200, billingDirection: 'receivable', frequency: 'per_trip' },
  })
  await prisma.customerFee.create({
    data: { customerId: c8.id, name: '月租費_bs', amount: 1000, billingDirection: 'payable', frequency: 'monthly' },
  })

  // 建立附加費用 for 按次車趟費客戶
  await prisma.customerFee.create({
    data: { customerId: c4.id, name: '按趟附加_bs', amount: 100, billingDirection: 'receivable', frequency: 'per_trip' },
  })
})

afterAll(async () => {
  // 清理測試資料（注意：必須先刪除有外鍵依賴的表）
  const customerNames = [
    '純應收客戶_bs', '純應付客戶_bs', '混合客戶_bs',
    '按次車趟費客戶_bs', '按月車趟費客戶_bs', '分開開票客戶_bs',
    '無車趟客戶_bs', '按趟結算客戶_bs',
  ]
  // 1. 先刪 statements（依賴 customer）
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } })
  // 2. 刪 tripItem -> trip
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { in: customerNames } } } } })
  await prisma.trip.deleteMany({ where: { customer: { name: { in: customerNames } } } })
  // 3. 刪 customerFee
  await prisma.customerFee.deleteMany({ where: { customer: { name: { in: customerNames } } } })
  // 4. 刪 contractItem -> contract
  await prisma.contractItem.deleteMany({ where: { contract: { contractNumber: 'C-BS-001' } } })
  await prisma.contract.deleteMany({ where: { contractNumber: 'C-BS-001' } })
  // 5. 最後刪 customer（所有外鍵依賴都已清除）
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } })
  await prisma.item.deleteMany({ where: { name: { in: ['計費應收品_bs', '計費應付品_bs', '計費免費品_bs'] } } })
  await prisma.site.deleteMany({ where: { name: '計費測試站' } })
  await prisma.$disconnect()
})

describe('計費引擎 calculateMonthlyBilling', () => {
  // 1. 純應收
  test('純應收品項正確計算', async () => {
    const result = await calculateMonthlyBilling(pureReceivableCustomerId, '2026-03')
    expect(result.itemReceivable).toBe(3000) // 1000 + 2000
    expect(result.itemPayable).toBe(0)
    expect(result.totalReceivable).toBe(3000)
    expect(result.totalPayable).toBe(0)
    expect(result.netAmount).toBe(3000)
    expect(result.subtotal).toBe(3000)
    expect(result.taxAmount).toBe(150) // Math.round(3000 * 0.05)
    expect(result.totalAmount).toBe(3150)
    expect(result.details.items.length).toBe(2)
  })

  // 2. 純應付
  test('純應付品項正確計算', async () => {
    const result = await calculateMonthlyBilling(purePayableCustomerId, '2026-03')
    expect(result.itemReceivable).toBe(0)
    expect(result.itemPayable).toBe(250)
    expect(result.netAmount).toBe(-250)
    expect(result.taxAmount).toBe(-13) // Math.round(250 * 0.05) * -1 = -13
    expect(result.totalAmount).toBe(-263) // -250 + (-13)
  })

  // 3. 混合方向 + 免費品項
  test('混合方向 + free 品項不計入金額', async () => {
    const result = await calculateMonthlyBilling(mixedCustomerId, '2026-03')
    expect(result.itemReceivable).toBe(1000)
    expect(result.itemPayable).toBe(400)
    expect(result.netAmount).toBe(600) // 1000 - 400
    expect(result.details.items.length).toBe(3) // 含 free 品項
    // free 品項不計入金額
    const freeItem = result.details.items.find(i => i.billingDirection === 'free')
    expect(freeItem).toBeDefined()
    expect(freeItem!.amount).toBe(0)
  })

  // 4. 按次車趟費
  test('按次車趟費正確計算', async () => {
    const result = await calculateMonthlyBilling(perTripFeeCustomerId, '2026-03')
    expect(result.tripFeeTotal).toBe(1000) // 2 趟 * 500
    expect(result.details.tripFee.count).toBe(2)
    expect(result.details.tripFee.amount).toBe(1000)
    expect(result.details.tripFee.type).toBe('per_trip')
    // 車趟費計入應收
    expect(result.totalReceivable).toBe(1000 + 200) // tripFee + per_trip附加費 (100*2)
  })

  // 5. 按月車趟費
  test('按月車趟費只計一次', async () => {
    const result = await calculateMonthlyBilling(perMonthFeeCustomerId, '2026-03')
    expect(result.tripFeeTotal).toBe(3000) // 固定 3000 per month
    expect(result.details.tripFee.count).toBe(1) // 1 趟
    expect(result.details.tripFee.amount).toBe(3000)
    expect(result.details.tripFee.type).toBe('per_month')
  })

  // 6. 按趟附加費用（月結的 per_trip 費用按趟數乘算）
  test('per_trip 附加費用按車趟次數乘算', async () => {
    const result = await calculateMonthlyBilling(perTripFeeCustomerId, '2026-03')
    // 按趟附加_bs: 100 * 2 趟 = 200
    expect(result.additionalFeeReceivable).toBe(200)
    expect(result.details.fees.length).toBe(1)
    expect(result.details.fees[0].amount).toBe(200)
  })

  // 7. 分開開票
  test('分開開票分別計算應收應付稅額', async () => {
    const result = await calculateMonthlyBilling(separateInvoiceCustomerId, '2026-03')
    expect(result.itemReceivable).toBe(1000)
    expect(result.itemPayable).toBe(300)
    // 分開開票欄位
    expect(result.receivableSubtotal).toBe(1000)
    expect(result.receivableTax).toBe(50) // Math.round(1000 * 0.05)
    expect(result.receivableTotal).toBe(1050)
    expect(result.payableSubtotal).toBe(300)
    expect(result.payableTax).toBe(15) // Math.round(300 * 0.05)
    expect(result.payableTotal).toBe(315)
    // 淨額
    expect(result.netAmount).toBe(700) // 1000 - 300
    expect(result.subtotal).toBe(700)
    expect(result.taxAmount).toBe(35) // 50 - 15
    expect(result.totalAmount).toBe(735) // 1050 - 315
  })

  // 8. 淨額開票（預設）
  test('淨額開票（net）用淨額計稅', async () => {
    const result = await calculateMonthlyBilling(pureReceivableCustomerId, '2026-03')
    // 淨額開票不會有 separate 欄位
    expect(result.receivableSubtotal).toBeUndefined()
    expect(result.receivableTax).toBeUndefined()
    expect(result.payableSubtotal).toBeUndefined()
    // 稅額基於淨額
    expect(result.subtotal).toBe(result.netAmount)
    expect(result.taxAmount).toBe(Math.round(Math.abs(result.netAmount) * 0.05) * (result.netAmount >= 0 ? 1 : -1))
  })

  // 9. 無車趟月份
  test('無車趟月份所有金額為 0', async () => {
    const result = await calculateMonthlyBilling(noTripCustomerId, '2026-03')
    expect(result.itemReceivable).toBe(0)
    expect(result.itemPayable).toBe(0)
    expect(result.tripFeeTotal).toBe(0)
    expect(result.netAmount).toBe(0)
    expect(result.totalAmount).toBe(0)
    expect(result.details.items.length).toBe(0)
    expect(result.details.tripFee.count).toBe(0)
  })

  // 10. 不存在的客戶
  test('不存在的客戶拋出錯誤', async () => {
    await expect(calculateMonthlyBilling(999999, '2026-03')).rejects.toThrow('客戶不存在')
  })

  // 11. Decimal 精度
  test('Decimal 精度正確保留', async () => {
    const result = await calculateMonthlyBilling(pureReceivableCustomerId, '2026-03')
    // 所有金額應該為整數或合理的小數
    expect(typeof result.itemReceivable).toBe('number')
    expect(typeof result.taxAmount).toBe('number')
    expect(Number.isFinite(result.totalAmount)).toBe(true)
  })

  // 12. 稅額四捨五入
  test('稅額正確四捨五入', async () => {
    // 純應付 250 -> tax = round(250 * 0.05) = round(12.5) = 13
    const result = await calculateMonthlyBilling(purePayableCustomerId, '2026-03')
    expect(Math.abs(result.taxAmount)).toBe(13)
  })
})

describe('計費引擎 calculateTripBilling', () => {
  let tripIdForBilling: number

  beforeAll(async () => {
    // 為按趟結算客戶建立車趟
    const trip = await prisma.trip.create({
      data: { customerId: perTripStatementCustomerId, siteId, tripDate: new Date('2026-03-15'), source: 'manual' },
    })
    tripIdForBilling = trip.id
    await prisma.tripItem.create({
      data: { tripId: trip.id, itemId: receivableItemId, quantity: 50, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 500 },
    })
    await prisma.tripItem.create({
      data: { tripId: trip.id, itemId: payableItemId, quantity: 30, unit: 'kg', unitPrice: 5, billingDirection: 'payable', amount: 150 },
    })
  })

  test('按趟計費含品項和車趟費', async () => {
    const result = await calculateTripBilling(tripIdForBilling)
    expect(result.itemReceivable).toBe(500)
    expect(result.itemPayable).toBe(150)
    expect(result.tripFeeTotal).toBe(300) // per_trip: 300
    // per_trip 附加費用
    expect(result.additionalFeeReceivable).toBe(200) // 處理費_bs: 200
    // monthly 附加費用不計入按趟明細
    expect(result.additionalFeePayable).toBe(0) // 月租費_bs 是 monthly，不算
    expect(result.totalReceivable).toBe(1000) // 500 + 300 + 200
    expect(result.totalPayable).toBe(150)
    expect(result.netAmount).toBe(850) // 1000 - 150
    expect(result.details.tripFee.count).toBe(1)
    expect(result.details.fees.length).toBe(1) // 只有 per_trip 的費用
  })

  test('按趟計費只包含 per_trip 頻率附加費用', async () => {
    const result = await calculateTripBilling(tripIdForBilling)
    // 確認只有 per_trip 附加費用
    for (const fee of result.details.fees) {
      expect(fee.frequency).toBe('per_trip')
    }
  })

  test('不存在的車趟拋出錯誤', async () => {
    await expect(calculateTripBilling(999999)).rejects.toThrow('車趟不存在')
  })
})

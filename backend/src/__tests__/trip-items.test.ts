// backend/src/__tests__/trip-items.test.ts
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'

let token: string
let siteId: number
let contractedCustomerId: number
let temporaryCustomerId: number
let contractedTripId: number
let temporaryTripId: number
let itemId: number
let itemId2: number
let contractItemId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料（按 FK 依賴順序）
  const customerNames = ['簽約客戶_ti', '臨時客戶_ti']
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { in: customerNames } } } } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.contractItem.deleteMany({ where: { contract: { contractNumber: 'C-TI-TEST-001' } } }).catch(() => {})
  await prisma.contract.deleteMany({ where: { contractNumber: 'C-TI-TEST-001' } }).catch(() => {})
  await prisma.customerFee.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } }).catch(() => {})

  // 建立測試使用者
  const passwordHash = await bcrypt.hash('test1234', 10)
  await prisma.user.upsert({
    where: { username: 'test_ti' },
    update: { passwordHash },
    create: { username: 'test_ti', passwordHash, name: '品項測試員', role: 'super_admin' },
  })
  const res = await request(app).post('/api/auth/login').send({ username: 'test_ti', password: 'test1234' })
  token = res.body.token

  // 建立測試站區
  const site = await prisma.site.upsert({
    where: { name: '品項快照測試站' },
    update: {},
    create: { name: '品項快照測試站', status: 'active' },
  })
  siteId = site.id

  // 建立測試品項
  const item1 = await prisma.item.upsert({
    where: { name: '測試鐵_ti' },
    update: {},
    create: { name: '測試鐵_ti', unit: 'kg', category: '鐵類' },
  })
  itemId = item1.id

  const item2 = await prisma.item.upsert({
    where: { name: '測試銅_ti' },
    update: {},
    create: { name: '測試銅_ti', unit: 'kg', category: '五金類' },
  })
  itemId2 = item2.id

  // 建立簽約客戶
  const contracted = await prisma.customer.create({
    data: {
      siteId,
      name: '簽約客戶_ti',
      type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly',
      paymentType: 'lump_sum',
      invoiceRequired: false,
      notificationMethod: 'email',
    },
  })
  contractedCustomerId = contracted.id

  // 建立合約 + 合約品項（只有 item1）
  const contract = await prisma.contract.create({
    data: {
      customerId: contractedCustomerId,
      contractNumber: 'C-TI-TEST-001',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
    },
  })
  const ci = await prisma.contractItem.create({
    data: {
      contractId: contract.id,
      itemId,
      unitPrice: 8.5,
      billingDirection: 'payable',
    },
  })
  contractItemId = ci.id

  // 建立臨時客戶
  const temporary = await prisma.customer.create({
    data: {
      siteId,
      name: '臨時客戶_ti',
      type: 'temporary',
      tripFeeEnabled: false,
      statementType: 'per_trip',
      paymentType: 'lump_sum',
      invoiceRequired: false,
      notificationMethod: 'email',
    },
  })
  temporaryCustomerId = temporary.id

  // 建立簽約客戶的車趟
  const trip1 = await prisma.trip.create({
    data: {
      customerId: contractedCustomerId,
      siteId,
      tripDate: new Date('2026-04-01'),
      source: 'manual',
    },
  })
  contractedTripId = trip1.id

  // 建立臨時客戶的車趟
  const trip2 = await prisma.trip.create({
    data: {
      customerId: temporaryCustomerId,
      siteId,
      tripDate: new Date('2026-04-01'),
      source: 'manual',
    },
  })
  temporaryTripId = trip2.id
})

afterAll(async () => {
  // 清理測試資料（按 FK 依賴順序）
  const customerNames = ['簽約客戶_ti', '臨時客戶_ti']
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.tripItem.deleteMany({
    where: { trip: { customer: { name: { in: customerNames } } } },
  }).catch(() => {})
  await prisma.trip.deleteMany({
    where: { customer: { name: { in: customerNames } } },
  }).catch(() => {})
  await prisma.contractItem.deleteMany({ where: { id: contractItemId } }).catch(() => {})
  await prisma.contract.deleteMany({ where: { contractNumber: 'C-TI-TEST-001' } }).catch(() => {})
  await prisma.customerFee.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } }).catch(() => {})
  await prisma.item.deleteMany({ where: { name: { in: ['測試鐵_ti', '測試銅_ti'] } } }).catch(() => {})
  await prisma.site.deleteMany({ where: { name: '品項快照測試站' } }).catch(() => {})
  await prisma.user.deleteMany({ where: { username: 'test_ti' } }).catch(() => {})
  await prisma.$disconnect()
})

describe('車趟品項 /api/trips/:id/items', () => {
  let tripItemId: number

  // === 快照邏輯：簽約客戶自動帶入合約價 ===
  test('POST - 簽約客戶自動帶入合約單價和方向', async () => {
    const res = await request(app)
      .post(`/api/trips/${contractedTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId, quantity: 100 })
    expect(res.status).toBe(201)
    expect(Number(res.body.unitPrice)).toBe(8.5)
    expect(res.body.billingDirection).toBe('payable')
    expect(Number(res.body.amount)).toBe(850) // 8.5 * 100
    expect(res.body.unit).toBe('kg')
    expect(res.body.item).toBeDefined()
    tripItemId = res.body.id
  })

  // === 快照邏輯：簽約客戶合約無此品項需手動輸入 ===
  test('POST - 簽約客戶合約無此品項且未提供手動價格回傳 400', async () => {
    const res = await request(app)
      .post(`/api/trips/${contractedTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: itemId2, quantity: 50 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('手動輸入')
  })

  test('POST - 簽約客戶合約無此品項可手動輸入降級', async () => {
    const res = await request(app)
      .post(`/api/trips/${contractedTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: itemId2, quantity: 50, unitPrice: 120, billingDirection: 'payable' })
    expect(res.status).toBe(201)
    expect(Number(res.body.unitPrice)).toBe(120)
    expect(res.body.billingDirection).toBe('payable')
    expect(Number(res.body.amount)).toBe(6000) // 120 * 50
  })

  // === 臨時客戶須手動輸入 ===
  test('POST - 臨時客戶缺少手動價格回傳 400', async () => {
    const res = await request(app)
      .post(`/api/trips/${temporaryTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId, quantity: 30 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('手動輸入')
  })

  test('POST - 臨時客戶手動輸入成功', async () => {
    const res = await request(app)
      .post(`/api/trips/${temporaryTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId, quantity: 30, unitPrice: 7, billingDirection: 'receivable' })
    expect(res.status).toBe(201)
    expect(Number(res.body.unitPrice)).toBe(7)
    expect(res.body.billingDirection).toBe('receivable')
    expect(Number(res.body.amount)).toBe(210) // 7 * 30
  })

  // === free 方向金額為 0 ===
  test('POST - billingDirection=free 時金額為 0', async () => {
    const res = await request(app)
      .post(`/api/trips/${temporaryTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: itemId2, quantity: 20, unitPrice: 50, billingDirection: 'free' })
    expect(res.status).toBe(201)
    expect(Number(res.body.amount)).toBe(0)
    expect(res.body.billingDirection).toBe('free')
  })

  // === 驗證 billingDirection ===
  test('POST - 無效 billingDirection 回傳 400', async () => {
    const res = await request(app)
      .post(`/api/trips/${temporaryTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId, quantity: 10, unitPrice: 5, billingDirection: 'invalid' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('billingDirection')
  })

  // === 必填欄位 ===
  test('POST - 缺少必填欄位回傳 400', async () => {
    const res = await request(app)
      .post(`/api/trips/${contractedTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('必填')
  })

  // === 不存在的車趟 ===
  test('POST - 不存在的車趟回傳 404', async () => {
    const res = await request(app)
      .post('/api/trips/999999/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId, quantity: 10, unitPrice: 5, billingDirection: 'payable' })
    expect(res.status).toBe(404)
  })

  // === 不存在的品項 ===
  test('POST - 不存在的品項回傳 400', async () => {
    const res = await request(app)
      .post(`/api/trips/${temporaryTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: 999999, quantity: 10, unitPrice: 5, billingDirection: 'payable' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('品項不存在')
  })

  // === GET 列表 ===
  test('GET /api/trips/:id/items - 取得車趟品項列表', async () => {
    const res = await request(app)
      .get(`/api/trips/${contractedTripId}/items`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
    expect(res.body[0].item).toBeDefined()
  })

  test('GET /api/trips/:id/items - 不存在的車趟回傳 404', async () => {
    const res = await request(app)
      .get('/api/trips/999999/items')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  // === PATCH 更新 ===
  test('PATCH - 更新數量並重新計算金額', async () => {
    const res = await request(app)
      .patch(`/api/trips/${contractedTripId}/items/${tripItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 200 })
    expect(res.status).toBe(200)
    expect(Number(res.body.quantity)).toBe(200)
    expect(Number(res.body.amount)).toBe(1700) // 8.5 * 200
  })

  test('PATCH - 更新單價並重新計算金額', async () => {
    const res = await request(app)
      .patch(`/api/trips/${contractedTripId}/items/${tripItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unitPrice: 10 })
    expect(res.status).toBe(200)
    expect(Number(res.body.unitPrice)).toBe(10)
    expect(Number(res.body.amount)).toBe(2000) // 10 * 200
  })

  test('PATCH - 更新方向為 free 時金額變為 0', async () => {
    const res = await request(app)
      .patch(`/api/trips/${contractedTripId}/items/${tripItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ billingDirection: 'free' })
    expect(res.status).toBe(200)
    expect(Number(res.body.amount)).toBe(0)
  })

  test('PATCH - 無效 billingDirection 回傳 400', async () => {
    const res = await request(app)
      .patch(`/api/trips/${contractedTripId}/items/${tripItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ billingDirection: 'wrong' })
    expect(res.status).toBe(400)
  })

  test('PATCH - 不存在的品項回傳 404', async () => {
    const res = await request(app)
      .patch(`/api/trips/${contractedTripId}/items/999999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 50 })
    expect(res.status).toBe(404)
  })

  // === DELETE ===
  test('DELETE - 刪除車趟品項', async () => {
    const res = await request(app)
      .delete(`/api/trips/${contractedTripId}/items/${tripItemId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('已刪除')
  })

  test('DELETE - 不存在的品項回傳 404', async () => {
    const res = await request(app)
      .delete(`/api/trips/${contractedTripId}/items/999999`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

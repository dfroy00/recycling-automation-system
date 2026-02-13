// backend/src/__tests__/statements.test.ts
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'

// Mock 掉寄送服務，避免測試中真正寄信或產 PDF
// sendStatementEmail 原本會更新 statement 狀態，mock 中也需模擬此行為
jest.mock('../services/notification.service', () => {
  return {
    sendStatementEmail: jest.fn().mockImplementation(async (statementId: number) => {
      const prisma = require('../lib/prisma').default
      await prisma.statement.update({
        where: { id: statementId },
        data: { status: 'sent', sentAt: new Date(), sentMethod: 'email' },
      })
    }),
  }
})

let token: string
let userId: number
let siteId: number
let monthlyCustomerId: number
let invoiceCustomerId: number
let perTripCustomerId: number
let itemId: number
let tripId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料（按 FK 依賴順序）
  const customerNames = ['月結API客戶_stmts', '開票API客戶_stmts', '按趟API客戶_stmts']
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { in: customerNames } } } } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.customerFee.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } }).catch(() => {})

  // 建立測試使用者
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.upsert({
    where: { username: 'test_stmts' },
    update: { passwordHash },
    create: { username: 'test_stmts', passwordHash, name: '明細測試員', role: 'super_admin' },
  })
  userId = user.id
  const res = await request(app).post('/api/auth/login').send({ username: 'test_stmts', password: 'test1234' })
  token = res.body.token

  // 站區
  const site = await prisma.site.upsert({
    where: { name: '明細API測試站' },
    update: {},
    create: { name: '明細API測試站', status: 'active' },
  })
  siteId = site.id

  // 品項
  const item = await prisma.item.upsert({
    where: { name: '明細API品_stmts' },
    update: {},
    create: { name: '明細API品_stmts', unit: 'kg', category: '鐵類' },
  })
  itemId = item.id

  // 月結客戶（不需開票）
  const c1 = await prisma.customer.create({
    data: {
      siteId, name: '月結API客戶_stmts', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
      notificationEmail: 'monthly@test.com',
    },
  })
  monthlyCustomerId = c1.id

  // 月結客戶的車趟
  const trip1 = await prisma.trip.create({
    data: { customerId: c1.id, siteId, tripDate: new Date('2026-07-10'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip1.id, itemId, quantity: 100, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 1000 },
  })

  // 需開票月結客戶
  const c2 = await prisma.customer.create({
    data: {
      siteId, name: '開票API客戶_stmts', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: true, invoiceType: 'net',
      notificationMethod: 'email',
      notificationEmail: 'invoice@test.com',
    },
  })
  invoiceCustomerId = c2.id

  const trip2 = await prisma.trip.create({
    data: { customerId: c2.id, siteId, tripDate: new Date('2026-07-12'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip2.id, itemId, quantity: 50, unit: 'kg', unitPrice: 8, billingDirection: 'payable', amount: 400 },
  })

  // 按趟客戶
  const c3 = await prisma.customer.create({
    data: {
      siteId, name: '按趟API客戶_stmts', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'per_trip', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
      notificationEmail: 'pertrip@test.com',
    },
  })
  perTripCustomerId = c3.id

  const trip3 = await prisma.trip.create({
    data: { customerId: c3.id, siteId, tripDate: new Date('2026-07-20'), source: 'manual' },
  })
  tripId = trip3.id
  await prisma.tripItem.create({
    data: { tripId: trip3.id, itemId, quantity: 30, unit: 'kg', unitPrice: 12, billingDirection: 'receivable', amount: 360 },
  })
})

afterAll(async () => {
  const customerNames = ['月結API客戶_stmts', '開票API客戶_stmts', '按趟API客戶_stmts']
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } })
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { in: customerNames } } } } })
  await prisma.trip.deleteMany({ where: { customer: { name: { in: customerNames } } } })
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } })
  await prisma.item.deleteMany({ where: { name: '明細API品_stmts' } })
  await prisma.site.deleteMany({ where: { name: '明細API測試站' } })
  await prisma.user.deleteMany({ where: { username: 'test_stmts' } })
  await prisma.$disconnect()
})

describe('明細 API /api/statements', () => {
  let statementId: number
  let invoiceStatementId: number
  let perTripStatementId: number

  // === 產出 ===
  test('POST /generate - 產出單一客戶月結明細', async () => {
    const res = await request(app)
      .post('/api/statements/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ yearMonth: '2026-07', customerId: monthlyCustomerId })
    expect(res.status).toBe(201)
    expect(res.body.customerId).toBe(monthlyCustomerId)
    expect(res.body.statementType).toBe('monthly')
    expect(res.body.status).toBe('draft')
    statementId = res.body.id
  })

  test('POST /generate - 產出需開票客戶明細', async () => {
    const res = await request(app)
      .post('/api/statements/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ yearMonth: '2026-07', customerId: invoiceCustomerId })
    expect(res.status).toBe(201)
    invoiceStatementId = res.body.id
  })

  test('POST /generate - 缺少 yearMonth 回傳 400', async () => {
    const res = await request(app)
      .post('/api/statements/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('yearMonth')
  })

  test('POST /generate-trip - 產出按趟明細', async () => {
    const res = await request(app)
      .post('/api/statements/generate-trip')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId })
    expect(res.status).toBe(201)
    expect(res.body.statementType).toBe('per_trip')
    expect(res.body.tripId).toBe(tripId)
    perTripStatementId = res.body.id
  })

  test('POST /generate-trip - 缺少 tripId 回傳 400', async () => {
    const res = await request(app)
      .post('/api/statements/generate-trip')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  test('POST /generate-trip - 重複產出回傳 400', async () => {
    const res = await request(app)
      .post('/api/statements/generate-trip')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('已有明細')
  })

  // === 查詢 ===
  test('GET / - 取得明細列表（分頁格式）', async () => {
    const res = await request(app)
      .get('/api/statements')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.pagination).toBeDefined()
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  test('GET /?yearMonth&customerId - 篩選', async () => {
    const res = await request(app)
      .get(`/api/statements?yearMonth=2026-07&customerId=${monthlyCustomerId}&all=true`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
    res.body.forEach((s: any) => {
      expect(s.yearMonth).toBe('2026-07')
      expect(s.customerId).toBe(monthlyCustomerId)
    })
  })

  test('GET /:id - 取得單一明細', async () => {
    const res = await request(app)
      .get(`/api/statements/${statementId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(statementId)
    expect(res.body.customer).toBeDefined()
  })

  test('GET /:id - 不存在回傳 404', async () => {
    const res = await request(app)
      .get('/api/statements/999999')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  // === 審核流程 ===
  test('PATCH /:id/review - 審核通過', async () => {
    const res = await request(app)
      .patch(`/api/statements/${statementId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
    expect(res.body.reviewedBy).toBe(userId)
    expect(res.body.reviewedAt).toBeDefined()
  })

  test('PATCH /:id/review - 已審核的不可再審', async () => {
    const res = await request(app)
      .patch(`/api/statements/${statementId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'reject' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('草稿')
  })

  test('PATCH /:id/review - 無效 action 回傳 400', async () => {
    const res = await request(app)
      .patch(`/api/statements/${perTripStatementId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'invalid' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('approve')
  })

  test('PATCH /:id/review - 審核駁回', async () => {
    const res = await request(app)
      .patch(`/api/statements/${perTripStatementId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'reject' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('rejected')
  })

  // === 標記開票 ===
  test('PATCH /:id/invoice - 標記開票', async () => {
    // statementId 已 approved
    const res = await request(app)
      .patch(`/api/statements/${statementId}/invoice`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('invoiced')
  })

  test('PATCH /:id/invoice - 非 approved 不可開票', async () => {
    // invoiceStatementId 仍是 draft
    const res = await request(app)
      .patch(`/api/statements/${invoiceStatementId}/invoice`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('已審核')
  })

  // === 寄送 ===
  test('POST /:id/send - 不需開票客戶 approved 即可寄送', async () => {
    // 先 approve invoiceCustomer（需開票）的明細
    await request(app)
      .patch(`/api/statements/${invoiceStatementId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve' })

    // statementId 已 invoiced，不需開票客戶 -> 可以寄送
    const res = await request(app)
      .post(`/api/statements/${statementId}/send`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('sent')
    expect(res.body.sentAt).toBeDefined()
  })

  test('POST /:id/send - 需開票客戶 approved 但未 invoiced 不可寄送', async () => {
    // invoiceStatementId 已 approved 但未 invoiced
    const res = await request(app)
      .post(`/api/statements/${invoiceStatementId}/send`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('不允許')
  })

  test('POST /:id/send - 需開票客戶 invoiced 後可寄送', async () => {
    // 先標記開票
    await request(app)
      .patch(`/api/statements/${invoiceStatementId}/invoice`)
      .set('Authorization', `Bearer ${token}`)
    // 再寄送
    const res = await request(app)
      .post(`/api/statements/${invoiceStatementId}/send`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('sent')
  })

  // === 作廢 ===
  test('POST /:id/void - 作廢已寄送明細', async () => {
    // statementId 已 sent
    const res = await request(app)
      .post(`/api/statements/${statementId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '測試作廢' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('voided')
    expect(res.body.voidReason).toBe('測試作廢')
    expect(res.body.voidedBy).toBe(userId)
    expect(res.body.voidedAt).toBeDefined()
  })

  test('POST /:id/void - 缺少作廢原因回傳 400', async () => {
    const res = await request(app)
      .post(`/api/statements/${invoiceStatementId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('作廢原因')
  })

  test('POST /:id/void - draft 狀態不可作廢', async () => {
    // perTripStatementId 已 rejected，建立新的 draft
    const newTrip = await prisma.trip.create({
      data: { customerId: perTripCustomerId, siteId, tripDate: new Date('2026-07-25'), source: 'manual' },
    })
    await prisma.tripItem.create({
      data: { tripId: newTrip.id, itemId, quantity: 10, unit: 'kg', unitPrice: 5, billingDirection: 'receivable', amount: 50 },
    })
    const gen = await request(app)
      .post('/api/statements/generate-trip')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId: newTrip.id })

    const res = await request(app)
      .post(`/api/statements/${gen.body.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '不應成功' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('已寄送或已開票')
  })

  // === 認證 ===
  test('未認證存取回傳 401', async () => {
    const res = await request(app).get('/api/statements')
    expect(res.status).toBe(401)
  })
})

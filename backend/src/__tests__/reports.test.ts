// backend/src/__tests__/reports.test.ts
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'

let token: string
let siteId: number
let customerId: number
let statementId: number
let itemId: number

beforeAll(async () => {
  // 建立測試使用者
  const passwordHash = await bcrypt.hash('test1234', 10)
  await prisma.user.upsert({
    where: { username: 'test_reports' },
    update: { passwordHash },
    create: { username: 'test_reports', passwordHash, name: '報表測試員', role: 'super_admin' },
  })
  const res = await request(app).post('/api/auth/login').send({ username: 'test_reports', password: 'test1234' })
  token = res.body.token

  // 站區
  const site = await prisma.site.upsert({
    where: { name: '報表測試站' },
    update: {},
    create: { name: '報表測試站', status: 'active' },
  })
  siteId = site.id

  // 品項
  const item = await prisma.item.upsert({
    where: { name: '報表測試品_rpt' },
    update: {},
    create: { name: '報表測試品_rpt', unit: 'kg', category: '鐵類' },
  })
  itemId = item.id

  // 客戶
  const customer = await prisma.customer.create({
    data: {
      siteId, name: '報表客戶_rpt', type: 'contracted',
      tripFeeEnabled: false,
      statementType: 'monthly', paymentType: 'lump_sum',
      invoiceRequired: false, notificationMethod: 'email',
    },
  })
  customerId = customer.id

  // 車趟 + 品項
  const trip = await prisma.trip.create({
    data: { customerId, siteId, tripDate: new Date('2026-08-10'), source: 'manual' },
  })
  await prisma.tripItem.create({
    data: { tripId: trip.id, itemId, quantity: 100, unit: 'kg', unitPrice: 10, billingDirection: 'receivable', amount: 1000 },
  })

  // 產出明細（供 PDF 報表使用）
  const stmt = await prisma.statement.create({
    data: {
      customerId,
      statementType: 'monthly',
      yearMonth: '2026-08',
      itemReceivable: 1000,
      itemPayable: 0,
      tripFeeTotal: 0,
      additionalFeeReceivable: 0,
      additionalFeePayable: 0,
      totalReceivable: 1000,
      totalPayable: 0,
      netAmount: 1000,
      subtotal: 1000,
      taxAmount: 50,
      totalAmount: 1050,
      detailJson: { items: [], tripFee: { count: 1, amount: 0, type: null }, fees: [] },
      status: 'approved',
    },
  })
  statementId = stmt.id
})

afterAll(async () => {
  await prisma.statement.deleteMany({ where: { customer: { name: '報表客戶_rpt' } } })
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: '報表客戶_rpt' } } } })
  await prisma.trip.deleteMany({ where: { customer: { name: '報表客戶_rpt' } } })
  await prisma.customer.deleteMany({ where: { name: '報表客戶_rpt' } })
  await prisma.item.deleteMany({ where: { name: '報表測試品_rpt' } })
  await prisma.site.deleteMany({ where: { name: '報表測試站' } })
  await prisma.user.deleteMany({ where: { username: 'test_reports' } })
  await prisma.$disconnect()
})

describe('報表 API /api/reports', () => {
  // === PDF 報表 ===
  test('GET /customers/:customerId?yearMonth - 產出客戶 PDF', async () => {
    const res = await request(app)
      .get(`/api/reports/customers/${customerId}?yearMonth=2026-08`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['content-disposition']).toContain('.pdf')
    expect(res.body).toBeInstanceOf(Buffer)
    expect(res.body.length).toBeGreaterThan(0)
  })

  test('GET /customers/:customerId - 缺少 yearMonth 回傳 400', async () => {
    const res = await request(app)
      .get(`/api/reports/customers/${customerId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('yearMonth')
  })

  test('GET /customers/:customerId - 不存在客戶回傳 400', async () => {
    const res = await request(app)
      .get('/api/reports/customers/999999?yearMonth=2026-08')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  test('GET /statements/:statementId/pdf - 從明細產出 PDF', async () => {
    const res = await request(app)
      .get(`/api/reports/statements/${statementId}/pdf`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.body.length).toBeGreaterThan(0)
  })

  test('GET /statements/:statementId/pdf - 不存在明細回傳 400', async () => {
    const res = await request(app)
      .get('/api/reports/statements/999999/pdf')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  // === Excel 報表 ===
  test('GET /sites/:siteId?yearMonth - 產出站區 Excel', async () => {
    const res = await request(app)
      .get(`/api/reports/sites/${siteId}?yearMonth=2026-08`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => callback(null, Buffer.concat(chunks)))
      })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')
    expect(res.headers['content-disposition']).toContain('.xlsx')
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  test('GET /sites/:siteId - 缺少 yearMonth 回傳 400', async () => {
    const res = await request(app)
      .get(`/api/reports/sites/${siteId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('yearMonth')
  })

  // === 認證 ===
  test('未認證存取回傳 401', async () => {
    const res = await request(app).get(`/api/reports/customers/${customerId}?yearMonth=2026-08`)
    expect(res.status).toBe(401)
  })
})

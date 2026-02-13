// backend/src/__tests__/customer-fees.test.ts
// 客戶附加費用 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number
let testSiteId: number
let monthlyCustomerId: number
let perTripCustomerId: number
let createdFeeId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料
  const customerNames = ['月結客戶_fees', '按趟客戶_fees']
  await prisma.customerFee.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.statement.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { in: customerNames } } } } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { customer: { name: { in: customerNames } } } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: { in: customerNames } } }).catch(() => {})
  await prisma.site.deleteMany({ where: { name: '費用測試站_fees' } }).catch(() => {})
  await prisma.user.deleteMany({ where: { username: 'fees_test_user' } }).catch(() => {})

  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'fees_test_user',
      passwordHash,
      name: '費用測試使用者',
      role: 'admin',
    },
  })
  testUserId = user.id

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'fees_test_user', password: 'test1234' })
  token = loginRes.body.token

  // 建立測試站區
  const site = await prisma.site.create({
    data: { name: '費用測試站_fees', status: 'active' },
  })
  testSiteId = site.id

  // 建立月結客戶
  const mc = await prisma.customer.create({
    data: {
      siteId: testSiteId,
      name: '月結客戶_fees',
      type: 'contracted',
      statementType: 'monthly',
      notificationMethod: 'email',
    },
  })
  monthlyCustomerId = mc.id

  // 建立按趟結算客戶
  const ptc = await prisma.customer.create({
    data: {
      siteId: testSiteId,
      name: '按趟客戶_fees',
      type: 'contracted',
      statementType: 'per_trip',
      paymentType: 'lump_sum',
      notificationMethod: 'email',
    },
  })
  perTripCustomerId = ptc.id
})

afterAll(async () => {
  // 清理測試資料
  await prisma.customerFee.deleteMany({
    where: { customerId: { in: [monthlyCustomerId, perTripCustomerId] } },
  }).catch(() => {})
  await prisma.customer.deleteMany({
    where: { id: { in: [monthlyCustomerId, perTripCustomerId] } },
  }).catch(() => {})
  await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {})
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/customers/:id/fees', () => {
  it('新增附加費用成功', async () => {
    const res = await request(app)
      .post(`/api/customers/${monthlyCustomerId}/fees`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '處理費',
        amount: 500,
        billingDirection: 'receivable',
        frequency: 'monthly',
      })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: '處理費',
      billingDirection: 'receivable',
      frequency: 'monthly',
      customerId: monthlyCustomerId,
    })
    createdFeeId = res.body.id
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post(`/api/customers/${monthlyCustomerId}/fees`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '只有名稱' })

    expect(res.status).toBe(400)
  })

  it('billingDirection 無效應回傳 400', async () => {
    const res = await request(app)
      .post(`/api/customers/${monthlyCustomerId}/fees`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '無效方向',
        amount: 100,
        billingDirection: 'invalid',
        frequency: 'monthly',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/billingDirection/)
  })

  it('frequency 無效應回傳 400', async () => {
    const res = await request(app)
      .post(`/api/customers/${monthlyCustomerId}/fees`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '無效頻率',
        amount: 100,
        billingDirection: 'receivable',
        frequency: 'yearly',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/frequency/)
  })

  it('按趟結算客戶不能建立 monthly 頻率的附加費用', async () => {
    const res = await request(app)
      .post(`/api/customers/${perTripCustomerId}/fees`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '不允許的月費',
        amount: 200,
        billingDirection: 'receivable',
        frequency: 'monthly',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/按趣/)
  })

  it('按趟結算客戶可建立 per_trip 頻率的附加費用', async () => {
    const res = await request(app)
      .post(`/api/customers/${perTripCustomerId}/fees`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '按趟附加費',
        amount: 150,
        billingDirection: 'payable',
        frequency: 'per_trip',
      })

    expect(res.status).toBe(201)
    expect(res.body.frequency).toBe('per_trip')
  })

  it('客戶不存在應回傳 404', async () => {
    const res = await request(app)
      .post('/api/customers/999999/fees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '找不到客戶',
        amount: 100,
        billingDirection: 'receivable',
        frequency: 'monthly',
      })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/customers/:id/fees', () => {
  it('列出客戶的附加費用', async () => {
    const res = await request(app)
      .get(`/api/customers/${monthlyCustomerId}/fees`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })

  it('客戶不存在時回傳空陣列', async () => {
    const res = await request(app)
      .get('/api/customers/999999/fees')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(0)
  })
})

describe('PATCH /api/customers/:cid/fees/:fid', () => {
  it('更新附加費用成功', async () => {
    const res = await request(app)
      .patch(`/api/customers/${monthlyCustomerId}/fees/${createdFeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 800 })

    expect(res.status).toBe(200)
    // Decimal 可能是 string 或 number，取決於 Prisma 版本
    expect(Number(res.body.amount)).toBe(800)
  })

  it('更新不存在的附加費用應回傳 404', async () => {
    const res = await request(app)
      .patch(`/api/customers/${monthlyCustomerId}/fees/999999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/customers/:cid/fees/:fid', () => {
  it('軟刪除附加費用（狀態改為 inactive）', async () => {
    const res = await request(app)
      .delete(`/api/customers/${monthlyCustomerId}/fees/${createdFeeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // 確認狀態
    const fee = await prisma.customerFee.findUnique({ where: { id: createdFeeId } })
    expect(fee!.status).toBe('inactive')
  })

  it('刪除不存在的附加費用應回傳 404', async () => {
    const res = await request(app)
      .delete(`/api/customers/${monthlyCustomerId}/fees/999999`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

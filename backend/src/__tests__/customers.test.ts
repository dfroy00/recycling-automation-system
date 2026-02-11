// backend/src/__tests__/customers.test.ts
// 客戶 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number
let testSiteId: number
let createdCustomerId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料
  await prisma.customerFee.deleteMany({ where: { customer: { name: { startsWith: '簽約客戶_cust' } } } }).catch(() => {})
  await prisma.statement.deleteMany({ where: { customer: { name: { startsWith: '簽約客戶_cust' } } } }).catch(() => {})
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: { startsWith: '簽約客戶_cust' } } } } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { customer: { name: { startsWith: '簽約客戶_cust' } } } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: { startsWith: '簽約客戶_cust' } } }).catch(() => {})
  await prisma.site.deleteMany({ where: { name: '客戶測試站_cust' } }).catch(() => {})
  await prisma.user.deleteMany({ where: { username: 'customers_test_user' } }).catch(() => {})

  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'customers_test_user',
      passwordHash,
      name: '客戶測試使用者',
      role: 'admin',
    },
  })
  testUserId = user.id

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'customers_test_user', password: 'test1234' })
  token = loginRes.body.token

  // 建立測試站區
  const site = await prisma.site.create({
    data: { name: '客戶測試站_cust', status: 'active' },
  })
  testSiteId = site.id
})

afterAll(async () => {
  // 清理測試資料（順序很重要，先刪子資料）
  if (createdCustomerId) {
    await prisma.customerFee.deleteMany({ where: { customerId: createdCustomerId } }).catch(() => {})
    await prisma.customer.delete({ where: { id: createdCustomerId } }).catch(() => {})
  }
  await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {})
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/customers', () => {
  it('新增簽約客戶成功', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        siteId: testSiteId,
        name: '測試客戶_cust',
        type: 'contracted',
        contactPerson: '測試人',
        phone: '02-9999999',
        tripFeeEnabled: true,
        tripFeeType: 'per_trip',
        tripFeeAmount: 300,
        notificationMethod: 'email',
        notificationEmail: 'test@example.com',
      })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: '測試客戶_cust',
      type: 'contracted',
      tripFeeEnabled: true,
      tripFeeType: 'per_trip',
    })
    expect(res.body.site).toMatchObject({ id: testSiteId })
    createdCustomerId = res.body.id
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '只有名稱' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('type 值無效應回傳 400', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ siteId: testSiteId, name: '無效類型', type: 'invalid' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/type/)
  })

  it('啟用車趟費但缺少類型/金額應回傳 400', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        siteId: testSiteId,
        name: '車趟費缺欄位',
        type: 'contracted',
        tripFeeEnabled: true,
        // 故意不給 tripFeeType, tripFeeAmount
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/車趣費/)
  })

  it('statementType=per_trip 時 paymentType 自動為 lump_sum', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        siteId: testSiteId,
        name: '按趟結算客戶_test',
        type: 'temporary',
        statementType: 'per_trip',
        paymentType: 'per_trip', // 應被覆蓋
      })

    expect(res.status).toBe(201)
    expect(res.body.statementType).toBe('per_trip')
    expect(res.body.paymentType).toBe('lump_sum')

    // 清理
    await prisma.customer.delete({ where: { id: res.body.id } }).catch(() => {})
  })
})

describe('GET /api/customers', () => {
  it('列出所有客戶', async () => {
    const res = await request(app)
      .get('/api/customers?all=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const found = res.body.find((c: any) => c.id === createdCustomerId)
    expect(found).toBeDefined()
    // 應包含 site 資訊
    expect(found.site).toBeDefined()
  })

  it('依站區篩選客戶', async () => {
    const res = await request(app)
      .get(`/api/customers?siteId=${testSiteId}&all=true`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    res.body.forEach((c: any) => {
      expect(c.siteId).toBe(testSiteId)
    })
  })

  it('依類型篩選客戶', async () => {
    const res = await request(app)
      .get('/api/customers?type=contracted&all=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    res.body.forEach((c: any) => {
      expect(c.type).toBe('contracted')
    })
  })
})

describe('GET /api/customers/:id', () => {
  it('取得單一客戶（含附加費用）', async () => {
    const res = await request(app)
      .get(`/api/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdCustomerId)
    expect(res.body).toHaveProperty('fees')
    expect(Array.isArray(res.body.fees)).toBe(true)
  })

  it('不存在的 ID 應回傳 404', async () => {
    const res = await request(app)
      .get('/api/customers/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/customers/:id', () => {
  it('更新客戶成功', async () => {
    const res = await request(app)
      .patch(`/api/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contactPerson: '更新後聯絡人' })

    expect(res.status).toBe(200)
    expect(res.body.contactPerson).toBe('更新後聯絡人')
  })

  it('更新不存在的客戶應回傳 404', async () => {
    const res = await request(app)
      .patch('/api/customers/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '不會成功' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/customers/:id', () => {
  it('軟刪除客戶（狀態改為 inactive）', async () => {
    const res = await request(app)
      .delete(`/api/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 確認狀態
    const check = await request(app)
      .get(`/api/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.body.status).toBe('inactive')
  })

  it('刪除不存在的客戶應回傳 404', async () => {
    const res = await request(app)
      .delete('/api/customers/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('認證保護', () => {
  it('無 token 存取客戶應回傳 401', async () => {
    const res = await request(app).get('/api/customers')
    expect(res.status).toBe(401)
  })
})

// backend/src/__tests__/trips.test.ts
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'

let token: string
let siteId: number
let customerId: number

beforeAll(async () => {
  // 建立測試使用者
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.upsert({
    where: { username: 'test_trips' },
    update: { passwordHash },
    create: { username: 'test_trips', passwordHash, name: '車趟測試員', role: 'admin' },
  })

  // 登入取得 token
  const res = await request(app).post('/api/auth/login').send({ username: 'test_trips', password: 'test1234' })
  token = res.body.token

  // 建立測試站區
  const site = await prisma.site.upsert({
    where: { name: '車趟測試站' },
    update: {},
    create: { name: '車趟測試站', status: 'active' },
  })
  siteId = site.id

  // 建立測試客戶
  const customer = await prisma.customer.create({
    data: {
      siteId,
      name: '車趟測試客戶_trips',
      type: 'temporary',
      tripFeeEnabled: false,
      statementType: 'per_trip',
      paymentType: 'lump_sum',
      invoiceRequired: false,
      notificationMethod: 'email',
    },
  })
  customerId = customer.id
})

afterAll(async () => {
  // 清理測試資料（反向依賴順序）
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: '車趟測試客戶_trips' } } } })
  await prisma.trip.deleteMany({ where: { customer: { name: '車趟測試客戶_trips' } } })
  await prisma.customer.deleteMany({ where: { name: '車趟測試客戶_trips' } })
  await prisma.site.deleteMany({ where: { name: '車趟測試站' } })
  await prisma.user.deleteMany({ where: { username: 'test_trips' } })
  await prisma.$disconnect()
})

describe('車趟 CRUD /api/trips', () => {
  let tripId: number

  test('POST /api/trips - 建立車趟', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        siteId,
        tripDate: '2026-03-01',
        tripTime: '08:30',
        driver: '張三',
        vehiclePlate: 'ABC-1234',
        notes: '測試車趟',
      })
    expect(res.status).toBe(201)
    expect(res.body.customerId).toBe(customerId)
    expect(res.body.siteId).toBe(siteId)
    expect(res.body.driver).toBe('張三')
    expect(res.body.vehiclePlate).toBe('ABC-1234')
    expect(res.body.source).toBe('manual')
    expect(res.body.customer).toBeDefined()
    expect(res.body.site).toBeDefined()
    tripId = res.body.id
  })

  test('POST /api/trips - 缺少必填欄位回傳 400', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('必填')
  })

  test('POST /api/trips - 不存在的客戶回傳 400', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: 999999, siteId, tripDate: '2026-03-01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('不存在')
  })

  test('GET /api/trips - 取得全部車趟（分頁格式）', async () => {
    const res = await request(app)
      .get('/api/trips')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.pagination).toBeDefined()
    expect(Array.isArray(res.body.data)).toBe(true)
    const found = res.body.data.find((t: any) => t.id === tripId)
    expect(found).toBeDefined()
    expect(found.items).toBeDefined()
  })

  test('GET /api/trips?all=true - 取得全部車趟（不分頁）', async () => {
    const res = await request(app)
      .get('/api/trips?all=true')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  test('GET /api/trips?customerId - 依客戶篩選', async () => {
    const res = await request(app)
      .get(`/api/trips?customerId=${customerId}&all=true`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    res.body.forEach((t: any) => {
      expect(t.customerId).toBe(customerId)
    })
  })

  test('GET /api/trips?siteId - 依站區篩選', async () => {
    const res = await request(app)
      .get(`/api/trips?siteId=${siteId}&all=true`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    res.body.forEach((t: any) => {
      expect(t.siteId).toBe(siteId)
    })
  })

  test('GET /api/trips?dateFrom&dateTo - 依日期範圍篩選', async () => {
    const res = await request(app)
      .get('/api/trips?dateFrom=2026-03-01&dateTo=2026-03-31&all=true')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  test('GET /api/trips/:id - 取得單一車趟', async () => {
    const res = await request(app)
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(tripId)
    expect(res.body.customer).toBeDefined()
    expect(res.body.site).toBeDefined()
    expect(res.body.items).toBeDefined()
  })

  test('GET /api/trips/:id - 不存在的車趟回傳 404', async () => {
    const res = await request(app)
      .get('/api/trips/999999')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  test('PATCH /api/trips/:id - 更新車趟', async () => {
    const res = await request(app)
      .patch(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ driver: '李四', notes: '已更新' })
    expect(res.status).toBe(200)
    expect(res.body.driver).toBe('李四')
    expect(res.body.notes).toBe('已更新')
  })

  test('PATCH /api/trips/:id - 不存在的車趟回傳 404', async () => {
    const res = await request(app)
      .patch('/api/trips/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ driver: '王五' })
    expect(res.status).toBe(404)
  })

  test('DELETE /api/trips/:id - 刪除車趟', async () => {
    const res = await request(app)
      .delete(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('已刪除')

    // 確認已刪除
    const check = await request(app)
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.status).toBe(404)
  })

  test('DELETE /api/trips/:id - 不存在的車趟回傳 404', async () => {
    const res = await request(app)
      .delete('/api/trips/999999')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  test('未認證存取回傳 401', async () => {
    const res = await request(app).get('/api/trips')
    expect(res.status).toBe(401)
  })
})

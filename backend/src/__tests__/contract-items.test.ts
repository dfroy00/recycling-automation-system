// backend/src/__tests__/contract-items.test.ts
// 合約品項 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number
let testSiteId: number
let testCustomerId: number
let testContractId: number
let testItemId: number
let createdContractItemId: number

beforeAll(async () => {
  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'ci_test_user',
      passwordHash,
      name: '合約品項測試使用者',
      role: 'admin',
    },
  })
  testUserId = user.id

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'ci_test_user', password: 'test1234' })
  token = loginRes.body.token

  // 建立測試站區
  const site = await prisma.site.create({
    data: { name: '合約品項測試站_ci', status: 'active' },
  })
  testSiteId = site.id

  // 建立測試客戶
  const customer = await prisma.customer.create({
    data: {
      siteId: testSiteId,
      name: '合約品項測試客戶_ci',
      type: 'contracted',
      notificationMethod: 'email',
    },
  })
  testCustomerId = customer.id

  // 建立測試合約
  const contract = await prisma.contract.create({
    data: {
      customerId: testCustomerId,
      contractNumber: 'TEST-CI-001',
      startDate: new Date('2099-01-01'),
      endDate: new Date('2099-12-31'),
      status: 'active',
    },
  })
  testContractId = contract.id

  // 建立測試品項
  const item = await prisma.item.create({
    data: { name: '合約品項測試品項_ci', unit: 'kg', category: '測試' },
  })
  testItemId = item.id
})

afterAll(async () => {
  // 清理測試資料（順序很重要）
  await prisma.contractItem.deleteMany({ where: { contractId: testContractId } }).catch(() => {})
  await prisma.contract.delete({ where: { id: testContractId } }).catch(() => {})
  await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {})
  await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {})
  await prisma.item.delete({ where: { id: testItemId } }).catch(() => {})
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/contracts/:id/items', () => {
  it('新增合約品項成功', async () => {
    const res = await request(app)
      .post(`/api/contracts/${testContractId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: testItemId,
        unitPrice: 5.5,
        billingDirection: 'receivable',
      })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      contractId: testContractId,
      itemId: testItemId,
      billingDirection: 'receivable',
    })
    expect(res.body.item).toMatchObject({ id: testItemId })
    createdContractItemId = res.body.id
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post(`/api/contracts/${testContractId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: testItemId })

    expect(res.status).toBe(400)
  })

  it('billingDirection 無效應回傳 400', async () => {
    const res = await request(app)
      .post(`/api/contracts/${testContractId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: testItemId,
        unitPrice: 3,
        billingDirection: 'invalid',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/billingDirection/)
  })

  it('合約不存在應回傳 404', async () => {
    const res = await request(app)
      .post('/api/contracts/999999/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: testItemId,
        unitPrice: 3,
        billingDirection: 'payable',
      })

    expect(res.status).toBe(404)
  })

  it('billingDirection 可為 free', async () => {
    const res = await request(app)
      .post(`/api/contracts/${testContractId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: testItemId,
        unitPrice: 0,
        billingDirection: 'free',
      })

    expect(res.status).toBe(201)
    expect(res.body.billingDirection).toBe('free')

    // 清理
    await prisma.contractItem.delete({ where: { id: res.body.id } }).catch(() => {})
  })
})

describe('GET /api/contracts/:id/items', () => {
  it('列出合約品項', async () => {
    const res = await request(app)
      .get(`/api/contracts/${testContractId}/items`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
    // 每個品項應含有 item 資訊
    res.body.forEach((ci: any) => {
      expect(ci.item).toBeDefined()
      expect(ci.item).toHaveProperty('name')
      expect(ci.item).toHaveProperty('unit')
    })
  })

  it('合約不存在應回傳 404', async () => {
    const res = await request(app)
      .get('/api/contracts/999999/items')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/contracts/:cid/items/:iid', () => {
  it('更新合約品項成功', async () => {
    const res = await request(app)
      .patch(`/api/contracts/${testContractId}/items/${createdContractItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unitPrice: 8.0, billingDirection: 'payable' })

    expect(res.status).toBe(200)
    expect(Number(res.body.unitPrice)).toBe(8)
    expect(res.body.billingDirection).toBe('payable')
  })

  it('更新不存在的合約品項應回傳 404', async () => {
    const res = await request(app)
      .patch(`/api/contracts/${testContractId}/items/999999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unitPrice: 10 })

    expect(res.status).toBe(404)
  })

  it('billingDirection 無效應回傳 400', async () => {
    const res = await request(app)
      .patch(`/api/contracts/${testContractId}/items/${createdContractItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ billingDirection: 'wrong' })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/contracts/:cid/items/:iid', () => {
  it('刪除合約品項（硬刪除）', async () => {
    const res = await request(app)
      .delete(`/api/contracts/${testContractId}/items/${createdContractItemId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // 確認已刪除
    const check = await prisma.contractItem.findUnique({ where: { id: createdContractItemId } })
    expect(check).toBeNull()
  })

  it('刪除不存在的合約品項應回傳 404', async () => {
    const res = await request(app)
      .delete(`/api/contracts/${testContractId}/items/999999`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('認證保護', () => {
  it('無 token 存取合約品項應回傳 401', async () => {
    const res = await request(app).get(`/api/contracts/${testContractId}/items`)
    expect(res.status).toBe(401)
  })
})

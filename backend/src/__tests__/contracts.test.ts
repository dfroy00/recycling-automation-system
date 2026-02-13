// backend/src/__tests__/contracts.test.ts
// 合約 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number
let testSiteId: number
let testCustomerId: number
let createdContractId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料（按 FK 依賴順序）
  await prisma.contractItem.deleteMany({ where: { contract: { contractNumber: 'TEST-CONTRACT-001' } } }).catch(() => {})
  await prisma.contract.deleteMany({ where: { contractNumber: 'TEST-CONTRACT-001' } }).catch(() => {})
  await prisma.statement.deleteMany({ where: { customer: { name: '合約測試客戶_contract' } } }).catch(() => {})
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: '合約測試客戶_contract' } } } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { customer: { name: '合約測試客戶_contract' } } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: '合約測試客戶_contract' } }).catch(() => {})
  await prisma.site.deleteMany({ where: { name: '合約測試站_contract' } }).catch(() => {})
  await prisma.user.deleteMany({ where: { username: 'contracts_test_user' } }).catch(() => {})

  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'contracts_test_user',
      passwordHash,
      name: '合約測試使用者',
      role: 'admin',
    },
  })
  testUserId = user.id

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'contracts_test_user', password: 'test1234' })
  token = loginRes.body.token

  // 建立測試站區和客戶
  const site = await prisma.site.create({
    data: { name: '合約測試站_contract', status: 'active' },
  })
  testSiteId = site.id

  const customer = await prisma.customer.create({
    data: {
      siteId: testSiteId,
      name: '合約測試客戶_contract',
      type: 'contracted',
      notificationMethod: 'email',
    },
  })
  testCustomerId = customer.id
})

afterAll(async () => {
  // 清理測試資料（順序很重要）
  if (createdContractId) {
    await prisma.contractItem.deleteMany({ where: { contractId: createdContractId } }).catch(() => {})
    await prisma.contract.delete({ where: { id: createdContractId } }).catch(() => {})
  }
  await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {})
  await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {})
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/contracts', () => {
  it('新增合約成功', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: testCustomerId,
        contractNumber: 'TEST-CONTRACT-001',
        startDate: '2099-01-01',
        endDate: '2099-12-31',
        notes: '測試合約',
      })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      customerId: testCustomerId,
      contractNumber: 'TEST-CONTRACT-001',
      status: 'draft',
    })
    expect(res.body.customer).toMatchObject({ id: testCustomerId })
    createdContractId = res.body.id
  })

  it('合約編號重複應回傳 409', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: testCustomerId,
        contractNumber: 'TEST-CONTRACT-001',
        startDate: '2099-01-01',
        endDate: '2099-12-31',
      })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: testCustomerId })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/contracts', () => {
  it('列出所有合約', async () => {
    const res = await request(app)
      .get('/api/contracts?all=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const found = res.body.find((c: any) => c.id === createdContractId)
    expect(found).toBeDefined()
    // 應包含 customer 和 items
    expect(found.customer).toBeDefined()
    expect(found.items).toBeDefined()
  })

  it('依客戶篩選合約', async () => {
    const res = await request(app)
      .get(`/api/contracts?customerId=${testCustomerId}&all=true`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    res.body.forEach((c: any) => {
      expect(c.customerId).toBe(testCustomerId)
    })
  })

  it('依狀態篩選合約', async () => {
    const res = await request(app)
      .get('/api/contracts?status=draft&all=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    res.body.forEach((c: any) => {
      expect(c.status).toBe('draft')
    })
  })
})

describe('GET /api/contracts/:id', () => {
  it('取得單一合約（含品項）', async () => {
    const res = await request(app)
      .get(`/api/contracts/${createdContractId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdContractId)
    expect(res.body).toHaveProperty('items')
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('不存在的 ID 應回傳 404', async () => {
    const res = await request(app)
      .get('/api/contracts/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/contracts/:id', () => {
  it('更新合約成功', async () => {
    const res = await request(app)
      .patch(`/api/contracts/${createdContractId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active', notes: '啟用合約' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('active')
    expect(res.body.notes).toBe('啟用合約')
  })

  it('更新不存在的合約應回傳 404', async () => {
    const res = await request(app)
      .patch('/api/contracts/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: '不會成功' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/contracts/:id', () => {
  it('終止合約（狀態改為 terminated）', async () => {
    const res = await request(app)
      .delete(`/api/contracts/${createdContractId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 確認狀態
    const check = await request(app)
      .get(`/api/contracts/${createdContractId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.body.status).toBe('terminated')
  })

  it('刪除不存在的合約應回傳 404', async () => {
    const res = await request(app)
      .delete('/api/contracts/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('認證保護', () => {
  it('無 token 存取合約應回傳 401', async () => {
    const res = await request(app).get('/api/contracts')
    expect(res.status).toBe(401)
  })
})

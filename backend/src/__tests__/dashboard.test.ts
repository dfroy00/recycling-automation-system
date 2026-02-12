// backend/src/__tests__/dashboard.test.ts
// 儀表板 API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number

beforeAll(async () => {
  // 建立測試使用者並取得 token（使用 upsert 避免殘留資料造成唯一約束衝突）
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.upsert({
    where: { username: 'dashboard_test_user' },
    update: { passwordHash },
    create: {
      username: 'dashboard_test_user',
      passwordHash,
      name: '儀表板測試使用者',
      role: 'admin',
    },
  })
  testUserId = user.id

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'dashboard_test_user', password: 'test1234' })
  token = res.body.token
})

afterAll(async () => {
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('GET /api/dashboard/stats', () => {
  it('回傳正確格式的統計資料（對齊前端 DashboardStats 型別）', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 驗證新欄位名稱存在且型別正確
    expect(typeof res.body.monthlyTrips).toBe('number')
    expect(typeof res.body.totalReceivable).toBe('number')
    expect(typeof res.body.totalPayable).toBe('number')
    expect(typeof res.body.customerCount).toBe('number')
    expect(typeof res.body.pendingReviews).toBe('number')
    expect(Array.isArray(res.body.expiringContracts)).toBe(true)
    expect(Array.isArray(res.body.pendingItems)).toBe(true)

    // 數值不應為負數
    expect(res.body.monthlyTrips).toBeGreaterThanOrEqual(0)
    expect(res.body.totalReceivable).toBeGreaterThanOrEqual(0)
    expect(res.body.totalPayable).toBeGreaterThanOrEqual(0)
    expect(res.body.customerCount).toBeGreaterThanOrEqual(0)
    expect(res.body.pendingReviews).toBeGreaterThanOrEqual(0)
  })

  it('不應回傳舊的欄位名稱', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 確認舊欄位名稱已不存在
    expect(res.body).not.toHaveProperty('tripCount')
    expect(res.body).not.toHaveProperty('activeCustomerCount')
    expect(res.body).not.toHaveProperty('pendingReviewCount')
    expect(res.body).not.toHaveProperty('contractAlerts')
  })

  it('expiringContracts 中的每一項都有正確欄位（使用 daysRemaining）', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 如果有合約到期提醒，驗證每項的格式
    if (res.body.expiringContracts.length > 0) {
      res.body.expiringContracts.forEach((contract: any) => {
        expect(contract).toHaveProperty('contractNumber')
        expect(contract).toHaveProperty('customerId')
        expect(contract).toHaveProperty('customerName')
        expect(contract).toHaveProperty('endDate')
        expect(contract).toHaveProperty('daysRemaining')
        expect(typeof contract.daysRemaining).toBe('number')
        expect(contract.daysRemaining).toBeGreaterThanOrEqual(0)
        expect(contract.daysRemaining).toBeLessThanOrEqual(30)

        // 確認不包含舊欄位
        expect(contract).not.toHaveProperty('id')
        expect(contract).not.toHaveProperty('daysLeft')
      })
    }
  })

  it('pendingItems 中的每一項都有正確格式', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 驗證 pendingItems 陣列格式
    res.body.pendingItems.forEach((item: any) => {
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('count')
      expect(item).toHaveProperty('label')
      expect(item).toHaveProperty('link')
      expect(typeof item.type).toBe('string')
      expect(typeof item.count).toBe('number')
      expect(typeof item.label).toBe('string')
      expect(typeof item.link).toBe('string')
    })
  })
})

describe('認證保護', () => {
  it('無 token 存取儀表板應回傳 401', async () => {
    const res = await request(app).get('/api/dashboard/stats')
    expect(res.status).toBe(401)
  })
})

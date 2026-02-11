// backend/src/__tests__/dashboard.test.ts
// 儀表板 API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number

beforeAll(async () => {
  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
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
  it('回傳正確格式的統計資料', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 驗證回傳欄位的型別
    expect(typeof res.body.tripCount).toBe('number')
    expect(typeof res.body.totalReceivable).toBe('number')
    expect(typeof res.body.totalPayable).toBe('number')
    expect(typeof res.body.activeCustomerCount).toBe('number')
    expect(typeof res.body.pendingReviewCount).toBe('number')
    expect(Array.isArray(res.body.contractAlerts)).toBe(true)

    // 數值不應為負數
    expect(res.body.tripCount).toBeGreaterThanOrEqual(0)
    expect(res.body.totalReceivable).toBeGreaterThanOrEqual(0)
    expect(res.body.totalPayable).toBeGreaterThanOrEqual(0)
    expect(res.body.activeCustomerCount).toBeGreaterThanOrEqual(0)
    expect(res.body.pendingReviewCount).toBeGreaterThanOrEqual(0)
  })

  it('contractAlerts 中的每一項都有必要欄位', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // 如果有合約到期提醒，驗證每項的格式
    if (res.body.contractAlerts.length > 0) {
      res.body.contractAlerts.forEach((alert: any) => {
        expect(alert).toHaveProperty('id')
        expect(alert).toHaveProperty('contractNumber')
        expect(alert).toHaveProperty('customerId')
        expect(alert).toHaveProperty('customerName')
        expect(alert).toHaveProperty('endDate')
        expect(alert).toHaveProperty('daysLeft')
        expect(typeof alert.daysLeft).toBe('number')
        expect(alert.daysLeft).toBeGreaterThanOrEqual(0)
        expect(alert.daysLeft).toBeLessThanOrEqual(30)
      })
    }
  })
})

describe('認證保護', () => {
  it('無 token 存取儀表板應回傳 401', async () => {
    const res = await request(app).get('/api/dashboard/stats')
    expect(res.status).toBe(401)
  })
})

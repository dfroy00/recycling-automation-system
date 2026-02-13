// backend/src/__tests__/holidays.test.ts
// 假日 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number
let createdHolidayId: number

beforeAll(async () => {
  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'holidays_test_user',
      passwordHash,
      name: '假日測試使用者',
      role: 'super_admin',
    },
  })
  testUserId = user.id

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'holidays_test_user', password: 'test1234' })
  token = res.body.token
})

afterAll(async () => {
  // 清理測試資料
  if (createdHolidayId) {
    await prisma.holiday.delete({ where: { id: createdHolidayId } }).catch(() => {})
  }
  // 清理批次匯入的測試資料
  await prisma.holiday.deleteMany({
    where: { name: { startsWith: '測試假日_' } },
  }).catch(() => {})
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/holidays', () => {
  it('新增假日成功', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2099-12-25', name: '測試假日_單筆', year: 2099 })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: '測試假日_單筆',
      year: 2099,
    })
    createdHolidayId = res.body.id
  })

  it('日期重複應回傳 409', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2099-12-25', name: '重複日期', year: 2099 })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2099-12-26' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/holidays', () => {
  it('列出所有假日', async () => {
    const res = await request(app)
      .get('/api/holidays')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const found = res.body.find((h: any) => h.id === createdHolidayId)
    expect(found).toBeDefined()
  })

  it('依年份篩選假日', async () => {
    const res = await request(app)
      .get('/api/holidays?year=2099')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((h: any) => {
      expect(h.year).toBe(2099)
    })
    // 至少包含我們剛建立的假日
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })

  it('篩選不存在的年份回傳空陣列', async () => {
    const res = await request(app)
      .get('/api/holidays?year=1900')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /api/holidays/import', () => {
  it('批次匯入假日成功', async () => {
    const res = await request(app)
      .post('/api/holidays/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        holidays: [
          { date: '2099-11-01', name: '測試假日_匯入1', year: 2099 },
          { date: '2099-11-02', name: '測試假日_匯入2', year: 2099 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')
    // 訊息應包含成功數量
    expect(res.body.message).toMatch(/2/)
  })

  it('匯入含無效資料會跳過不完整的項目', async () => {
    const res = await request(app)
      .post('/api/holidays/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        holidays: [
          { date: '2099-11-03', name: '測試假日_匯入3', year: 2099 },
          { date: '2099-11-04' }, // 缺少 name 和 year
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/1.*成功/)
    expect(res.body.message).toMatch(/1.*跳過/)
  })

  it('空陣列應回傳 400', async () => {
    const res = await request(app)
      .post('/api/holidays/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ holidays: [] })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('DELETE /api/holidays/:id', () => {
  it('刪除假日成功（硬刪除）', async () => {
    const res = await request(app)
      .delete(`/api/holidays/${createdHolidayId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // 確認已真正刪除
    const check = await prisma.holiday.findUnique({ where: { id: createdHolidayId } })
    expect(check).toBeNull()
    createdHolidayId = 0 // 防止 afterAll 重複刪除
  })

  it('刪除不存在的假日應回傳 404', async () => {
    const res = await request(app)
      .delete('/api/holidays/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('認證保護', () => {
  it('無 token 存取假日應回傳 401', async () => {
    const res = await request(app).get('/api/holidays')
    expect(res.status).toBe(401)
  })
})

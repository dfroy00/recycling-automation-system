// backend/src/__tests__/auth.test.ts
// 認證 API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let testUserId: number

beforeAll(async () => {
  // 建立測試使用者
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'auth_test_user',
      passwordHash,
      name: '認證測試使用者',
      email: 'authtest@example.com',
      role: 'admin',
    },
  })
  testUserId = user.id
})

afterAll(async () => {
  // 清理測試資料
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/auth/login', () => {
  it('登入成功，回傳 token 與使用者資訊', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auth_test_user', password: 'test1234' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user).toMatchObject({
      username: 'auth_test_user',
      name: '認證測試使用者',
      role: 'admin',
    })
    // 不應回傳密碼
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('帳號不存在應回傳 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'test1234' })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('密碼錯誤應回傳 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auth_test_user', password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('未提供帳號密碼應回傳 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/auth/me', () => {
  let token: string

  beforeAll(async () => {
    // 取得有效 token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auth_test_user', password: 'test1234' })
    token = res.body.token
  })

  it('有效 token 應回傳當前使用者資訊', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      username: 'auth_test_user',
      name: '認證測試使用者',
      role: 'admin',
    })
    // 不應回傳密碼
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('無 token 應回傳 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('無效 token 應回傳 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here')

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })
})

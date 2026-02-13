// backend/src/__tests__/users.test.ts
// 使用者 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let authUserId: number
let createdUserId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料
  await prisma.user.deleteMany({ where: { username: { in: ['users_test_auth', 'newuser_test'] } } }).catch(() => {})

  // 建立認證用使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'users_test_auth',
      passwordHash,
      name: '使用者測試帳號',
      role: 'admin',
    },
  })
  authUserId = user.id

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'users_test_auth', password: 'test1234' })
  token = res.body.token
})

afterAll(async () => {
  // 清理測試資料
  if (createdUserId) {
    await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {})
  }
  await prisma.user.delete({ where: { id: authUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/users', () => {
  it('新增使用者成功，密碼已 hash 且不回傳 passwordHash', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'newuser_test',
        password: 'newpass123',
        name: '新使用者',
        email: 'new@example.com',
        role: 'admin',
      })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      username: 'newuser_test',
      name: '新使用者',
      email: 'new@example.com',
      role: 'admin',
    })
    // 不應回傳 passwordHash
    expect(res.body).not.toHaveProperty('passwordHash')
    createdUserId = res.body.id

    // 確認密碼確實已 hash 儲存
    const dbUser = await prisma.user.findUnique({ where: { id: createdUserId } })
    expect(dbUser!.passwordHash).not.toBe('newpass123')
    const valid = await bcrypt.compare('newpass123', dbUser!.passwordHash)
    expect(valid).toBe(true)
  })

  it('帳號重複應回傳 409', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'newuser_test',
        password: 'pass12345',
        name: '重複帳號',
      })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'onlyusername' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/users', () => {
  it('列出所有使用者，不含 passwordHash', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    // 每個使用者都不應含有 passwordHash
    res.body.forEach((u: any) => {
      expect(u).not.toHaveProperty('passwordHash')
    })
    const found = res.body.find((u: any) => u.id === createdUserId)
    expect(found).toBeDefined()
  })
})

describe('GET /api/users/:id', () => {
  it('取得單一使用者，不含 passwordHash', async () => {
    const res = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdUserId)
    expect(res.body.name).toBe('新使用者')
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('不存在的 ID 應回傳 404', async () => {
    const res = await request(app)
      .get('/api/users/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('PATCH /api/users/:id', () => {
  it('更新使用者成功', async () => {
    const res = await request(app)
      .patch(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '更新後名字', email: 'updated@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('更新後名字')
    expect(res.body.email).toBe('updated@example.com')
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('更新密碼後可用新密碼登入', async () => {
    await request(app)
      .patch(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'updatedpass456' })

    // 用新密碼登入
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'newuser_test', password: 'updatedpass456' })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body).toHaveProperty('token')
  })

  it('更新不存在的使用者應回傳 404', async () => {
    const res = await request(app)
      .patch('/api/users/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '不會成功' })

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('DELETE /api/users/:id', () => {
  it('軟刪除使用者（狀態改為 inactive）', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // 確認狀態改為 inactive
    const check = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.body.status).toBe('inactive')
  })

  it('刪除不存在的使用者應回傳 404', async () => {
    const res = await request(app)
      .delete('/api/users/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('認證保護', () => {
  it('無 token 存取使用者應回傳 401', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })
})

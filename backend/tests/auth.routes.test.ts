import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'

describe('Auth Routes', () => {
  // 測試前清除測試用的使用者
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'test_' } },
    })
  })

  describe('POST /api/auth/register', () => {
    it('應成功註冊新使用者', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_user1',
          password: 'password123',
          name: '測試使用者',
          role: 'site_admin',
          siteId: 'S001',
        })

      expect(res.status).toBe(201)
      expect(res.body.user.username).toBe('test_user1')
      expect(res.body.user.role).toBe('site_admin')
      expect(res.body.user.password).toBeUndefined() // 不回傳密碼
    })

    it('應拒絕重複的 username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_user1',
          password: 'password123',
          name: '重複使用者',
          role: 'site_admin',
        })

      expect(res.status).toBe(409)
      expect(res.body.message).toContain('已存在')
    })

    it('應拒絕缺少必填欄位', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'test_incomplete' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('應成功登入並回傳 Token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test_user1',
          password: 'password123',
        })

      expect(res.status).toBe(200)
      expect(res.body.token).toBeDefined()
      expect(res.body.user.username).toBe('test_user1')
      expect(res.body.user.password).toBeUndefined()
    })

    it('應拒絕錯誤密碼', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test_user1',
          password: 'wrong_password',
        })

      expect(res.status).toBe(401)
      expect(res.body.message).toContain('密碼錯誤')
    })

    it('應拒絕不存在的帳號', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        })

      expect(res.status).toBe(401)
      expect(res.body.message).toContain('不存在')
    })
  })
})

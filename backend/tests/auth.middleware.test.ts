import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authenticate, authorize } from '../src/middleware/auth'
import { generateToken } from '../src/services/auth.service'

// 建立測試用 Express app
function createTestApp() {
  const app = express()
  app.use(express.json())

  // 受保護的測試端點
  app.get('/protected', authenticate, (req, res) => {
    res.json({ message: 'ok', user: req.user })
  })

  // 需要特定角色的端點
  app.get('/admin-only', authenticate, authorize('system_admin'), (_req, res) => {
    res.json({ message: 'admin access granted' })
  })

  // 多角色端點
  app.get('/managers', authenticate, authorize('system_admin', 'site_admin'), (_req, res) => {
    res.json({ message: 'manager access granted' })
  })

  return app
}

describe('Auth Middleware', () => {
  let app: express.Express
  let validToken: string

  beforeAll(() => {
    app = createTestApp()
    validToken = generateToken({
      userId: 1,
      username: 'admin',
      role: 'system_admin',
    })
  })

  describe('authenticate', () => {
    it('應拒絕沒有 Token 的請求', async () => {
      const res = await request(app).get('/protected')
      expect(res.status).toBe(401)
      expect(res.body.message).toContain('未提供')
    })

    it('應拒絕無效 Token', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
      expect(res.body.message).toContain('無效')
    })

    it('應接受有效 Token', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
    })
  })

  describe('authorize', () => {
    it('應允許正確角色存取', async () => {
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
    })

    it('應拒絕錯誤角色存取', async () => {
      const siteToken = generateToken({
        userId: 2,
        username: 'site_user',
        role: 'finance',
      })

      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${siteToken}`)

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('權限不足')
    })

    it('應支援多角色驗證', async () => {
      const siteAdminToken = generateToken({
        userId: 3,
        username: 'site_admin',
        role: 'site_admin',
      })

      const res = await request(app)
        .get('/managers')
        .set('Authorization', `Bearer ${siteAdminToken}`)

      expect(res.status).toBe(200)
    })
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'
import { generateToken } from '../src/services/auth.service'

describe('Sites Routes', () => {
  let adminToken: string
  let financeToken: string

  beforeAll(async () => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
    financeToken = generateToken({ userId: 2, username: 'finance', role: 'finance' })
    // 清理測試站點
    await prisma.site.deleteMany({ where: { siteId: { in: ['S099', 'S100'] } } })
  })

  describe('GET /api/sites', () => {
    it('應回傳站點清單（已驗證）', async () => {
      const res = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body[0]).toHaveProperty('siteId')
      expect(res.body[0]).toHaveProperty('siteName')
    })

    it('應拒絕未驗證的請求', async () => {
      const res = await request(app).get('/api/sites')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/sites', () => {
    it('應允許管理員新增站點', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          siteId: 'S099',
          siteName: '測試站',
          manager: '測試管理員',
        })

      expect(res.status).toBe(201)
      expect(res.body.siteId).toBe('S099')
    })

    it('應拒絕財務人員新增站點', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({
          siteId: 'S100',
          siteName: '不應被建立的站',
        })

      expect(res.status).toBe(403)
    })
  })
})

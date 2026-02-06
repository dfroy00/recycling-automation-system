import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'
import { generateToken } from '../src/services/auth.service'

describe('Customers Routes', () => {
  let adminToken: string
  let siteAdminToken: string

  beforeAll(async () => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
    siteAdminToken = generateToken({ userId: 2, username: 'site1', role: 'site_admin', siteId: 'S001' })

    // 清理測試客戶
    await prisma.customer.deleteMany({ where: { customerId: { startsWith: 'TEST_' } } })
  })

  describe('GET /api/customers', () => {
    it('系統管理員應看到所有客戶', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.total).toBeDefined()
    })

    it('站點管理員應只看到自己站點的客戶', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${siteAdminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.every((c: any) => c.siteId === 'S001')).toBe(true)
    })

    it('應支援計費類型篩選', async () => {
      const res = await request(app)
        .get('/api/customers?billingType=A')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.every((c: any) => c.billingType === 'A')).toBe(true)
    })
  })

  describe('POST /api/customers', () => {
    it('應成功新增客戶', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'TEST_C099',
          siteId: 'S001',
          customerName: '測試客戶',
          billingType: 'A',
          tripPrice: 300,
          notificationMethod: 'Email',
          email: 'test@example.com',
        })

      expect(res.status).toBe(201)
      expect(res.body.customerId).toBe('TEST_C099')
    })
  })

  describe('PUT /api/customers/:id', () => {
    it('應成功更新客戶', async () => {
      const res = await request(app)
        .put('/api/customers/TEST_C099')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerName: '更新後的測試客戶' })

      expect(res.status).toBe(200)
      expect(res.body.customerName).toBe('更新後的測試客戶')
    })
  })
})

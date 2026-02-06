import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'
import { generateToken } from '../src/services/auth.service'

describe('Contracts Routes', () => {
  let adminToken: string

  beforeAll(async () => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
  })

  describe('GET /api/customers/:id/contracts', () => {
    it('應回傳 C 類客戶的合約', async () => {
      const res = await request(app)
        .get('/api/customers/C003/contracts')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body[0]).toHaveProperty('itemName')
      expect(res.body[0]).toHaveProperty('contractPrice')
    })
  })

  describe('POST /api/customers/:id/contracts', () => {
    it('應成功新增合約品項', async () => {
      const res = await request(app)
        .post('/api/customers/C003/contracts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemName: '鋁罐',
          contractPrice: 30.0,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        })

      expect(res.status).toBe(201)
      expect(res.body.itemName).toBe('鋁罐')
    })
  })

  describe('PUT /api/contracts/:id', () => {
    it('應成功更新合約價格', async () => {
      // 先取得剛才建立的合約 ID
      const contracts = await prisma.contractPrice.findMany({
        where: { customerId: 'C003', itemName: '鋁罐' },
      })
      const contractId = contracts[0].contractPriceId

      const res = await request(app)
        .put(`/api/contracts/${contractId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contractPrice: 32.0 })

      expect(res.status).toBe(200)
      expect(Number(res.body.contractPrice)).toBe(32)
    })
  })
})

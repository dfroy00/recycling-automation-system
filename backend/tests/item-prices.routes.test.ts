import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { generateToken } from '../src/services/auth.service'

describe('Item Prices Routes', () => {
  let adminToken: string

  beforeAll(() => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
  })

  describe('GET /api/item-prices', () => {
    it('應回傳品項清單', async () => {
      const res = await request(app)
        .get('/api/item-prices')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data[0]).toHaveProperty('itemName')
      expect(res.body.data[0]).toHaveProperty('standardPrice')
    })
  })

  describe('POST /api/item-prices', () => {
    it('應成功新增品項', async () => {
      const res = await request(app)
        .post('/api/item-prices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemName: '測試品項',
          standardPrice: 99.9,
          effectiveDate: '2026-03-01',
        })

      expect(res.status).toBe(201)
      expect(res.body.itemName).toBe('測試品項')
    })
  })

  describe('PUT /api/item-prices/:id/adjust', () => {
    it('應成功調整單價（保留歷史）', async () => {
      const res = await request(app)
        .get('/api/item-prices?itemName=紙類')
        .set('Authorization', `Bearer ${adminToken}`)

      const priceId = res.body.data[0].itemPriceId

      const adjustRes = await request(app)
        .put(`/api/item-prices/${priceId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newPrice: 5.5,
          effectiveDate: '2026-04-01',
        })

      expect(adjustRes.status).toBe(200)
      expect(adjustRes.body.message).toContain('調整')
    })
  })
})

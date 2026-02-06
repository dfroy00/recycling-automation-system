import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { generateToken } from '../src/services/auth.service'

describe('Data Routes', () => {
  let adminToken: string

  beforeAll(() => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
  })

  describe('GET /api/data/trips', () => {
    it('應回傳車趟記錄', async () => {
      const res = await request(app)
        .get('/api/data/trips')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('total')
    })
  })

  describe('GET /api/data/items', () => {
    it('應回傳品項記錄與統計', async () => {
      const res = await request(app)
        .get('/api/data/items')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('stats')
      expect(res.body.stats).toHaveProperty('totalWeight')
    })
  })
})

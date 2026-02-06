import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app'

describe('GET /api/health', () => {
  it('應回傳 ok 狀態與資料庫連線狀態', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.database).toBe('connected')
    expect(res.body.timestamp).toBeDefined()
  })
})

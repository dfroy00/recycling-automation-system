// backend/src/__tests__/items.test.ts
// 品項 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number
let createdItemId: number

beforeAll(async () => {
  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'items_test_user',
      passwordHash,
      name: '品項測試使用者',
      role: 'admin',
    },
  })
  testUserId = user.id

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'items_test_user', password: 'test1234' })
  token = res.body.token
})

afterAll(async () => {
  // 清理測試資料
  if (createdItemId) {
    await prisma.item.delete({ where: { id: createdItemId } }).catch(() => {})
  }
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/items', () => {
  it('新增品項成功', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '測試品項_items', category: '測試分類', unit: 'kg' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: '測試品項_items',
      category: '測試分類',
      unit: 'kg',
      status: 'active',
    })
    createdItemId = res.body.id
  })

  it('名稱重複應回傳 409', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '測試品項_items', unit: 'kg' })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '只有名稱' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/items', () => {
  it('列出所有品項', async () => {
    const res = await request(app)
      .get('/api/items?all=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const found = res.body.find((i: any) => i.id === createdItemId)
    expect(found).toBeDefined()
  })

  it('依分類篩選品項', async () => {
    const res = await request(app)
      .get('/api/items?category=測試分類&all=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((i: any) => {
      expect(i.category).toBe('測試分類')
    })
  })
})

describe('GET /api/items/:id', () => {
  it('取得單一品項', async () => {
    const res = await request(app)
      .get(`/api/items/${createdItemId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdItemId)
    expect(res.body.name).toBe('測試品項_items')
  })

  it('不存在的 ID 應回傳 404', async () => {
    const res = await request(app)
      .get('/api/items/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('PATCH /api/items/:id', () => {
  it('更新品項成功', async () => {
    const res = await request(app)
      .patch(`/api/items/${createdItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: '更新後分類' })

    expect(res.status).toBe(200)
    expect(res.body.category).toBe('更新後分類')
  })

  it('更新不存在的品項應回傳 404', async () => {
    const res = await request(app)
      .patch('/api/items/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: '不會成功' })

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('DELETE /api/items/:id', () => {
  it('軟刪除品項（狀態改為 inactive）', async () => {
    const res = await request(app)
      .delete(`/api/items/${createdItemId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // 確認狀態改為 inactive
    const check = await request(app)
      .get(`/api/items/${createdItemId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.body.status).toBe('inactive')
  })

  it('刪除不存在的品項應回傳 404', async () => {
    const res = await request(app)
      .delete('/api/items/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('認證保護', () => {
  it('無 token 存取品項應回傳 401', async () => {
    const res = await request(app).get('/api/items')
    expect(res.status).toBe(401)
  })
})

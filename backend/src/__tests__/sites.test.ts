// backend/src/__tests__/sites.test.ts
// 站區 CRUD API 測試
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

let token: string
let testUserId: number
let createdSiteId: number

beforeAll(async () => {
  // 建立測試使用者並取得 token
  const passwordHash = await bcrypt.hash('test1234', 10)
  const user = await prisma.user.create({
    data: {
      username: 'sites_test_user',
      passwordHash,
      name: '站區測試使用者',
      role: 'super_admin',
    },
  })
  testUserId = user.id

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'sites_test_user', password: 'test1234' })
  token = res.body.token
})

afterAll(async () => {
  // 清理測試資料
  if (createdSiteId) {
    await prisma.site.delete({ where: { id: createdSiteId } }).catch(() => {})
  }
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('POST /api/sites', () => {
  it('新增站區成功', async () => {
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '測試站_sites', address: '測試地址', phone: '02-1111111' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: '測試站_sites',
      address: '測試地址',
      phone: '02-1111111',
      status: 'active',
    })
    createdSiteId = res.body.id
  })

  it('名稱重複應回傳 409', async () => {
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '測試站_sites' })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  it('未提供名稱應回傳 400', async () => {
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '只有地址' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/sites', () => {
  it('列出所有站區', async () => {
    const res = await request(app)
      .get('/api/sites?all=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    // 至少包含我們剛建立的站區
    const found = res.body.find((s: any) => s.id === createdSiteId)
    expect(found).toBeDefined()
  })
})

describe('GET /api/sites/:id', () => {
  it('取得單一站區', async () => {
    const res = await request(app)
      .get(`/api/sites/${createdSiteId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdSiteId)
    expect(res.body.name).toBe('測試站_sites')
  })

  it('不存在的 ID 應回傳 404', async () => {
    const res = await request(app)
      .get('/api/sites/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('PATCH /api/sites/:id', () => {
  it('更新站區成功', async () => {
    const res = await request(app)
      .patch(`/api/sites/${createdSiteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '更新後地址' })

    expect(res.status).toBe(200)
    expect(res.body.address).toBe('更新後地址')
  })

  it('更新不存在的站區應回傳 404', async () => {
    const res = await request(app)
      .patch('/api/sites/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '不會成功' })

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('PATCH /api/sites/:id/deactivate', () => {
  it('軟刪除站區（狀態改為 inactive）', async () => {
    const res = await request(app)
      .patch(`/api/sites/${createdSiteId}/deactivate`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('已停用')

    // 確認狀態改為 inactive
    const check = await request(app)
      .get(`/api/sites/${createdSiteId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.body.status).toBe('inactive')
  })

  it('停用不存在的站區應回傳 404', async () => {
    const res = await request(app)
      .patch('/api/sites/999999/deactivate')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('PATCH /api/sites/:id/reactivate', () => {
  it('啟用站區（狀態恢復 active）', async () => {
    const res = await request(app)
      .patch(`/api/sites/${createdSiteId}/reactivate`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('已啟用')

    // 確認狀態恢復 active
    const check = await request(app)
      .get(`/api/sites/${createdSiteId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.body.status).toBe('active')
  })

  it('啟用不存在的站區應回傳 404', async () => {
    const res = await request(app)
      .patch('/api/sites/999999/reactivate')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('DELETE /api/sites/:id', () => {
  it('硬刪除站區成功', async () => {
    const res = await request(app)
      .delete(`/api/sites/${createdSiteId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('已刪除')

    // 確認已被刪除
    const check = await request(app)
      .get(`/api/sites/${createdSiteId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.status).toBe(404)

    // 清除 ID 避免 afterAll 重複刪除
    createdSiteId = 0
  })

  it('刪除不存在的站區應回傳 404', async () => {
    const res = await request(app)
      .delete('/api/sites/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('認證保護', () => {
  it('無 token 存取站區應回傳 401', async () => {
    const res = await request(app).get('/api/sites')
    expect(res.status).toBe(401)
  })
})

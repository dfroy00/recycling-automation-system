// backend/tests/import.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import path from 'path'
import fs from 'fs'
import ExcelJS from 'exceljs'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'
import { generateToken } from '../src/services/auth.service'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')

describe('Import Routes', () => {
  let adminToken: string

  beforeAll(async () => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })

    // 建立測試車趟 Excel
    const tripWb = new ExcelJS.Workbook()
    const tripWs = tripWb.addWorksheet('車趟')
    tripWs.addRow(['日期', '時間', '客戶編號', '司機', '車牌'])
    tripWs.addRow(['2026-02-01', '09:30', 'C001', '王小明', 'ABC-1234'])
    await tripWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'test-trips.xlsx'))

    // 建立測試品項 Excel
    const itemWb = new ExcelJS.Workbook()
    const itemWs = itemWb.addWorksheet('品項')
    itemWs.addRow(['日期', '客戶編號', '品項名稱', '重量(kg)'])
    itemWs.addRow(['2026-02-01', 'C001', '紙類', 150.5])
    await itemWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'test-items.xlsx'))

    // 清理先前的測試匯入資料
    await prisma.trip.deleteMany({ where: { sourceFile: { contains: 'test-' } } })
    await prisma.itemCollected.deleteMany({ where: { sourceFile: { contains: 'test-' } } })
  })

  afterAll(() => {
    fs.rmSync(FIXTURES_DIR, { recursive: true, force: true })
  })

  describe('POST /api/import/trips', () => {
    it('應成功匯入車趟資料', async () => {
      const res = await request(app)
        .post('/api/import/trips')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('siteId', 'S001')
        .attach('file', path.join(FIXTURES_DIR, 'test-trips.xlsx'))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.total).toBe(1)
      expect(res.body.imported).toBe(1)
    })

    it('應拒絕未驗證的請求', async () => {
      const res = await request(app)
        .post('/api/import/trips')
        .send({})

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/import/items', () => {
    it('應成功匯入品項資料', async () => {
      const res = await request(app)
        .post('/api/import/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('siteId', 'S001')
        .attach('file', path.join(FIXTURES_DIR, 'test-items.xlsx'))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.total).toBe(1)
      expect(res.body.imported).toBe(1)
    })
  })
})

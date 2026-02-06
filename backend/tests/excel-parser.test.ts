// backend/tests/excel-parser.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'path'
import ExcelJS from 'exceljs'
import fs from 'fs'
import { parseTripExcel, parseItemExcel } from '../src/services/excel-parser'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')

// 測試前建立範例 Excel 檔案
beforeAll(async () => {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })

  // 建立車機 Excel
  const tripWb = new ExcelJS.Workbook()
  const tripWs = tripWb.addWorksheet('車趟')
  tripWs.addRow(['日期', '時間', '客戶編號', '司機', '車牌'])
  tripWs.addRow(['2026-02-01', '09:30', 'C001', '王小明', 'ABC-1234'])
  tripWs.addRow(['2026-02-01', '14:20', 'C002', '李大華', 'XYZ-5678'])
  tripWs.addRow(['2026-02-02', '10:00', 'C001', '王小明', 'ABC-1234'])
  await tripWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'trips.xlsx'))

  // 建立 ERP 品項 Excel
  const itemWb = new ExcelJS.Workbook()
  const itemWs = itemWb.addWorksheet('品項')
  itemWs.addRow(['日期', '客戶編號', '品項名稱', '重量(kg)'])
  itemWs.addRow(['2026-02-01', 'C001', '紙類', 150.5])
  itemWs.addRow(['2026-02-01', 'C001', '塑膠', 80.2])
  itemWs.addRow(['2026-02-01', 'C002', '金屬', 200.0])
  itemWs.addRow(['2026-02-02', 'C001', '紙類', 120.0])
  await itemWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'items.xlsx'))

  // 建立格式錯誤的 Excel（缺少欄位）
  const badWb = new ExcelJS.Workbook()
  const badWs = badWb.addWorksheet('錯誤')
  badWs.addRow(['欄位A', '欄位B'])
  badWs.addRow(['data1', 'data2'])
  await badWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'bad-format.xlsx'))
})

afterAll(() => {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true })
})

describe('Excel 解析服務', () => {
  describe('parseTripExcel', () => {
    it('應正確解析車趟 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'trips.xlsx')
      const result = await parseTripExcel(filePath)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
      expect(result.data[0]).toEqual({
        tripDate: '2026-02-01',
        tripTime: '09:30',
        customerId: 'C001',
        driver: '王小明',
        vehiclePlate: 'ABC-1234',
      })
    })

    it('應拒絕格式錯誤的 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'bad-format.xlsx')
      const result = await parseTripExcel(filePath)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式')
    })
  })

  describe('parseItemExcel', () => {
    it('應正確解析品項 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'items.xlsx')
      const result = await parseItemExcel(filePath)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(4)
      expect(result.data[0]).toEqual({
        collectionDate: '2026-02-01',
        customerId: 'C001',
        itemName: '紙類',
        weightKg: 150.5,
      })
    })

    it('應拒絕格式錯誤的 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'bad-format.xlsx')
      const result = await parseItemExcel(filePath)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式')
    })
  })
})

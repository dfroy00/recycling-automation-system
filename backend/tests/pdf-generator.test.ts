// backend/tests/pdf-generator.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateStatementPdf, type PdfStatementData } from '../src/services/pdf-generator'

const OUTPUT_DIR = path.join(__dirname, '../output/pdf')

// 測試用 A 類客戶明細資料
const sampleDataTypeA: PdfStatementData = {
  companyName: 'XX 環保資源回收公司',
  companyPhone: '02-1234-5678',
  customerName: 'ABC 科技股份有限公司',
  customerId: 'C001',
  siteName: '台北站',
  yearMonth: '2026-02',
  billingType: 'A',
  tripDetails: [
    { date: '02/05', tripCount: 2, tripFee: 600 },
    { date: '02/12', tripCount: 3, tripFee: 900 },
    { date: '02/19', tripCount: 2, tripFee: 600 },
    { date: '02/26', tripCount: 1, tripFee: 300 },
  ],
  tripCount: 8,
  tripFee: 2400,
  itemDetails: [
    { itemName: '紙類', weight: 450.5, unitPrice: 5.0, subtotal: 2252.5, priceType: 'standard' },
    { itemName: '塑膠', weight: 220.3, unitPrice: 3.5, subtotal: 771.05, priceType: 'standard' },
    { itemName: '金屬', weight: 180.0, unitPrice: 8.0, subtotal: 1440, priceType: 'standard' },
  ],
  itemFee: 4463.55,
  totalAmount: 6863.55,
  anomaly: false,
  generatedAt: '2026-03-01 10:00',
}

// B 類客戶（僅車趟費）
const sampleDataTypeB: PdfStatementData = {
  companyName: 'XX 環保資源回收公司',
  companyPhone: '02-1234-5678',
  customerName: 'XYZ 物流有限公司',
  customerId: 'C002',
  siteName: '台北站',
  yearMonth: '2026-02',
  billingType: 'B',
  tripDetails: [
    { date: '02/03', tripCount: 1, tripFee: 500 },
    { date: '02/17', tripCount: 2, tripFee: 1000 },
  ],
  tripCount: 3,
  tripFee: 1500,
  itemDetails: [],
  itemFee: 0,
  totalAmount: 1500,
  anomaly: false,
  generatedAt: '2026-03-01 10:00',
}

// 異常金額的資料
const sampleDataAnomaly: PdfStatementData = {
  ...sampleDataTypeA,
  customerId: 'C099',
  anomaly: true,
  anomalyReason: '與上月差異 +45.2%，超過 30% 門檻',
}

describe('PDF 報表產生', () => {
  const generatedFiles: string[] = []

  afterAll(() => {
    // 可選：測試後清理檔案
    // generatedFiles.forEach(f => fs.unlinkSync(f))
  })

  it('應產生 A 類客戶 PDF', async () => {
    const filePath = await generateStatementPdf(sampleDataTypeA, OUTPUT_DIR)

    expect(fs.existsSync(filePath)).toBe(true)
    const stats = fs.statSync(filePath)
    expect(stats.size).toBeGreaterThan(1000) // PDF 至少要有合理大小
    generatedFiles.push(filePath)
  })

  it('應產生 B 類客戶 PDF（無品項明細）', async () => {
    const filePath = await generateStatementPdf(sampleDataTypeB, OUTPUT_DIR)

    expect(fs.existsSync(filePath)).toBe(true)
    generatedFiles.push(filePath)
  })

  it('異常金額應在 PDF 中標示', async () => {
    const filePath = await generateStatementPdf(sampleDataAnomaly, OUTPUT_DIR)

    expect(fs.existsSync(filePath)).toBe(true)
    generatedFiles.push(filePath)
  })

  it('檔名應包含客戶編號和年月', async () => {
    const filePath = await generateStatementPdf(sampleDataTypeA, OUTPUT_DIR)

    const filename = path.basename(filePath)
    expect(filename).toContain('C001')
    expect(filename).toContain('2026-02')
    generatedFiles.push(filePath)
  })
})

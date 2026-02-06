// backend/tests/invoice-excel.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateInvoiceExcel, type InvoiceData } from '../src/services/invoice-excel.service'

const OUTPUT_DIR = path.join(__dirname, '../output')

describe('Excel 發票明細', () => {
  const sampleData: InvoiceData[] = [
    {
      customerId: 'C001',
      customerName: 'ABC 科技',
      siteName: '台北站',
      billingType: 'A',
      totalAmount: 6863.55,
      tripFee: 2400,
      itemFee: 4463.55,
    },
    {
      customerId: 'C002',
      customerName: 'XYZ 物流',
      siteName: '台北站',
      billingType: 'B',
      totalAmount: 1500,
      tripFee: 1500,
      itemFee: 0,
    },
    {
      customerId: 'C003',
      customerName: '大成製造',
      siteName: '新北站',
      billingType: 'C',
      totalAmount: 4128.15,
      tripFee: 0,
      itemFee: 4128.15,
    },
  ]

  it('應產生發票彙總 Excel', async () => {
    const filePath = await generateInvoiceExcel('2026-02', sampleData, OUTPUT_DIR)

    expect(fs.existsSync(filePath)).toBe(true)
    const stats = fs.statSync(filePath)
    expect(stats.size).toBeGreaterThan(1000)
  })
})

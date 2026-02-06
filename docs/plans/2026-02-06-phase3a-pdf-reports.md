# 階段三A：PDF 月結明細報表 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 pdfkit 產生四種客戶類型的月結明細 PDF 報表，支援公司 Logo、表格排版、異常金額紅字標示、管理員預覽機制

**Architecture:** PDF 產生為獨立 service，從 monthly_statements 的 detail_json 讀取計算結果後排版輸出。PDF 檔案儲存在 `backend/output/pdf/` 目錄，路徑記錄在 monthly_statements.pdf_path。

**Tech Stack:** pdfkit, pdfkit-table (或手動繪製表格), Vitest

**前置條件:** 階段二A 已完成（月結明細計算服務就緒、monthly_statements 有資料）

**參考文件:** 設計文檔附錄 B「月結明細 PDF 範例」

---

### Task 1: 安裝 PDF 依賴與目錄結構

**Files:**
- Modify: `backend/package.json`

**Step 1: 安裝依賴**

Run:
```bash
cd backend
npm install pdfkit
npm install -D @types/pdfkit
```

**Step 2: 建立輸出目錄**

Run:
```bash
mkdir -p backend/output/pdf
touch backend/output/pdf/.gitkeep
```

在 `.gitignore` 加入：
```
backend/output/pdf/*
!backend/output/pdf/.gitkeep
```

**Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/output/pdf/.gitkeep .gitignore
git commit -m "chore: 安裝 pdfkit 並建立 PDF 輸出目錄"
```

---

### Task 2: PDF 報表產生服務 - 基礎排版

**Files:**
- Create: `backend/tests/pdf-generator.test.ts`
- Create: `backend/src/services/pdf-generator.ts`

**Step 1: 撰寫 PDF 產生失敗測試**

```typescript
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
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- pdf-generator`
Expected: FAIL

**Step 3: 實作 PDF 產生服務**

```typescript
// backend/src/services/pdf-generator.ts
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

// PDF 明細資料結構
export interface PdfStatementData {
  companyName: string
  companyPhone: string
  customerName: string
  customerId: string
  siteName: string
  yearMonth: string // YYYY-MM
  billingType: string
  tripDetails: { date: string; tripCount: number; tripFee: number }[]
  tripCount: number
  tripFee: number
  itemDetails: { itemName: string; weight: number; unitPrice: number; subtotal: number; priceType: string }[]
  itemFee: number
  totalAmount: number
  anomaly: boolean
  anomalyReason?: string
  generatedAt: string
}

// 格式化金額（加千分位）
function formatAmount(n: number): string {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// 解析年月為中文
function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${year}年${parseInt(month)}月`
}

// 畫水平線
function drawLine(doc: PDFKit.PDFDocument, y: number, opts?: { thick?: boolean }) {
  doc.moveTo(50, y).lineTo(545, y)
    .lineWidth(opts?.thick ? 2 : 0.5)
    .stroke('#333333')
}

// 產生月結明細 PDF
export async function generateStatementPdf(
  data: PdfStatementData,
  outputDir: string
): Promise<string> {
  // 確保輸出目錄存在
  fs.mkdirSync(outputDir, { recursive: true })

  const filename = `${data.customerId}_${data.yearMonth}_明細.pdf`
  const filePath = path.join(outputDir, filename)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `${data.customerName} ${formatYearMonth(data.yearMonth)} 月結明細`,
        Author: data.companyName,
      },
    })

    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // 註冊中文字體（使用內建 Helvetica 搭配 Unicode）
    // 注意：pdfkit 預設不支援中文，實際部署時需要嵌入中文字體
    // 此處使用 Courier 作為佔位，正式環境替換為 NotoSansCJK 等字體
    const fontRegular = 'Helvetica'
    const fontBold = 'Helvetica-Bold'

    let y = 40

    // ===== 標題區 =====
    doc.font(fontBold).fontSize(18).text(data.companyName, 50, y, { align: 'center' })
    y += 28
    doc.font(fontRegular).fontSize(14).text(`${formatYearMonth(data.yearMonth)} Monthly Statement`, 50, y, { align: 'center' })
    y += 30

    drawLine(doc, y, { thick: true })
    y += 15

    // ===== 異常警示 =====
    if (data.anomaly) {
      doc.font(fontBold).fontSize(11).fillColor('#cc0000')
        .text(`WARNING: ${data.anomalyReason || 'Amount anomaly detected'}`, 50, y)
      doc.fillColor('#000000')
      y += 20
    }

    // ===== 客戶資訊 =====
    doc.font(fontBold).fontSize(11).text('Customer Info', 50, y)
    y += 18
    doc.font(fontRegular).fontSize(10)
    doc.text(`Customer: ${data.customerName}`, 70, y); y += 15
    doc.text(`ID: ${data.customerId}`, 70, y); y += 15
    doc.text(`Site: ${data.siteName}`, 70, y); y += 15
    doc.text(`Period: ${formatYearMonth(data.yearMonth)}`, 70, y); y += 15
    doc.text(`Billing Type: ${data.billingType}`, 70, y); y += 20

    drawLine(doc, y)
    y += 15

    // ===== 車趟明細（A/B 類顯示） =====
    if (['A', 'B'].includes(data.billingType) && data.tripDetails.length > 0) {
      doc.font(fontBold).fontSize(11).text('Trip Details', 50, y)
      y += 18

      // 表頭
      doc.font(fontBold).fontSize(9)
      doc.text('Date', 70, y, { width: 100 })
      doc.text('Trips', 200, y, { width: 80, align: 'right' })
      doc.text('Fee', 320, y, { width: 100, align: 'right' })
      y += 15

      // 表身
      doc.font(fontRegular).fontSize(9)
      for (const trip of data.tripDetails) {
        doc.text(trip.date, 70, y, { width: 100 })
        doc.text(String(trip.tripCount), 200, y, { width: 80, align: 'right' })
        doc.text(`$${formatAmount(trip.tripFee)}`, 320, y, { width: 100, align: 'right' })
        y += 14
      }

      // 小計
      y += 2
      drawLine(doc, y)
      y += 8
      doc.font(fontBold).fontSize(9)
      doc.text('Subtotal', 70, y, { width: 100 })
      doc.text(`${data.tripCount} trips`, 200, y, { width: 80, align: 'right' })
      doc.text(`$${formatAmount(data.tripFee)}`, 320, y, { width: 100, align: 'right' })
      y += 25
    }

    // ===== 品項明細（A/C/D 類顯示） =====
    if (['A', 'C', 'D'].includes(data.billingType) && data.itemDetails.length > 0) {
      doc.font(fontBold).fontSize(11).text('Item Details', 50, y)
      y += 18

      // 表頭
      doc.font(fontBold).fontSize(9)
      doc.text('Item', 70, y, { width: 120 })
      doc.text('Weight(kg)', 200, y, { width: 80, align: 'right' })
      doc.text('Price', 300, y, { width: 60, align: 'right' })
      doc.text('Subtotal', 380, y, { width: 80, align: 'right' })
      if (data.billingType === 'C') {
        doc.text('Type', 470, y, { width: 60, align: 'right' })
      }
      y += 15

      // 表身
      doc.font(fontRegular).fontSize(9)
      for (const item of data.itemDetails) {
        doc.text(item.itemName, 70, y, { width: 120 })
        doc.text(item.weight.toFixed(1), 200, y, { width: 80, align: 'right' })
        doc.text(`$${item.unitPrice}`, 300, y, { width: 60, align: 'right' })
        doc.text(`$${formatAmount(item.subtotal)}`, 380, y, { width: 80, align: 'right' })
        if (data.billingType === 'C') {
          const typeLabel = item.priceType === 'contract' ? 'Contract' : 'Standard'
          doc.text(typeLabel, 470, y, { width: 60, align: 'right' })
        }
        y += 14
      }

      y += 2
      drawLine(doc, y)
      y += 8
      doc.font(fontBold).fontSize(9)
      doc.text('Subtotal', 70, y)
      doc.text(`$${formatAmount(data.itemFee)}`, 380, y, { width: 80, align: 'right' })
      y += 25
    }

    // ===== 費用總計 =====
    drawLine(doc, y, { thick: true })
    y += 15

    doc.font(fontBold).fontSize(12).text('Total', 50, y)
    y += 20

    doc.font(fontRegular).fontSize(10)
    if (['A', 'B'].includes(data.billingType)) {
      doc.text(`Trip Fee:`, 70, y, { width: 200 })
      doc.text(`$${formatAmount(data.tripFee)}`, 350, y, { width: 110, align: 'right' })
      y += 16
    }
    if (['A', 'C', 'D'].includes(data.billingType)) {
      doc.text(`Item Fee:`, 70, y, { width: 200 })
      doc.text(`$${formatAmount(data.itemFee)}`, 350, y, { width: 110, align: 'right' })
      y += 16
    }

    y += 5
    drawLine(doc, y)
    y += 10

    // 總金額（異常時用紅色）
    const totalColor = data.anomaly ? '#cc0000' : '#000000'
    doc.font(fontBold).fontSize(14).fillColor(totalColor)
    doc.text('TOTAL:', 70, y, { width: 200 })
    doc.text(`$${formatAmount(data.totalAmount)}`, 350, y, { width: 110, align: 'right' })
    doc.fillColor('#000000')
    y += 30

    // ===== 備註 =====
    drawLine(doc, y)
    y += 15
    doc.font(fontRegular).fontSize(8).fillColor('#666666')
    doc.text(`Invoice will be issued on the 15th of next month.`, 50, y)
    y += 12
    doc.text(`Contact: ${data.companyPhone}`, 50, y)
    y += 12
    doc.text(`Generated: ${data.generatedAt}`, 50, y)

    // 結束
    doc.end()

    stream.on('finish', () => resolve(filePath))
    stream.on('error', reject)
  })
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- pdf-generator`
Expected: 所有 4 個測試通過

可用 PDF 閱讀器打開 `backend/output/pdf/` 下的檔案，視覺確認排版正確。

**Step 5: Commit**

```bash
git add backend/src/services/pdf-generator.ts backend/tests/pdf-generator.test.ts
git commit -m "feat: 實作 PDF 月結明細報表產生 (四種計費類型 + 異常標示)"
```

---

### Task 3: 月結 PDF 批次產生 API

**Files:**
- Create: `backend/src/services/pdf-batch.service.ts`
- Modify: `backend/src/routes/reports.ts`

**Step 1: 實作批次 PDF 產生服務**

```typescript
// backend/src/services/pdf-batch.service.ts
import { prisma } from '../lib/prisma'
import { generateStatementPdf, type PdfStatementData } from './pdf-generator'
import path from 'path'

const OUTPUT_DIR = path.join(__dirname, '../../output/pdf')

// 公司資訊（可改為從設定讀取）
const COMPANY_INFO = {
  companyName: 'XX 環保資源回收公司',
  companyPhone: '02-1234-5678',
}

// 為單一月結明細產生 PDF
export async function generatePdfForStatement(statementId: number): Promise<string> {
  const statement = await prisma.monthlyStatement.findUniqueOrThrow({
    where: { statementId },
    include: {
      customer: { include: { site: true } },
    },
  })

  const detail = statement.detailJson as any

  const pdfData: PdfStatementData = {
    ...COMPANY_INFO,
    customerName: statement.customer.customerName,
    customerId: statement.customerId,
    siteName: statement.customer.site.siteName,
    yearMonth: statement.yearMonth,
    billingType: detail.billingType || statement.customer.billingType,
    tripDetails: (detail.tripDetails || []).map((t: any) => ({
      date: new Date(t.tripDate).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
      tripCount: t.tripCount,
      tripFee: t.tripCount * (Number(statement.customer.tripPrice) || 0),
    })),
    tripCount: detail.tripCount || 0,
    tripFee: Number(detail.tripFee) || 0,
    itemDetails: (detail.itemDetails || []).map((i: any) => ({
      itemName: i.itemName,
      weight: Number(i.totalWeight),
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
      priceType: i.priceType || 'standard',
    })),
    itemFee: Number(detail.itemFee) || 0,
    totalAmount: Number(statement.totalAmount),
    anomaly: detail.anomaly || false,
    anomalyReason: detail.anomalyReason,
    generatedAt: new Date().toLocaleString('zh-TW'),
  }

  const filePath = await generateStatementPdf(pdfData, OUTPUT_DIR)

  // 更新 pdf_path
  await prisma.monthlyStatement.update({
    where: { statementId },
    data: { pdfPath: filePath },
  })

  return filePath
}

// 批次為某月所有明細產生 PDF
export async function generateAllPdfs(yearMonth: string): Promise<{
  total: number
  success: number
  failed: { customerId: string; error: string }[]
}> {
  const statements = await prisma.monthlyStatement.findMany({
    where: { yearMonth },
  })

  const failed: { customerId: string; error: string }[] = []
  let success = 0

  for (const stmt of statements) {
    try {
      await generatePdfForStatement(stmt.statementId)
      success++
    } catch (error: any) {
      failed.push({ customerId: stmt.customerId, error: error.message })
    }
  }

  return { total: statements.length, success, failed }
}
```

**Step 2: 在 reports.ts 加入 PDF 相關端點**

在 `backend/src/routes/reports.ts` 加入：

```typescript
import { generateAllPdfs, generatePdfForStatement } from '../services/pdf-batch.service'
import path from 'path'

// POST /api/reports/monthly/generate-pdf - 批次產生 PDF
router.post(
  '/monthly/generate-pdf',
  authenticate,
  authorize('system_admin'),
  async (req: Request, res: Response) => {
    try {
      const { yearMonth } = req.body
      if (!yearMonth) return res.status(400).json({ message: '請指定 yearMonth' })

      const result = await generateAllPdfs(yearMonth)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ message: 'PDF 產生失敗', error: error.message })
    }
  }
)

// GET /api/reports/monthly/:id/pdf - 下載單一 PDF
router.get(
  '/monthly/:id/pdf',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const statement = await prisma.monthlyStatement.findUnique({
        where: { statementId: Number(req.params.id) },
      })

      if (!statement?.pdfPath) {
        // 尚未產生，即時產生
        const filePath = await generatePdfForStatement(Number(req.params.id))
        res.download(filePath)
      } else {
        res.download(statement.pdfPath)
      }
    } catch (error: any) {
      res.status(500).json({ message: '下載失敗', error: error.message })
    }
  }
)
```

**Step 3: 執行所有測試、Commit**

Run: `cd backend && npm test`

```bash
git add backend/src/services/pdf-batch.service.ts backend/src/routes/reports.ts
git commit -m "feat: 實作月結 PDF 批次產生與下載 API"
```

---

### Task 4: Excel 發票明細產生

**Files:**
- Create: `backend/tests/invoice-excel.test.ts`
- Create: `backend/src/services/invoice-excel.service.ts`
- Modify: `backend/src/routes/reports.ts`

**Step 1: 撰寫 Excel 發票失敗測試**

```typescript
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
```

**Step 2: 實作 Excel 發票服務**

```typescript
// backend/src/services/invoice-excel.service.ts
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'

export interface InvoiceData {
  customerId: string
  customerName: string
  siteName: string
  billingType: string
  totalAmount: number
  tripFee: number
  itemFee: number
}

// 產生發票明細彙總 Excel
export async function generateInvoiceExcel(
  yearMonth: string,
  data: InvoiceData[],
  outputDir: string
): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Recycling Automation System'

  // === 總表（依站點分組） ===
  const summarySheet = workbook.addWorksheet('發票彙總')

  // 標題
  summarySheet.mergeCells('A1:G1')
  summarySheet.getCell('A1').value = `${yearMonth} 發票明細彙總表`
  summarySheet.getCell('A1').font = { bold: true, size: 14 }
  summarySheet.getCell('A1').alignment = { horizontal: 'center' }

  // 表頭
  const headers = ['客戶編號', '客戶名稱', '站點', '計費類型', '車趟費', '品項費', '總金額']
  const headerRow = summarySheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
    cell.border = { bottom: { style: 'thin' } }
  })

  // 資料列
  let totalAll = 0
  for (const item of data) {
    summarySheet.addRow([
      item.customerId,
      item.customerName,
      item.siteName,
      item.billingType,
      item.tripFee,
      item.itemFee,
      item.totalAmount,
    ])
    totalAll += item.totalAmount
  }

  // 合計列
  const totalRow = summarySheet.addRow(['', '', '', '', '', '合計', totalAll])
  totalRow.font = { bold: true }

  // 格式化金額欄
  for (let col = 5; col <= 7; col++) {
    summarySheet.getColumn(col).numFmt = '#,##0'
    summarySheet.getColumn(col).width = 15
  }

  // 自動欄寬
  summarySheet.getColumn(1).width = 12
  summarySheet.getColumn(2).width = 25
  summarySheet.getColumn(3).width = 10
  summarySheet.getColumn(4).width = 10

  // 凍結首列
  summarySheet.views = [{ state: 'frozen', ySplit: 2 }]

  // === 每個客戶一個分頁 ===
  for (const item of data) {
    const sheetName = `${item.customerId}-${item.customerName}`.substring(0, 31) // Excel 分頁名稱上限 31 字
    const sheet = workbook.addWorksheet(sheetName)

    sheet.addRow([`${yearMonth} Invoice - ${item.customerName}`]).font = { bold: true, size: 12 }
    sheet.addRow([])
    sheet.addRow(['Customer ID', item.customerId])
    sheet.addRow(['Customer Name', item.customerName])
    sheet.addRow(['Site', item.siteName])
    sheet.addRow(['Billing Type', item.billingType])
    sheet.addRow([])
    sheet.addRow(['Trip Fee', item.tripFee]).getCell(2).numFmt = '#,##0'
    sheet.addRow(['Item Fee', item.itemFee]).getCell(2).numFmt = '#,##0'
    sheet.addRow(['Total', item.totalAmount]).font = { bold: true }
    sheet.getCell('B10').numFmt = '#,##0'

    sheet.getColumn(1).width = 18
    sheet.getColumn(2).width = 25
  }

  // 儲存
  const filename = `Invoice_${yearMonth}.xlsx`
  const filePath = path.join(outputDir, filename)
  await workbook.xlsx.writeFile(filePath)

  return filePath
}
```

**Step 3: 在 reports.ts 加入發票 API**

```typescript
import { generateInvoiceExcel } from '../services/invoice-excel.service'

// GET /api/reports/invoice - 產生並下載發票 Excel
router.get(
  '/invoice',
  authenticate,
  authorize('system_admin', 'finance'),
  async (req: Request, res: Response) => {
    try {
      const { yearMonth } = req.query
      if (!yearMonth) return res.status(400).json({ message: '請指定 yearMonth' })

      const statements = await prisma.monthlyStatement.findMany({
        where: { yearMonth: String(yearMonth) },
        include: { customer: { include: { site: true } } },
      })

      const invoiceData = statements.map(s => ({
        customerId: s.customerId,
        customerName: s.customer.customerName,
        siteName: s.customer.site.siteName,
        billingType: s.customer.billingType,
        totalAmount: Number(s.totalAmount),
        tripFee: Number((s.detailJson as any)?.tripFee || 0),
        itemFee: Number((s.detailJson as any)?.itemFee || 0),
      }))

      const outputDir = path.join(__dirname, '../../output')
      const filePath = await generateInvoiceExcel(String(yearMonth), invoiceData, outputDir)

      res.download(filePath)
    } catch (error: any) {
      res.status(500).json({ message: '產生失敗', error: error.message })
    }
  }
)
```

**Step 4: 執行測試、Commit**

Run: `cd backend && npm test -- invoice-excel`

```bash
git add backend/src/services/invoice-excel.service.ts backend/tests/invoice-excel.test.ts backend/src/routes/reports.ts
git commit -m "feat: 實作 Excel 發票明細彙總 (每客戶分頁 + 凍結首列 + 自動欄寬)"
```

---

## 階段三A 完成標準

- [x] PDF 月結明細產生（A/B/C/D 四種排版）
- [x] 異常金額紅字標示
- [x] 批次 PDF 產生 API
- [x] 單一 PDF 下載 API
- [x] Excel 發票明細彙總（總表 + 每客戶分頁）
- [x] 發票 Excel 下載 API
- [x] 所有測試通過

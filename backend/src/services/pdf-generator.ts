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
    // 此處使用 Helvetica 作為佔位，正式環境替換為 NotoSansCJK 等字體
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

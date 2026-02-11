// backend/src/services/pdf-generator.ts
import PDFDocument from 'pdfkit'
import prisma from '../lib/prisma'
import { calculateMonthlyBilling, BillingResult } from './billing.service'

// 產出客戶月結明細 PDF
export async function generateStatementPDF(customerId: number, yearMonth: string): Promise<Buffer> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { site: { select: { name: true } } },
  })
  if (!customer) throw new Error('客戶不存在')

  const billing = await calculateMonthlyBilling(customerId, yearMonth)

  return buildPDF(customer, yearMonth, billing)
}

// 從已存在的 statement 產出 PDF
export async function generateStatementPDFFromId(statementId: number): Promise<Buffer> {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    include: {
      customer: { include: { site: { select: { name: true } } } },
    },
  })
  if (!statement) throw new Error('明細不存在')

  const billing: BillingResult = {
    itemReceivable: Number(statement.itemReceivable),
    itemPayable: Number(statement.itemPayable),
    tripFeeTotal: Number(statement.tripFeeTotal),
    additionalFeeReceivable: Number(statement.additionalFeeReceivable),
    additionalFeePayable: Number(statement.additionalFeePayable),
    totalReceivable: Number(statement.totalReceivable),
    totalPayable: Number(statement.totalPayable),
    netAmount: Number(statement.netAmount),
    subtotal: Number(statement.subtotal),
    taxAmount: Number(statement.taxAmount),
    totalAmount: Number(statement.totalAmount),
    receivableSubtotal: statement.receivableSubtotal ? Number(statement.receivableSubtotal) : undefined,
    receivableTax: statement.receivableTax ? Number(statement.receivableTax) : undefined,
    receivableTotal: statement.receivableTotal ? Number(statement.receivableTotal) : undefined,
    payableSubtotal: statement.payableSubtotal ? Number(statement.payableSubtotal) : undefined,
    payableTax: statement.payableTax ? Number(statement.payableTax) : undefined,
    payableTotal: statement.payableTotal ? Number(statement.payableTotal) : undefined,
    details: statement.detailJson as any || { items: [], tripFee: { count: 0, amount: 0, type: null }, fees: [] },
  }

  return buildPDF(statement.customer, statement.yearMonth, billing)
}

function buildPDF(customer: any, yearMonth: string, billing: BillingResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // 公司標頭
      doc.fontSize(18).text('資源回收管理系統', { align: 'center' })
      doc.fontSize(12).text('月結明細表', { align: 'center' })
      doc.moveDown()

      // 客戶資訊
      const [yearStr, monthStr] = yearMonth.split('-')
      doc.fontSize(10)
      doc.text(`結算月份：${yearStr} 年 ${monthStr} 月`)
      doc.text(`客戶名稱：${customer.name}`)
      doc.text(`站區：${customer.site?.name || '-'}`)
      doc.text(`客戶類型：${customer.type === 'contracted' ? '簽約客戶' : '臨時客戶'}`)
      doc.text(`聯絡人：${customer.contactPerson || '-'}`)
      doc.text(`電話：${customer.phone || '-'}`)
      doc.text(`地址：${customer.address || '-'}`)
      doc.moveDown()

      // 收運明細表格
      doc.fontSize(12).text('收運明細', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(9)

      // 表頭
      const tableTop = doc.y
      const col = [50, 120, 250, 310, 360, 410, 470]
      doc.text('日期', col[0], tableTop)
      doc.text('品項', col[1], tableTop)
      doc.text('數量', col[2], tableTop)
      doc.text('單位', col[3], tableTop)
      doc.text('單價', col[4], tableTop)
      doc.text('方向', col[5], tableTop)
      doc.text('金額', col[6], tableTop)

      doc.moveTo(50, tableTop + 12).lineTo(545, tableTop + 12).stroke()
      let y = tableTop + 16

      for (const item of billing.details.items) {
        if (y > 750) {
          doc.addPage()
          y = 50
        }
        const dateStr = item.tripDate instanceof Date
          ? `${item.tripDate.getMonth() + 1}/${item.tripDate.getDate()}`
          : String(item.tripDate).substring(5, 10)
        const dirLabel = item.billingDirection === 'receivable' ? '應收' : item.billingDirection === 'payable' ? '應付' : '免費'
        doc.text(dateStr, col[0], y)
        doc.text(item.itemName, col[1], y)
        doc.text(String(item.quantity), col[2], y)
        doc.text(item.unit, col[3], y)
        doc.text(String(item.unitPrice), col[4], y)
        doc.text(dirLabel, col[5], y)
        doc.text(String(item.amount), col[6], y)
        y += 14
      }

      doc.moveDown()
      y = doc.y + 10

      // 車趟費
      if (billing.tripFeeTotal > 0) {
        doc.fontSize(10).text(`車趟費：${billing.details.tripFee.count} 趟 × ${billing.details.tripFee.type === 'per_trip' ? '按次' : '按月'} = ${billing.tripFeeTotal}`, 50, y)
        y += 16
      }

      // 附加費用
      if (billing.details.fees.length > 0) {
        doc.fontSize(10).text('附加費用：', 50, y)
        y += 14
        for (const fee of billing.details.fees) {
          const dir = fee.direction === 'receivable' ? '應收' : '應付'
          doc.fontSize(9).text(`  ${fee.name} (${dir}/${fee.frequency === 'monthly' ? '月' : '趟'}): ${fee.amount}`, 50, y)
          y += 14
        }
      }

      y += 10

      // 彙總
      doc.fontSize(12).text('彙總', 50, y, { underline: true })
      y += 18
      doc.fontSize(10)
      doc.text(`應收小計：${billing.totalReceivable}`, 50, y); y += 14
      doc.text(`應付小計：${billing.totalPayable}`, 50, y); y += 14
      doc.text(`淨額：${billing.netAmount}`, 50, y); y += 14

      if (billing.receivableSubtotal !== undefined) {
        doc.text(`應收稅額 (5%)：${billing.receivableTax}`, 50, y); y += 14
        doc.text(`應收含稅：${billing.receivableTotal}`, 50, y); y += 14
        doc.text(`應付稅額 (5%)：${billing.payableTax}`, 50, y); y += 14
        doc.text(`應付含稅：${billing.payableTotal}`, 50, y); y += 14
      } else {
        doc.text(`稅額 (5%)：${billing.taxAmount}`, 50, y); y += 14
      }

      doc.fontSize(12).text(`總額：${billing.totalAmount}`, 50, y)
      y += 20

      // 匯款帳戶
      if (customer.paymentAccount) {
        doc.fontSize(10).text(`匯款帳戶：${customer.paymentAccount}`, 50, y)
      }

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}

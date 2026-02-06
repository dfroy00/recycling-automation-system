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

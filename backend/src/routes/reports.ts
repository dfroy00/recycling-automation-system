// backend/src/routes/reports.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { generateAllStatements, generateMonthlyStatement } from '../services/monthly-statement.service'
import { generateAllPdfs, generatePdfForStatement } from '../services/pdf-batch.service'
import { generateInvoiceExcel } from '../services/invoice-excel.service'
import path from 'path'

const router = Router()

// POST /api/reports/monthly/generate - 產生月結明細
router.post(
  '/monthly/generate',
  authenticate,
  authorize('system_admin'),
  async (req: Request, res: Response) => {
    try {
      const { yearMonth, siteId } = req.body
      if (!yearMonth) {
        res.status(400).json({ message: '請指定 yearMonth (YYYY-MM)' })
        return
      }

      const results = await generateAllStatements(yearMonth, siteId)

      res.json({
        yearMonth,
        total: results.length,
        results: results.map(r => ({
          customerId: r.customerId,
          totalAmount: r.totalAmount.toNumber(),
          tripCount: r.tripCount,
        })),
      })
    } catch (error: any) {
      console.error('產生月結明細失敗:', error)
      res.status(500).json({ message: '產生失敗', error: error.message })
    }
  }
)

// GET /api/reports/monthly - 查詢月結明細
router.get('/monthly', authenticate, async (req: Request, res: Response) => {
  try {
    const { yearMonth, siteId, customerId, page = '1', pageSize = '20' } = req.query

    const where: any = {}
    if (yearMonth) where.yearMonth = yearMonth
    if (siteId) where.siteId = siteId
    if (customerId) where.customerId = customerId

    // 站點管理員只能看自己站點
    if (req.user?.role === 'site_admin' && req.user.siteId) {
      where.siteId = req.user.siteId
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.monthlyStatement.findMany({
        where,
        include: { customer: { select: { customerName: true, billingType: true } } },
        skip,
        take: Number(pageSize),
        orderBy: { generatedAt: 'desc' },
      }),
      prisma.monthlyStatement.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/reports/monthly/generate-pdf - 批次產生 PDF
router.post(
  '/monthly/generate-pdf',
  authenticate,
  authorize('system_admin'),
  async (req: Request, res: Response) => {
    try {
      const { yearMonth } = req.body
      if (!yearMonth) {
        res.status(400).json({ message: '請指定 yearMonth' })
        return
      }

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

// GET /api/reports/invoice - 產生並下載發票 Excel
router.get(
  '/invoice',
  authenticate,
  authorize('system_admin', 'finance'),
  async (req: Request, res: Response) => {
    try {
      const { yearMonth } = req.query
      if (!yearMonth) {
        res.status(400).json({ message: '請指定 yearMonth' })
        return
      }

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

export default router

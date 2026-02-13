// backend/src/routes/reports.ts
import { Router, Request, Response } from 'express'
import { generateStatementPDF, generateStatementPDFFromId } from '../services/pdf-generator'
import { generateSiteReport } from '../services/excel-report.service'
import { acquireReportSlot, releaseReportSlot } from '../middleware/pagination'

const router = Router()

// GET /api/reports/customers/:customerId?yearMonth=2026-01
// 產出客戶月結明細 PDF
router.get('/customers/:customerId', async (req: Request, res: Response) => {
  const { yearMonth } = req.query
  if (!yearMonth) {
    res.status(400).json({ error: '請提供 yearMonth 參數' })
    return
  }

  if (!acquireReportSlot()) {
    res.status(503).json({ error: '報表產出繁忙，請稍後再試' })
    return
  }

  try {
    const pdfBuffer = await generateStatementPDF(Number(req.params.customerId), yearMonth as string)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="statement-${yearMonth}-${req.params.customerId}.pdf"`)
    res.send(pdfBuffer)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  } finally {
    releaseReportSlot()
  }
})

// GET /api/reports/statements/:statementId/pdf
// 從已存在的 statement 產出 PDF
router.get('/statements/:statementId/pdf', async (req: Request, res: Response) => {
  if (!acquireReportSlot()) {
    res.status(503).json({ error: '報表產出繁忙，請稍後再試' })
    return
  }

  try {
    const pdfBuffer = await generateStatementPDFFromId(Number(req.params.statementId))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="statement-${req.params.statementId}.pdf"`)
    res.send(pdfBuffer)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  } finally {
    releaseReportSlot()
  }
})

// GET /api/reports/sites/:siteId?yearMonth=2026-01
// 產出站區彙總報表 Excel
router.get('/sites/:siteId', async (req: Request, res: Response) => {
  const { yearMonth } = req.query
  if (!yearMonth) {
    res.status(400).json({ error: '請提供 yearMonth 參數' })
    return
  }

  if (!acquireReportSlot()) {
    res.status(503).json({ error: '報表產出繁忙，請稍後再試' })
    return
  }

  try {
    const excelBuffer = await generateSiteReport(Number(req.params.siteId), yearMonth as string)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="site-report-${yearMonth}-${req.params.siteId}.xlsx"`)
    res.send(excelBuffer)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  } finally {
    releaseReportSlot()
  }
})

export default router

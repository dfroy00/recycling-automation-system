// backend/src/middleware/pagination.ts
import { Request } from 'express'

export function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const all = req.query.all === 'true'  // 下拉選單用，取消分頁
  return { page, pageSize, skip: (page - 1) * pageSize, all }
}

export function paginationResponse(data: any[], total: number, page: number, pageSize: number) {
  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}

// 報表並發限制
let reportConcurrency = 0
const MAX_REPORT_CONCURRENCY = 5

export function acquireReportSlot(): boolean {
  if (reportConcurrency >= MAX_REPORT_CONCURRENCY) return false
  reportConcurrency++
  return true
}

export function releaseReportSlot(): void {
  reportConcurrency = Math.max(0, reportConcurrency - 1)
}

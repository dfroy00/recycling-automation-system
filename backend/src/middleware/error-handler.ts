// backend/src/middleware/error-handler.ts
// 全域錯誤處理中介層 + 工具函數
import { Request, Response, NextFunction, RequestHandler } from 'express'

// Async 路由包裝器：自動捕獲 async 錯誤轉交全域中介層
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Prisma 錯誤轉 HTTP 回應
export function handlePrismaError(e: any, res: Response, entityName = '資料'): boolean {
  if (e?.code === 'P2025') {
    res.status(404).json({ error: `${entityName}不存在` })
    return true
  }
  if (e?.code === 'P2002') {
    const fields = e.meta?.target?.join(', ') || '欄位'
    res.status(409).json({ error: `${fields} 已存在` })
    return true
  }
  if (e?.code === 'P2003') {
    res.status(400).json({ error: '關聯資料不存在，無法執行此操作' })
    return true
  }
  return false
}

// 全域錯誤處理中介層（必須放在所有路由之後）
export function globalErrorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // 先嘗試 Prisma 錯誤
  if (handlePrismaError(err, res)) return

  // 記錄錯誤
  console.error('[Global Error Handler]', err)

  const statusCode = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? '伺服器內部錯誤'
    : err.message || '伺服器內部錯誤'

  res.status(statusCode).json({ error: message })
}

// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { RoleRequest } from './authorize'

// 重新匯出 RoleRequest 作為 AuthRequest，保持向後相容
export type AuthRequest = RoleRequest

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: '未提供認證 Token' })
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number
      userName: string
      role: string
      siteId: number | null
    }
    const authReq = req as AuthRequest
    authReq.userId = decoded.userId
    authReq.userName = decoded.userName
    authReq.userRole = decoded.role
    authReq.userSiteId = decoded.siteId
    next()
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' })
  }
}

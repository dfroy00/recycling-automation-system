// backend/src/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express'

/**
 * 擴展 Request 型別，包含角色與站區資訊
 */
export interface RoleRequest extends Request {
  userId?: number
  userName?: string
  userRole?: string
  userSiteId?: number | null
}

/**
 * 角色授權中介層
 * 檢查使用者角色是否在允許清單中，不符回傳 403
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleReq = req as RoleRequest

    // 未登入
    if (!roleReq.userId) {
      res.status(401).json({ error: '未登入' })
      return
    }

    // 角色不在允許清單
    if (!roleReq.userRole || !allowedRoles.includes(roleReq.userRole)) {
      res.status(403).json({ error: '權限不足' })
      return
    }

    next()
  }
}

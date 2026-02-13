// backend/src/middleware/site-scope.ts
import { Request, Response, NextFunction } from 'express'
import type { RoleRequest } from './authorize'

/**
 * 擴展 RoleRequest，包含站區範圍過濾 ID
 */
export interface ScopedRequest extends RoleRequest {
  scopedSiteId?: number // 非 super_admin 時，自動注入的站區過濾 ID
}

/**
 * 站區範圍中介層
 * 為非 super_admin 的使用者自動注入 siteId 過濾條件
 * super_admin 不限制站區範圍
 */
export function siteScope() {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleReq = req as ScopedRequest

    // super_admin 不限制站區
    if (roleReq.userRole === 'super_admin') {
      next()
      return
    }

    // 非 super_admin 必須有 siteId
    if (!roleReq.userSiteId) {
      res.status(403).json({ error: '使用者未綁定站區' })
      return
    }

    // 注入站區過濾 ID 供 route handler 使用
    roleReq.scopedSiteId = roleReq.userSiteId
    next()
  }
}

// backend/src/routes/helpers.ts
// 路由 handler 共用工廠函式
import { Request, Response } from 'express'
import prisma from '../lib/prisma'

/**
 * 建立停用 handler（將 status 設為 inactive）
 */
export function createDeactivateHandler(model: string, entityName: string, paramName = 'id') {
  return async (req: Request, res: Response) => {
    try {
      await (prisma as any)[model].update({
        where: { id: Number(req.params[paramName]) },
        data: { status: 'inactive' },
      })
      res.json({ message: '已停用' })
    } catch (e: any) {
      if (e.code === 'P2025') {
        res.status(404).json({ error: `${entityName}不存在` })
        return
      }
      throw e
    }
  }
}

/**
 * 建立啟用 handler（將 status 恢復 active）
 */
export function createReactivateHandler(model: string, entityName: string, paramName = 'id') {
  return async (req: Request, res: Response) => {
    try {
      await (prisma as any)[model].update({
        where: { id: Number(req.params[paramName]) },
        data: { status: 'active' },
      })
      res.json({ message: '已啟用' })
    } catch (e: any) {
      if (e.code === 'P2025') {
        res.status(404).json({ error: `${entityName}不存在` })
        return
      }
      throw e
    }
  }
}

/**
 * 建立硬刪除 handler
 * @param fkErrorMsg - 外鍵衝突時的錯誤訊息（P2003）
 */
export function createHardDeleteHandler(model: string, entityName: string, fkErrorMsg?: string, paramName = 'id') {
  return async (req: Request, res: Response) => {
    try {
      await (prisma as any)[model].delete({
        where: { id: Number(req.params[paramName]) },
      })
      res.json({ message: '已刪除' })
    } catch (e: any) {
      if (e.code === 'P2025') {
        res.status(404).json({ error: `${entityName}不存在` })
        return
      }
      if (e.code === 'P2003' && fkErrorMsg) {
        res.status(409).json({ error: fkErrorMsg })
        return
      }
      throw e
    }
  }
}

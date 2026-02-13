// backend/src/routes/business-entities.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'
import { authorize } from '../middleware/authorize'
import { createDeactivateHandler, createReactivateHandler, createHardDeleteHandler } from './helpers'

const router = Router()

// GET /api/business-entities — 列表（支援分頁、all=true、狀態篩選）
router.get('/', async (req: Request, res: Response) => {
  const { status } = req.query
  const where: any = {}
  if (status) where.status = status as string

  const { page, pageSize, skip, all } = parsePagination(req)

  if (all) {
    const entities = await prisma.businessEntity.findMany({ where, orderBy: { id: 'asc' } })
    res.json(entities)
    return
  }

  const [entities, total] = await Promise.all([
    prisma.businessEntity.findMany({ where, orderBy: { id: 'asc' }, skip, take: pageSize }),
    prisma.businessEntity.count({ where }),
  ])
  res.json(paginationResponse(entities, total, page, pageSize))
})

// GET /api/business-entities/:id — 詳情
router.get('/:id', async (req: Request, res: Response) => {
  const entity = await prisma.businessEntity.findUnique({ where: { id: Number(req.params.id) } })
  if (!entity) {
    res.status(404).json({ error: '行號不存在' })
    return
  }
  res.json(entity)
})

// POST /api/business-entities — 新增 — 僅 super_admin
router.post('/', authorize('super_admin'), async (req: Request, res: Response) => {
  const { name, taxId, bizItems, status } = req.body
  if (!name) {
    res.status(400).json({ error: '行號名稱為必填' })
    return
  }
  if (!taxId) {
    res.status(400).json({ error: '統一編號為必填' })
    return
  }

  try {
    const entity = await prisma.businessEntity.create({
      data: { name, taxId, bizItems, status },
    })
    res.status(201).json(entity)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '行號名稱或統一編號已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/business-entities/:id — 更新 — 僅 super_admin
router.patch('/:id', authorize('super_admin'), async (req: Request, res: Response) => {
  const { name, taxId, bizItems, status } = req.body
  try {
    const entity = await prisma.businessEntity.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name && { name }),
        ...(taxId && { taxId }),
        ...(bizItems !== undefined && { bizItems }),
        ...(status && { status }),
      },
    })
    res.json(entity)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '行號不存在' })
      return
    }
    if (e.code === 'P2002') {
      res.status(409).json({ error: '行號名稱或統一編號已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/business-entities/:id/deactivate — 停用 — 僅 super_admin
router.patch('/:id/deactivate', authorize('super_admin'), createDeactivateHandler('businessEntity', '行號'))

// PATCH /api/business-entities/:id/reactivate — 啟用（恢復 active）— 僅 super_admin
router.patch('/:id/reactivate', authorize('super_admin'), createReactivateHandler('businessEntity', '行號'))

// DELETE /api/business-entities/:id — 硬刪除 — 僅 super_admin
router.delete('/:id', authorize('super_admin'), createHardDeleteHandler('businessEntity', '行號', '無法刪除：此行號仍有關聯的客戶或明細'))

export default router

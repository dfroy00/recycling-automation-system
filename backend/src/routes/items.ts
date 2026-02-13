// backend/src/routes/items.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'
import { authorize } from '../middleware/authorize'
import { createDeactivateHandler, createReactivateHandler, createHardDeleteHandler } from './helpers'

const router = Router()

// GET /api/items — 列表（支援分頁）
router.get('/', async (req: Request, res: Response) => {
  const { category, status } = req.query
  const where: any = {}
  if (category) where.category = category as string
  if (status) where.status = status as string

  const { page, pageSize, skip, all } = parsePagination(req)

  if (all) {
    const items = await prisma.item.findMany({ where, orderBy: { id: 'asc' } })
    res.json(items)
    return
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({ where, orderBy: { id: 'asc' }, skip, take: pageSize }),
    prisma.item.count({ where }),
  ])
  res.json(paginationResponse(items, total, page, pageSize))
})

// GET /api/items/:id — 詳情
router.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.item.findUnique({ where: { id: Number(req.params.id) } })
  if (!item) {
    res.status(404).json({ error: '品項不存在' })
    return
  }
  res.json(item)
})

// POST /api/items — 新增 — 僅 super_admin
router.post('/', authorize('super_admin'), async (req: Request, res: Response) => {
  const { name, category, unit } = req.body
  if (!name || !unit) {
    res.status(400).json({ error: '品項名稱和計量單位為必填' })
    return
  }

  try {
    const item = await prisma.item.create({ data: { name, category, unit } })
    res.status(201).json(item)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '品項名稱已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/items/:id — 更新 — 僅 super_admin
router.patch('/:id', authorize('super_admin'), async (req: Request, res: Response) => {
  const { name, category, unit, status } = req.body
  try {
    const item = await prisma.item.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name && { name }),
        ...(category !== undefined && { category }),
        ...(unit && { unit }),
        ...(status && { status }),
      },
    })
    res.json(item)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '品項不存在' })
      return
    }
    if (e.code === 'P2002') {
      res.status(409).json({ error: '品項名稱已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/items/:id/deactivate — 停用 — 僅 super_admin
router.patch('/:id/deactivate', authorize('super_admin'), createDeactivateHandler('item', '品項'))

// PATCH /api/items/:id/reactivate — 啟用（恢復 active）— 僅 super_admin
router.patch('/:id/reactivate', authorize('super_admin'), createReactivateHandler('item', '品項'))

// DELETE /api/items/:id — 硬刪除 — 僅 super_admin
router.delete('/:id', authorize('super_admin'), createHardDeleteHandler('item', '品項', '無法刪除：此品項仍有關聯的合約或車趟'))

export default router

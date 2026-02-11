// backend/src/routes/items.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'

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

// POST /api/items — 新增
router.post('/', async (req: Request, res: Response) => {
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

// PATCH /api/items/:id — 更新
router.patch('/:id', async (req: Request, res: Response) => {
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

// DELETE /api/items/:id — 刪除（軟刪除）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.item.update({
      where: { id: Number(req.params.id) },
      data: { status: 'inactive' },
    })
    res.json({ message: '已停用' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '品項不存在' })
      return
    }
    throw e
  }
})

export default router

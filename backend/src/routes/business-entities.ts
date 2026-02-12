// backend/src/routes/business-entities.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'

const router = Router()

// GET /api/business-entities — 列表（支援分頁與 all=true）
router.get('/', async (req: Request, res: Response) => {
  const { page, pageSize, skip, all } = parsePagination(req)

  if (all) {
    const entities = await prisma.businessEntity.findMany({ orderBy: { id: 'asc' } })
    res.json(entities)
    return
  }

  const [entities, total] = await Promise.all([
    prisma.businessEntity.findMany({ orderBy: { id: 'asc' }, skip, take: pageSize }),
    prisma.businessEntity.count(),
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

// POST /api/business-entities — 新增
router.post('/', async (req: Request, res: Response) => {
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

// PATCH /api/business-entities/:id — 更新
router.patch('/:id', async (req: Request, res: Response) => {
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

// DELETE /api/business-entities/:id — 刪除（軟刪除）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.businessEntity.update({
      where: { id: Number(req.params.id) },
      data: { status: 'inactive' },
    })
    res.json({ message: '已停用' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '行號不存在' })
      return
    }
    throw e
  }
})

export default router

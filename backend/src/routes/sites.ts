// backend/src/routes/sites.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'

const router = Router()

// GET /api/sites — 列表（支援分頁）
router.get('/', async (req: Request, res: Response) => {
  const { page, pageSize, skip, all } = parsePagination(req)

  if (all) {
    const sites = await prisma.site.findMany({ orderBy: { id: 'asc' } })
    res.json(sites)
    return
  }

  const [sites, total] = await Promise.all([
    prisma.site.findMany({ orderBy: { id: 'asc' }, skip, take: pageSize }),
    prisma.site.count(),
  ])
  res.json(paginationResponse(sites, total, page, pageSize))
})

// GET /api/sites/:id — 詳情
router.get('/:id', async (req: Request, res: Response) => {
  const site = await prisma.site.findUnique({ where: { id: Number(req.params.id) } })
  if (!site) {
    res.status(404).json({ error: '站區不存在' })
    return
  }
  res.json(site)
})

// POST /api/sites — 新增
router.post('/', async (req: Request, res: Response) => {
  const { name, address, phone } = req.body
  if (!name) {
    res.status(400).json({ error: '站區名稱為必填' })
    return
  }

  try {
    const site = await prisma.site.create({ data: { name, address, phone } })
    res.status(201).json(site)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '站區名稱已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/sites/:id — 更新
router.patch('/:id', async (req: Request, res: Response) => {
  const { name, address, phone, status } = req.body
  try {
    const site = await prisma.site.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(status && { status }),
      },
    })
    res.json(site)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '站區不存在' })
      return
    }
    if (e.code === 'P2002') {
      res.status(409).json({ error: '站區名稱已存在' })
      return
    }
    throw e
  }
})

// DELETE /api/sites/:id — 刪除（軟刪除）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.site.update({
      where: { id: Number(req.params.id) },
      data: { status: 'inactive' },
    })
    res.json({ message: '已停用' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '站區不存在' })
      return
    }
    throw e
  }
})

export default router

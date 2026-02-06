import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/sites - 取得站點清單
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { siteId: 'asc' },
    })
    res.json(sites)
  } catch (error) {
    console.error('查詢站點失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// POST /api/sites - 新增站點（僅系統管理員）
router.post('/', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { siteId, siteName, manager, contactPhone, contactEmail } = req.body

    if (!siteId || !siteName) {
      res.status(400).json({ message: '缺少必填欄位：siteId, siteName' })
      return
    }

    const site = await prisma.site.create({
      data: { siteId, siteName, manager, contactPhone, contactEmail },
    })

    res.status(201).json(site)
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: `站點 ${req.body.siteId} 已存在` })
      return
    }
    console.error('新增站點失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// GET /api/sites/:id - 取得單一站點
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const site = await prisma.site.findUnique({
      where: { siteId: req.params.id },
      include: { _count: { select: { customers: true } } },
    })
    if (!site) {
      return res.status(404).json({ message: '站點不存在' })
    }
    res.json(site)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// PUT /api/sites/:id - 更新站點
router.put('/:id', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const site = await prisma.site.update({
      where: { siteId: req.params.id },
      data: req.body,
    })
    res.json(site)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: '站點不存在' })
    }
    res.status(500).json({ message: '更新失敗', error: error.message })
  }
})

export default router

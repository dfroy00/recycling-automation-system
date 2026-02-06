import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// 建立站點篩選條件（站點管理員只看自己站點）
function getSiteFilter(user: any) {
  if (user.role === 'site_admin' && user.siteId) {
    return { siteId: user.siteId }
  }
  return {}
}

// GET /api/customers - 取得客戶清單
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { siteId, billingType, status, search, page = '1', pageSize = '20' } = req.query
    const where: any = { ...getSiteFilter(req.user) }

    if (siteId) where.siteId = siteId
    if (billingType) where.billingType = billingType
    if (status) where.status = status
    if (search) {
      where.OR = [
        { customerId: { contains: String(search), mode: 'insensitive' } },
        { customerName: { contains: String(search), mode: 'insensitive' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { site: { select: { siteName: true } } },
        skip,
        take: Number(pageSize),
        orderBy: { customerId: 'asc' },
      }),
      prisma.customer.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// GET /api/customers/:id - 取得單一客戶
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { customerId: req.params.id },
      include: {
        site: { select: { siteName: true } },
        contractPrices: true,
      },
    })
    if (!customer) {
      return res.status(404).json({ message: '客戶不存在' })
    }
    res.json(customer)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/customers - 新增客戶
router.post('/', authenticate, authorize('system_admin', 'site_admin'), async (req: Request, res: Response) => {
  try {
    const { customerId, siteId, customerName, billingType, tripPrice, notificationMethod, lineId, email } = req.body

    if (!customerId || !siteId || !customerName || !billingType) {
      return res.status(400).json({ message: '缺少必填欄位' })
    }

    const customer = await prisma.customer.create({
      data: { customerId, siteId, customerName, billingType, tripPrice, notificationMethod, lineId, email },
    })
    res.status(201).json(customer)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: '客戶編號已存在' })
    }
    res.status(500).json({ message: '新增失敗', error: error.message })
  }
})

// PUT /api/customers/:id - 更新客戶
router.put('/:id', authenticate, authorize('system_admin', 'site_admin'), async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.update({
      where: { customerId: req.params.id },
      data: req.body,
    })
    res.json(customer)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: '客戶不存在' })
    }
    res.status(500).json({ message: '更新失敗', error: error.message })
  }
})

export default router

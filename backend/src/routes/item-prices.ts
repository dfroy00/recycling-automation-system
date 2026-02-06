import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/item-prices - 取得品項清單（目前有效的）
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { itemName, includeExpired, page = '1', pageSize = '50' } = req.query

    const where: any = {}
    if (itemName) where.itemName = { contains: String(itemName), mode: 'insensitive' }
    if (!includeExpired) where.expiryDate = null // 只顯示目前有效的

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.itemPrice.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: [{ itemName: 'asc' }, { effectiveDate: 'desc' }],
      }),
      prisma.itemPrice.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// GET /api/item-prices/history/:itemName - 品項價格歷史
router.get('/history/:itemName', authenticate, async (req: Request, res: Response) => {
  try {
    const history = await prisma.itemPrice.findMany({
      where: { itemName: req.params.itemName },
      orderBy: { effectiveDate: 'desc' },
    })
    res.json(history)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/item-prices - 新增品項
router.post('/', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { itemName, standardPrice, effectiveDate } = req.body
    if (!itemName || standardPrice === undefined || !effectiveDate) {
      return res.status(400).json({ message: '缺少必填欄位' })
    }

    const item = await prisma.itemPrice.create({
      data: {
        itemName,
        standardPrice,
        effectiveDate: new Date(effectiveDate),
      },
    })
    res.status(201).json(item)
  } catch (error: any) {
    res.status(500).json({ message: '新增失敗', error: error.message })
  }
})

// PUT /api/item-prices/:id/adjust - 調整單價（舊價格設到期日，建新價格）
router.put('/:id/adjust', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { newPrice, effectiveDate } = req.body
    if (newPrice === undefined || !effectiveDate) {
      return res.status(400).json({ message: '缺少 newPrice 或 effectiveDate' })
    }

    const oldPrice = await prisma.itemPrice.findUnique({
      where: { itemPriceId: Number(req.params.id) },
    })
    if (!oldPrice) {
      return res.status(404).json({ message: '品項不存在' })
    }

    // 將舊價格設到期日
    const effectiveDateObj = new Date(effectiveDate)
    const expiryDate = new Date(effectiveDateObj)
    expiryDate.setDate(expiryDate.getDate() - 1)

    await prisma.$transaction([
      prisma.itemPrice.update({
        where: { itemPriceId: Number(req.params.id) },
        data: { expiryDate },
      }),
      prisma.itemPrice.create({
        data: {
          itemName: oldPrice.itemName,
          standardPrice: newPrice,
          effectiveDate: effectiveDateObj,
        },
      }),
    ])

    res.json({ message: `${oldPrice.itemName} 單價已調整為 ${newPrice}，生效日 ${effectiveDate}` })
  } catch (error: any) {
    res.status(500).json({ message: '調整失敗', error: error.message })
  }
})

export default router

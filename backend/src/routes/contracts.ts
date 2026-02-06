import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/customers/:customerId/contracts - 取得客戶合約
router.get('/customers/:customerId/contracts', authenticate, async (req: Request, res: Response) => {
  try {
    const contracts = await prisma.contractPrice.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { endDate: 'desc' },
    })
    res.json(contracts)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/customers/:customerId/contracts - 新增合約品項
router.post(
  '/customers/:customerId/contracts',
  authenticate,
  authorize('system_admin', 'site_admin', 'sales'),
  async (req: Request, res: Response) => {
    try {
      const { itemName, contractPrice, startDate, endDate } = req.body
      if (!itemName || !contractPrice || !startDate || !endDate) {
        return res.status(400).json({ message: '缺少必填欄位' })
      }

      const contract = await prisma.contractPrice.create({
        data: {
          customerId: req.params.customerId,
          itemName,
          contractPrice,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      })
      res.status(201).json(contract)
    } catch (error: any) {
      res.status(500).json({ message: '新增失敗', error: error.message })
    }
  }
)

// PUT /api/contracts/:id - 更新合約
router.put(
  '/contracts/:id',
  authenticate,
  authorize('system_admin', 'site_admin', 'sales'),
  async (req: Request, res: Response) => {
    try {
      const contract = await prisma.contractPrice.update({
        where: { contractPriceId: Number(req.params.id) },
        data: req.body,
      })
      res.json(contract)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: '合約不存在' })
      }
      res.status(500).json({ message: '更新失敗', error: error.message })
    }
  }
)

// DELETE /api/contracts/:id - 刪除合約
router.delete(
  '/contracts/:id',
  authenticate,
  authorize('system_admin'),
  async (req: Request, res: Response) => {
    try {
      await prisma.contractPrice.delete({
        where: { contractPriceId: Number(req.params.id) },
      })
      res.json({ message: '已刪除' })
    } catch (error: any) {
      res.status(500).json({ message: '刪除失敗', error: error.message })
    }
  }
)

export default router

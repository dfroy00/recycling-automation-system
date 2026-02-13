// backend/src/routes/contracts.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'
import { authorize } from '../middleware/authorize'
import { siteScope, ScopedRequest } from '../middleware/site-scope'

const router = Router()

// ==================== 合約 CRUD ====================

// GET /api/contracts — 列表（支援分頁、篩選）— 所有角色可讀+siteScope
router.get('/', siteScope(), async (req: Request, res: Response) => {
  const { customerId, status } = req.query
  const where: any = {}
  if (customerId) where.customerId = Number(customerId)
  if (status) where.status = status as string

  // 非 super_admin 只能看到自己站區客戶的合約
  const scopedReq = req as ScopedRequest
  if (scopedReq.scopedSiteId) {
    where.customer = { siteId: scopedReq.scopedSiteId }
  }

  const { page, pageSize, skip, all } = parsePagination(req)
  const include = {
    customer: { select: { id: true, name: true } },
    items: {
      include: { item: { select: { id: true, name: true, unit: true } } },
    },
  }

  if (all) {
    const contracts = await prisma.contract.findMany({
      where, include, orderBy: { id: 'desc' },
    })
    res.json(contracts)
    return
  }

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where, include, orderBy: { id: 'desc' }, skip, take: pageSize,
    }),
    prisma.contract.count({ where }),
  ])
  res.json(paginationResponse(contracts, total, page, pageSize))
})

// GET /api/contracts/:id — 詳情 — 所有角色可讀
router.get('/:id', siteScope(), async (req: Request, res: Response) => {
  const contract = await prisma.contract.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: { select: { id: true, name: true } },
      items: {
        include: { item: { select: { id: true, name: true, unit: true } } },
      },
    },
  })
  if (!contract) {
    res.status(404).json({ error: '合約不存在' })
    return
  }
  res.json(contract)
})

// POST /api/contracts — 新增 — 僅 super_admin 和 site_manager
router.post('/', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const { customerId, contractNumber, startDate, endDate, status: contractStatus, notes } = req.body

  if (!customerId || !contractNumber || !startDate || !endDate) {
    res.status(400).json({ error: '客戶、合約編號、起始日和到期日為必填' })
    return
  }

  try {
    const contract = await prisma.contract.create({
      data: {
        customerId,
        contractNumber,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: contractStatus || 'draft',
        notes,
      },
      include: {
        customer: { select: { id: true, name: true, type: true } },
      },
    })

    // 合約與客戶類型聯動：新增合約後，若客戶為臨時客戶則自動升級為簽約客戶
    if (contract.customer.type === 'temporary') {
      await prisma.customer.update({
        where: { id: customerId },
        data: { type: 'contracted' },
      })
    }

    res.status(201).json(contract)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '合約編號已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/contracts/:id — 更新 — 僅 super_admin 和 site_manager
router.patch('/:id', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const { contractNumber, startDate, endDate, status: contractStatus, notes } = req.body
  const data: any = {}
  if (contractNumber) data.contractNumber = contractNumber
  if (startDate) data.startDate = new Date(startDate)
  if (endDate) data.endDate = new Date(endDate)
  if (contractStatus) data.status = contractStatus
  if (notes !== undefined) data.notes = notes

  try {
    const contract = await prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id: Number(req.params.id) },
        data,
        include: {
          customer: { select: { id: true, name: true, type: true } },
        },
      })

      // 合約與客戶類型聯動：狀態改為 terminated 時，檢查是否需降級客戶類型
      if (contractStatus === 'terminated' && updated.customer.type === 'contracted') {
        const activeCount = await tx.contract.count({
          where: { customerId: updated.customer.id, status: 'active' },
        })
        if (activeCount === 0) {
          await tx.customer.update({
            where: { id: updated.customer.id },
            data: { type: 'temporary' },
          })
        }
      }

      // 合約與客戶類型聯動：狀態改為 active 時，自動升級臨時客戶為簽約客戶
      if (contractStatus === 'active' && updated.customer.type === 'temporary') {
        await tx.customer.update({
          where: { id: updated.customer.id },
          data: { type: 'contracted' },
        })
      }

      return updated
    })

    res.json(contract)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約不存在' })
      return
    }
    if (e.code === 'P2002') {
      res.status(409).json({ error: '合約編號已存在' })
      return
    }
    throw e
  }
})

// DELETE /api/contracts/:id — 刪除（設為 terminated）— 僅 super_admin 和 site_manager
router.delete('/:id', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.update({
        where: { id: Number(req.params.id) },
        data: { status: 'terminated' },
        include: { customer: { select: { id: true, type: true } } },
      })

      // 合約與客戶類型聯動：終止合約後，若該客戶已無任何 active 合約，降級為臨時客戶
      if (contract.customer.type === 'contracted') {
        const activeCount = await tx.contract.count({
          where: { customerId: contract.customer.id, status: 'active' },
        })
        if (activeCount === 0) {
          await tx.customer.update({
            where: { id: contract.customer.id },
            data: { type: 'temporary' },
          })
        }
      }
    })

    res.json({ message: '已終止' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約不存在' })
      return
    }
    throw e
  }
})

// ==================== 合約品項 CRUD ====================

// GET /api/contracts/:id/items — 合約品項列表 — 所有角色可讀
router.get('/:id/items', siteScope(), async (req: Request, res: Response) => {
  const contractId = Number(req.params.id)
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) {
    res.status(404).json({ error: '合約不存在' })
    return
  }

  const items = await prisma.contractItem.findMany({
    where: { contractId },
    include: { item: { select: { id: true, name: true, unit: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(items)
})

// POST /api/contracts/:id/items — 新增合約品項 — 僅 super_admin 和 site_manager
router.post('/:id/items', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const contractId = Number(req.params.id)
  const { itemId, unitPrice, billingDirection } = req.body

  if (!itemId || unitPrice === undefined || !billingDirection) {
    res.status(400).json({ error: '品項、單價和計費方向為必填' })
    return
  }

  // 驗證 billingDirection
  if (!['receivable', 'payable', 'free'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須為 receivable、payable 或 free' })
    return
  }

  // 驗證合約存在
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) {
    res.status(404).json({ error: '合約不存在' })
    return
  }

  const contractItem = await prisma.contractItem.create({
    data: { contractId, itemId, unitPrice, billingDirection },
    include: { item: { select: { id: true, name: true, unit: true } } },
  })
  res.status(201).json(contractItem)
})

// PATCH /api/contracts/:cid/items/:iid — 更新合約品項 — 僅 super_admin 和 site_manager
router.patch('/:cid/items/:iid', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  const { unitPrice, billingDirection } = req.body

  // 驗證 billingDirection（若有提供）
  if (billingDirection && !['receivable', 'payable', 'free'].includes(billingDirection)) {
    res.status(400).json({ error: 'billingDirection 必須為 receivable、payable 或 free' })
    return
  }

  try {
    const contractItem = await prisma.contractItem.update({
      where: { id: Number(req.params.iid) },
      data: {
        ...(unitPrice !== undefined && { unitPrice }),
        ...(billingDirection && { billingDirection }),
      },
      include: { item: { select: { id: true, name: true, unit: true } } },
    })
    res.json(contractItem)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約品項不存在' })
      return
    }
    throw e
  }
})

// DELETE /api/contracts/:cid/items/:iid — 刪除合約品項 — 僅 super_admin 和 site_manager
router.delete('/:cid/items/:iid', authorize('super_admin', 'site_manager'), siteScope(), async (req: Request, res: Response) => {
  try {
    await prisma.contractItem.delete({ where: { id: Number(req.params.iid) } })
    res.json({ message: '已刪除' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '合約品項不存在' })
      return
    }
    throw e
  }
})

export default router

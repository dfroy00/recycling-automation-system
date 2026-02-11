// backend/src/routes/sync.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { syncPosRecords, syncVehicleRecords } from '../services/sync.service'
import { getPosAdapter, getVehicleAdapter } from '../adapters'
import { generateMockData } from '../adapters/mock/mock-data-seeder'

const router = Router()

// POST /api/sync/pos/pull — 從 POS 拉取收運紀錄
router.post('/pos/pull', async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.body
  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: '請提供 dateFrom 和 dateTo' })
    return
  }

  try {
    const result = await syncPosRecords(new Date(dateFrom), new Date(dateTo))
    res.json(result)
  } catch (e: any) {
    if (e.message.includes('同步進行中')) {
      res.status(409).json({ error: e.message })
      return
    }
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sync/pos/push-customers — 推送客戶資料至 POS
router.post('/pos/push-customers', async (req: Request, res: Response) => {
  const { customerId } = req.body
  if (!customerId) {
    res.status(400).json({ error: '請提供 customerId' })
    return
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { site: true },
  })
  if (!customer) {
    res.status(404).json({ error: '客戶不存在' })
    return
  }

  try {
    const posAdapter = getPosAdapter()
    await posAdapter.syncCustomer({
      id: customer.id,
      name: customer.name,
      siteName: customer.site.name,
      phone: customer.phone || undefined,
      address: customer.address || undefined,
    })
    res.json({ message: '客戶資料已推送至 POS' })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sync/pos/push-prices — 推送合約品項定價至 POS
router.post('/pos/push-prices', async (req: Request, res: Response) => {
  const { contractId } = req.body
  if (!contractId) {
    res.status(400).json({ error: '請提供 contractId' })
    return
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      customer: true,
      items: { include: { item: true } },
    },
  })
  if (!contract) {
    res.status(404).json({ error: '合約不存在' })
    return
  }

  try {
    const posAdapter = getPosAdapter()
    await posAdapter.syncContractPrices(
      contract.items.map(ci => ({
        customerName: contract.customer.name,
        itemName: ci.item.name,
        unitPrice: Number(ci.unitPrice),
        billingDirection: ci.billingDirection,
      }))
    )
    res.json({ message: `已推送 ${contract.items.length} 筆合約品項定價至 POS` })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sync/vehicle/pull — 從車機拉取車趟紀錄
router.post('/vehicle/pull', async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.body
  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: '請提供 dateFrom 和 dateTo' })
    return
  }

  try {
    const result = await syncVehicleRecords(new Date(dateFrom), new Date(dateTo))
    res.json(result)
  } catch (e: any) {
    if (e.message.includes('同步進行中')) {
      res.status(409).json({ error: e.message })
      return
    }
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sync/vehicle/push-customers — 推送客戶資料至車機
router.post('/vehicle/push-customers', async (req: Request, res: Response) => {
  const { customerId } = req.body
  if (!customerId) {
    res.status(400).json({ error: '請提供 customerId' })
    return
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { site: true },
  })
  if (!customer) {
    res.status(404).json({ error: '客戶不存在' })
    return
  }

  try {
    const vehicleAdapter = getVehicleAdapter()
    await vehicleAdapter.syncCustomer({
      id: customer.id,
      name: customer.name,
      siteName: customer.site.name,
      phone: customer.phone || undefined,
      address: customer.address || undefined,
    })
    res.json({ message: '客戶資料已推送至車機系統' })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sync/vehicle/dispatch — 派車指令
router.post('/vehicle/dispatch', async (req: Request, res: Response) => {
  const { customerId, tripDate, driver, vehiclePlate } = req.body
  if (!customerId || !tripDate || !driver || !vehiclePlate) {
    res.status(400).json({ error: '請提供 customerId, tripDate, driver, vehiclePlate' })
    return
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { site: true },
  })
  if (!customer) {
    res.status(404).json({ error: '客戶不存在' })
    return
  }

  try {
    const vehicleAdapter = getVehicleAdapter()
    await vehicleAdapter.dispatchTrip({
      siteName: customer.site.name,
      customerName: customer.name,
      tripDate: new Date(tripDate),
      driver,
      vehiclePlate,
    })
    res.json({ message: '派車指令已送出' })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/sync/vehicle/status — 車輛狀態
router.get('/vehicle/status', async (_req: Request, res: Response) => {
  try {
    const vehicleAdapter = getVehicleAdapter()
    const status = await vehicleAdapter.getVehicleStatus()
    res.json(status)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/sync/status — Adapter 模式狀態
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const posAdapter = getPosAdapter()
    const vehicleAdapter = getVehicleAdapter()
    const [posHealth, vehicleHealth] = await Promise.all([
      posAdapter.healthCheck(),
      vehicleAdapter.healthCheck(),
    ])
    res.json({
      pos: posHealth,
      vehicle: vehicleHealth,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sync/mock/generate — 產生 Mock 假資料（僅 mock 模式可用）
router.post('/mock/generate', async (_req: Request, res: Response) => {
  const posMode = process.env.POS_ADAPTER_MODE || 'mock'
  const vehicleMode = process.env.VEHICLE_ADAPTER_MODE || 'mock'

  if (posMode !== 'mock' && vehicleMode !== 'mock') {
    res.status(400).json({ error: '僅 mock 模式可產生假資料' })
    return
  }

  try {
    const result = await generateMockData()
    res.json({
      message: 'Mock 假資料產生完成',
      posRecords: result.posRecords,
      vehicleTrips: result.vehicleTrips,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router

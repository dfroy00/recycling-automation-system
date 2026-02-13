// backend/src/adapters/mock/mock-pos.adapter.ts
import prisma from '../../lib/prisma'
import { IPosAdapter, AdapterHealthCheckResult } from '../pos.adapter'
import { PosCollectionRecord, CustomerSyncData, ContractPriceSyncData } from '../types'

export class MockPosAdapter implements IPosAdapter {
  async getCollectionRecords(params: {
    siteId?: number
    customerId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<PosCollectionRecord[]> {
    const where: any = {
      collectionDate: { gte: params.dateFrom, lte: params.dateTo },
      imported: false,
    }

    // 依站區/客戶名稱篩選
    if (params.siteId) {
      const site = await prisma.site.findUnique({ where: { id: params.siteId } })
      if (site) where.siteName = site.name
    }
    if (params.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: params.customerId } })
      if (customer) where.customerName = customer.name
    }

    const records = await prisma.mockPosCollection.findMany({ where, orderBy: { collectionDate: 'asc' } })
    return records.map((r) => ({
      externalId: r.externalId,
      siteName: r.siteName,
      customerName: r.customerName,
      collectionDate: r.collectionDate,
      itemName: r.itemName,
      quantity: Number(r.quantity),
      unit: r.unit,
      unitPrice: Number(r.unitPrice),
    }))
  }

  async getLatestRecords(since: Date): Promise<PosCollectionRecord[]> {
    const records = await prisma.mockPosCollection.findMany({
      where: { createdAt: { gt: since }, imported: false },
      orderBy: { createdAt: 'asc' },
    })
    return records.map((r) => ({
      externalId: r.externalId,
      siteName: r.siteName,
      customerName: r.customerName,
      collectionDate: r.collectionDate,
      itemName: r.itemName,
      quantity: Number(r.quantity),
      unit: r.unit,
      unitPrice: Number(r.unitPrice),
    }))
  }

  async syncCustomer(customer: CustomerSyncData): Promise<void> {
    // Mock 模式：記錄到 system_logs
    await prisma.systemLog.create({
      data: {
        eventType: 'mock_sync_customer_to_pos',
        eventContent: `模擬同步客戶 [${customer.name}] 至 POS`,
      },
    })
  }

  async syncContractPrices(contractItems: ContractPriceSyncData[]): Promise<void> {
    // Mock 模式：記錄到 system_logs
    await prisma.systemLog.create({
      data: {
        eventType: 'mock_sync_prices_to_pos',
        eventContent: `模擬同步 ${contractItems.length} 筆合約品項定價至 POS`,
      },
    })
  }

  async healthCheck(): Promise<AdapterHealthCheckResult> {
    try {
      await prisma.mockPosCollection.count()
      return { status: 'ok', mode: 'mock' }
    } catch (e: any) {
      return { status: 'error', mode: 'mock', message: e.message }
    }
  }
}

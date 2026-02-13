// backend/src/adapters/mock/mock-vehicle.adapter.ts
import prisma from '../../lib/prisma'
import { IVehicleAdapter } from '../vehicle.adapter'
import { AdapterHealthCheckResult } from '../pos.adapter'
import { VehicleTripRecord, VehicleStatus, CustomerSyncData, DispatchData } from '../types'

export class MockVehicleAdapter implements IVehicleAdapter {
  async getTripRecords(params: {
    siteId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<VehicleTripRecord[]> {
    const where: any = {
      tripDate: { gte: params.dateFrom, lte: params.dateTo },
      imported: false,
    }

    if (params.siteId) {
      const site = await prisma.site.findUnique({ where: { id: params.siteId } })
      if (site) where.siteName = site.name
    }

    const records = await prisma.mockVehicleTrip.findMany({ where, orderBy: { tripDate: 'asc' } })
    return records.map((r) => ({
      externalId: r.externalId,
      siteName: r.siteName,
      customerName: r.customerName,
      tripDate: r.tripDate,
      tripTime: r.tripTime || undefined,
      driver: r.driver,
      vehiclePlate: r.vehiclePlate,
      status: r.status,
    }))
  }

  async getVehicleStatus(): Promise<VehicleStatus[]> {
    // Mock 模式：回傳模擬車輛狀態
    return [
      { vehiclePlate: 'ABC-1234', driver: '王大明', status: 'idle', lastUpdate: new Date() },
      { vehiclePlate: 'DEF-5678', driver: '李小華', status: 'on_route', lastUpdate: new Date() },
    ]
  }

  async syncCustomer(customer: CustomerSyncData): Promise<void> {
    await prisma.systemLog.create({
      data: {
        eventType: 'mock_sync_customer_to_vehicle',
        eventContent: `模擬同步客戶 [${customer.name}] 至車機系統`,
      },
    })
  }

  async dispatchTrip(dispatch: DispatchData): Promise<void> {
    await prisma.systemLog.create({
      data: {
        eventType: 'mock_dispatch_trip',
        eventContent: `模擬派車：${dispatch.driver} (${dispatch.vehiclePlate}) → ${dispatch.customerName}`,
      },
    })
  }

  async healthCheck(): Promise<AdapterHealthCheckResult> {
    try {
      await prisma.mockVehicleTrip.count()
      return { status: 'ok', mode: 'mock' }
    } catch (e: any) {
      return { status: 'error', mode: 'mock', message: e.message }
    }
  }
}

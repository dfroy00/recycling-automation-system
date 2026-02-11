// backend/src/adapters/vehicle.adapter.ts
import { VehicleTripRecord, VehicleStatus, CustomerSyncData, DispatchData } from './types'
import { AdapterHealthCheckResult } from './pos.adapter'

// 車機系統 Adapter 介面
export interface IVehicleAdapter {
  getTripRecords(params: {
    siteId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<VehicleTripRecord[]>

  getVehicleStatus(): Promise<VehicleStatus[]>
  syncCustomer(customer: CustomerSyncData): Promise<void>
  dispatchTrip(dispatch: DispatchData): Promise<void>
  healthCheck(): Promise<AdapterHealthCheckResult>
}

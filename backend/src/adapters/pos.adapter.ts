// backend/src/adapters/pos.adapter.ts
import { PosCollectionRecord, CustomerSyncData, ContractPriceSyncData } from './types'

// 健康檢查結果介面
export interface AdapterHealthCheckResult {
  status: 'ok' | 'error'
  mode: 'mock' | 'real'
  message?: string
  lastSyncAt?: Date
}

// POS 系統 Adapter 介面
export interface IPosAdapter {
  getCollectionRecords(params: {
    siteId?: number
    customerId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<PosCollectionRecord[]>

  getLatestRecords(since: Date): Promise<PosCollectionRecord[]>
  syncCustomer(customer: CustomerSyncData): Promise<void>
  syncContractPrices(contractItems: ContractPriceSyncData[]): Promise<void>
  healthCheck(): Promise<AdapterHealthCheckResult>
}

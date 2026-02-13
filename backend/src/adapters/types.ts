// backend/src/adapters/types.ts
// Adapter 共用型別定義

export interface PosCollectionRecord {
  externalId: string     // 外部系統 ID
  siteName: string       // 站區名稱
  customerName: string   // 客戶名稱
  collectionDate: Date   // 收運日期
  itemName: string       // 品項名稱
  quantity: number       // 數量
  unit: string           // 計量單位
  unitPrice: number      // 單價
}

export interface VehicleTripRecord {
  externalId: string
  siteName: string
  customerName: string
  tripDate: Date
  tripTime?: string
  driver: string
  vehiclePlate: string
  status: string
}

export interface VehicleStatus {
  vehiclePlate: string
  driver: string
  status: string         // idle / on_route / loading
  lastUpdate: Date
}

export interface CustomerSyncData {
  id: number
  name: string
  siteName: string
  phone?: string
  address?: string
}

export interface ContractPriceSyncData {
  customerName: string
  itemName: string
  unitPrice: number
  billingDirection: string
}

export interface DispatchData {
  siteName: string
  customerName: string
  tripDate: Date
  driver: string
  vehiclePlate: string
}

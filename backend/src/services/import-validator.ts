// backend/src/services/import-validator.ts
import type { TripRow, ItemRow } from './excel-parser'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// 驗證車趟資料列
export function validateTripRow(
  row: TripRow,
  knownCustomerIds: string[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!row.tripDate) {
    errors.push('日期不可為空')
  }
  if (!row.tripTime) {
    errors.push('時間不可為空')
  }
  if (!row.customerId) {
    errors.push('客戶編號不可為空')
  } else if (!knownCustomerIds.includes(row.customerId)) {
    errors.push(`客戶編號 ${row.customerId} 不存在於客戶主檔`)
  }
  if (!row.driver) {
    warnings.push('司機姓名為空')
  }
  if (!row.vehiclePlate) {
    warnings.push('車牌為空')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// 驗證品項收取資料列
export function validateItemRow(
  row: ItemRow,
  knownCustomerIds: string[],
  knownItemNames: string[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!row.collectionDate) {
    errors.push('日期不可為空')
  }
  if (!row.customerId) {
    errors.push('客戶編號不可為空')
  } else if (!knownCustomerIds.includes(row.customerId)) {
    errors.push(`客戶編號 ${row.customerId} 不存在於客戶主檔`)
  }
  if (!row.itemName) {
    errors.push('品項名稱不可為空')
  } else if (!knownItemNames.includes(row.itemName)) {
    errors.push(`品項 ${row.itemName} 不存在於單價表`)
  }
  if (row.weightKg < 0 || row.weightKg > 10000) {
    errors.push(`重量異常：${row.weightKg} 公斤（有效範圍 0-10000）`)
  } else if (row.weightKg === 0) {
    warnings.push('重量為 0 公斤，請確認是否正確')
  }

  return { valid: errors.length === 0, errors, warnings }
}

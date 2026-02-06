// backend/tests/import-validator.test.ts
import { describe, it, expect } from 'vitest'
import {
  validateTripRow,
  validateItemRow,
  type ValidationResult,
} from '../src/services/import-validator'

describe('資料驗證服務', () => {
  // 測試用的已知客戶與品項（對應 seed 資料）
  const knownCustomerIds = ['C001', 'C002', 'C003', 'C004']
  const knownItemNames = ['紙類', '塑膠', '金屬', '鋁罐', '鐵罐', '玻璃', '寶特瓶', '廢紙箱']

  describe('validateTripRow', () => {
    it('應通過正常資料', () => {
      const result = validateTripRow(
        { tripDate: '2026-02-01', tripTime: '09:30', customerId: 'C001', driver: '王小明', vehiclePlate: 'ABC-1234' },
        knownCustomerIds
      )
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('應標記不存在的客戶編號', () => {
      const result = validateTripRow(
        { tripDate: '2026-02-01', tripTime: '09:30', customerId: 'C999', driver: '王小明', vehiclePlate: 'ABC-1234' },
        knownCustomerIds
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('客戶編號')
    })

    it('應標記缺少日期', () => {
      const result = validateTripRow(
        { tripDate: '', tripTime: '09:30', customerId: 'C001', driver: '王小明', vehiclePlate: 'ABC-1234' },
        knownCustomerIds
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('日期')
    })
  })

  describe('validateItemRow', () => {
    it('應通過正常資料', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: 150.5 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(true)
    })

    it('應標記不存在的品項', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '未知品項', weightKg: 100 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('品項')
    })

    it('應標記負數重量', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: -10 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('重量')
    })

    it('應標記超過 10000 公斤', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: 15000 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('重量')
    })

    it('應發出重量為 0 的警告', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: 0 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(true) // 0 是合法的但要警告
      expect(result.warnings).toHaveLength(1)
    })
  })
})

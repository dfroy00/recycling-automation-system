// backend/tests/billing.test.ts
import { describe, it, expect } from 'vitest'
import { Decimal } from '@prisma/client'
import {
  calculateTypeA,
  calculateTypeB,
  calculateTypeC,
  calculateTypeD,
  type TripSummary,
  type ItemSummary,
} from '../src/services/billing.service'

// 測試用的車趟摘要
const sampleTrips: TripSummary[] = [
  { tripDate: new Date('2026-02-05'), tripCount: 2 },
  { tripDate: new Date('2026-02-12'), tripCount: 3 },
  { tripDate: new Date('2026-02-19'), tripCount: 2 },
  { tripDate: new Date('2026-02-26'), tripCount: 1 },
]

// 測試用的品項摘要
const sampleItems: ItemSummary[] = [
  { itemName: '紙類', totalWeight: new Decimal(450.5), unitPrice: new Decimal(5.0), priceType: 'standard' },
  { itemName: '塑膠', totalWeight: new Decimal(220.3), unitPrice: new Decimal(3.5), priceType: 'standard' },
  { itemName: '金屬', totalWeight: new Decimal(180.0), unitPrice: new Decimal(8.0), priceType: 'standard' },
]

describe('計費引擎', () => {
  describe('A 類客戶（回收物費用 + 車趟費）', () => {
    it('應正確計算總金額', () => {
      const result = calculateTypeA(sampleTrips, sampleItems, new Decimal(300))

      // 車趟費 = (2+3+2+1) * 300 = 2400
      expect(result.tripFee.toNumber()).toBe(2400)
      // 品項費 = 450.5*5 + 220.3*3.5 + 180*8 = 2252.5 + 771.05 + 1440 = 4463.55
      expect(result.itemFee.toNumber()).toBeCloseTo(4463.55, 2)
      // 總金額 = 2400 + 4463.55 = 6863.55
      expect(result.totalAmount.toNumber()).toBeCloseTo(6863.55, 2)
      expect(result.tripCount).toBe(8)
    })

    it('應正確產生品項明細', () => {
      const result = calculateTypeA(sampleTrips, sampleItems, new Decimal(300))

      expect(result.itemDetails).toHaveLength(3)
      expect(result.itemDetails[0].itemName).toBe('紙類')
      expect(result.itemDetails[0].subtotal.toNumber()).toBeCloseTo(2252.5, 2)
    })

    it('無車趟時車趟費應為 0', () => {
      const result = calculateTypeA([], sampleItems, new Decimal(300))

      expect(result.tripFee.toNumber()).toBe(0)
      expect(result.tripCount).toBe(0)
      expect(result.itemFee.toNumber()).toBeGreaterThan(0)
    })

    it('無品項時品項費應為 0', () => {
      const result = calculateTypeA(sampleTrips, [], new Decimal(300))

      expect(result.itemFee.toNumber()).toBe(0)
      expect(result.tripFee.toNumber()).toBe(2400)
    })
  })

  describe('B 類客戶（僅車趟費）', () => {
    it('應正確計算車趟費', () => {
      const result = calculateTypeB(sampleTrips, new Decimal(500))

      // 車趟費 = 8 * 500 = 4000
      expect(result.tripFee.toNumber()).toBe(4000)
      expect(result.totalAmount.toNumber()).toBe(4000)
      expect(result.tripCount).toBe(8)
      // B 類不應有品項明細
      expect(result.itemDetails).toHaveLength(0)
      expect(result.itemFee.toNumber()).toBe(0)
    })

    it('無車趟時總金額應為 0', () => {
      const result = calculateTypeB([], new Decimal(500))

      expect(result.totalAmount.toNumber()).toBe(0)
    })
  })

  describe('C 類客戶（合約 + 牌價混合）', () => {
    // C 類品項：紙類和塑膠有合約價，金屬用牌價
    const mixedItems: ItemSummary[] = [
      { itemName: '紙類', totalWeight: new Decimal(450.5), unitPrice: new Decimal(4.5), priceType: 'contract' },
      { itemName: '塑膠', totalWeight: new Decimal(220.3), unitPrice: new Decimal(3.0), priceType: 'contract' },
      { itemName: '金屬', totalWeight: new Decimal(180.0), unitPrice: new Decimal(8.0), priceType: 'standard' },
    ]

    it('應正確計算混合計價（不收車趟費）', () => {
      const result = calculateTypeC(sampleTrips, mixedItems)

      // 合約品項費 = 450.5*4.5 + 220.3*3.0 = 2027.25 + 660.9 = 2688.15
      // 牌價品項費 = 180*8 = 1440
      // 總金額 = 2688.15 + 1440 = 4128.15
      expect(result.totalAmount.toNumber()).toBeCloseTo(4128.15, 2)
      expect(result.tripFee.toNumber()).toBe(0) // 不收車趟費
      expect(result.itemDetails).toHaveLength(3)
      expect(result.itemDetails[0].priceType).toBe('contract')
      expect(result.itemDetails[2].priceType).toBe('standard')
    })

    it('全部都是合約品項時應只用合約價', () => {
      const contractOnly: ItemSummary[] = [
        { itemName: '紙類', totalWeight: new Decimal(100), unitPrice: new Decimal(4.5), priceType: 'contract' },
      ]
      const result = calculateTypeC(sampleTrips, contractOnly)

      expect(result.totalAmount.toNumber()).toBe(450)
      expect(result.tripFee.toNumber()).toBe(0)
    })
  })

  describe('D 類客戶（全牌價，不收車趟費）', () => {
    it('應正確計算牌價費用', () => {
      const result = calculateTypeD(sampleTrips, sampleItems)

      // 品項費 = 450.5*5 + 220.3*3.5 + 180*8 = 4463.55
      expect(result.totalAmount.toNumber()).toBeCloseTo(4463.55, 2)
      expect(result.tripFee.toNumber()).toBe(0) // 不收車趟費
      expect(result.itemDetails.every(d => d.priceType === 'standard')).toBe(true)
    })

    it('無品項時總金額應為 0', () => {
      const result = calculateTypeD(sampleTrips, [])

      expect(result.totalAmount.toNumber()).toBe(0)
    })
  })
})

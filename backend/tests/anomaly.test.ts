// backend/tests/anomaly.test.ts
import { describe, it, expect } from 'vitest'
import { Decimal } from '@prisma/client'
import { detectAmountAnomaly } from '../src/services/anomaly.service'

describe('金額異常偵測', () => {
  it('金額差異 > 30% 應標記為異常', () => {
    const result = detectAmountAnomaly(
      new Decimal(13100),  // 本月（31% 差異）
      new Decimal(10000),  // 上月
      null                 // 去年同期
    )
    expect(result.anomaly).toBe(true)
    expect(result.level).toBe('warning')
    expect(result.reason).toContain('30%')
  })

  it('金額差異 > 50%（vs 去年同期）應標記為重大異常', () => {
    const result = detectAmountAnomaly(
      new Decimal(16000),  // 本月
      new Decimal(12000),  // 上月
      new Decimal(10000)   // 去年同期
    )
    expect(result.anomaly).toBe(true)
    expect(result.level).toBe('critical')
    expect(result.reason).toContain('50%')
  })

  it('金額為 0 應標記', () => {
    const result = detectAmountAnomaly(
      new Decimal(0),
      new Decimal(10000),
      null
    )
    expect(result.anomaly).toBe(true)
    expect(result.reason).toContain('0')
  })

  it('金額差異 < 30% 不應標記', () => {
    const result = detectAmountAnomaly(
      new Decimal(11000),  // 10% 差異
      new Decimal(10000),
      null
    )
    expect(result.anomaly).toBe(false)
  })

  it('無上月資料時不做比較', () => {
    const result = detectAmountAnomaly(
      new Decimal(10000),
      null,
      null
    )
    expect(result.anomaly).toBe(false)
  })
})

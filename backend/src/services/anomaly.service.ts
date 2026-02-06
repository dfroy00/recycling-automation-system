// backend/src/services/anomaly.service.ts
import { Decimal } from '@prisma/client'

export interface AnomalyResult {
  anomaly: boolean
  level: 'none' | 'warning' | 'critical'
  reason: string
  percentChange?: number
}

// 偵測金額異常
export function detectAmountAnomaly(
  currentAmount: Decimal,
  lastMonthAmount: Decimal | null,
  lastYearAmount: Decimal | null
): AnomalyResult {
  // 總金額為 0
  if (currentAmount.equals(0)) {
    return {
      anomaly: true,
      level: 'warning',
      reason: '本月總金額為 0 元',
    }
  }

  // 與去年同期比較（> 50% 為重大異常）
  if (lastYearAmount && !lastYearAmount.equals(0)) {
    const change = currentAmount.sub(lastYearAmount).div(lastYearAmount).mul(100)
    const absChange = Math.abs(change.toNumber())
    if (absChange > 50) {
      return {
        anomaly: true,
        level: 'critical',
        reason: `與去年同期差異 ${change.toNumber() > 0 ? '+' : ''}${change.toFixed(1)}%，超過 50% 門檻`,
        percentChange: change.toNumber(),
      }
    }
  }

  // 與上月比較（> 30% 為異常）
  if (lastMonthAmount && !lastMonthAmount.equals(0)) {
    const change = currentAmount.sub(lastMonthAmount).div(lastMonthAmount).mul(100)
    const absChange = Math.abs(change.toNumber())
    if (absChange > 30) {
      return {
        anomaly: true,
        level: 'warning',
        reason: `與上月差異 ${change.toNumber() > 0 ? '+' : ''}${change.toFixed(1)}%，超過 30% 門檻`,
        percentChange: change.toNumber(),
      }
    }
  }

  return { anomaly: false, level: 'none', reason: '' }
}

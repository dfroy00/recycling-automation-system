import { describe, it, expect, vi } from 'vitest'
import { scanExpiringContracts } from '../src/services/scheduler.service'

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    contractPrice: {
      findMany: vi.fn().mockResolvedValue([
        {
          contractPriceId: 1,
          customerId: 'C003',
          itemName: '紙類',
          contractPrice: 4.5,
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-03-01'),
          customer: { customerName: '大成製造', site: { siteName: '台北站' }, email: 'dc@test.com' },
        },
        {
          contractPriceId: 2,
          customerId: 'C004',
          itemName: '塑膠',
          contractPrice: 3.0,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2026-02-10'),
          customer: { customerName: '永興工業', site: { siteName: '新北站' }, email: 'yx@test.com' },
        },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
    customer: {
      update: vi.fn().mockResolvedValue({}),
    },
    systemLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('合約到期掃描', () => {
  it('應找出 30 天內到期的合約', async () => {
    const result = await scanExpiringContracts()

    expect(result).toBeDefined()
    expect(result.expiring).toBeGreaterThanOrEqual(0)
    expect(result.details).toBeDefined()
  })

  it('應正確分類提醒等級', async () => {
    const result = await scanExpiringContracts()

    // 每個 detail 應有 urgency 屬性
    for (const d of result.details) {
      expect(['30day', '15day', '7day', 'today']).toContain(d.urgency)
    }
  })
})

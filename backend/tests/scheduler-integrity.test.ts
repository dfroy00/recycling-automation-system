import { describe, it, expect, vi } from 'vitest'
import { checkDataIntegrity, type IntegrityReport } from '../src/services/scheduler.service'

// Mock Prisma
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    trip: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(100),
    },
    itemCollected: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(200),
    },
    customer: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    systemLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('資料完整性檢查', () => {
  it('應回傳完整性檢查報告', async () => {
    const report = await checkDataIntegrity('2026-02')

    expect(report).toBeDefined()
    expect(report).toHaveProperty('tripCount')
    expect(report).toHaveProperty('itemCount')
    expect(report).toHaveProperty('orphanTrips')
    expect(report).toHaveProperty('orphanItems')
    expect(report).toHaveProperty('missingCustomers')
  })

  it('無資料時應回傳零值', async () => {
    const report = await checkDataIntegrity('2099-01')
    expect(report.orphanTrips).toBe(0)
    expect(report.orphanItems).toBe(0)
  })
})

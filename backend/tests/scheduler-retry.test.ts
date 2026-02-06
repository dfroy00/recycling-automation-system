import { describe, it, expect, vi } from 'vitest'
import { getFailedNotifications } from '../src/services/scheduler.service'

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    monthlyStatement: {
      findMany: vi.fn().mockResolvedValue([
        { statementId: 1, customerId: 'C001', sendStatus: 'failed', yearMonth: '2026-02', customer: { customerName: '客戶A' } },
        { statementId: 2, customerId: 'C002', sendStatus: 'failed', yearMonth: '2026-02', customer: { customerName: '客戶B' } },
      ]),
      count: vi.fn().mockResolvedValue(2),
    },
    systemLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

describe('通知重試排程', () => {
  it('應找出所有發送失敗的通知', async () => {
    const failed = await getFailedNotifications()
    expect(failed.length).toBe(2)
    expect(failed[0].sendStatus).toBe('failed')
  })
})

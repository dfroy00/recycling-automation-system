// backend/tests/notification.service.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { sendCustomerNotification, type NotificationResult } from '../src/services/notification.service'

// Mock email 和 line 服務
vi.mock('../src/services/email.service', () => ({
  sendEmailWithAttachment: vi.fn().mockResolvedValue({ success: true, messageId: 'email-123' }),
}))
vi.mock('../src/services/line.service', () => ({
  sendStatementNotification: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock prisma
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    systemLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('統一通知發送', () => {
  it('Email 客戶應用 Email 發送', async () => {
    const result = await sendCustomerNotification({
      customerId: 'C001',
      customerName: 'ABC 科技',
      notificationMethod: 'Email',
      email: 'abc@example.com',
      lineId: null,
      yearMonth: '2026-02',
      totalAmount: 6863,
      pdfPath: '/path/to/report.pdf',
    })

    expect(result.success).toBe(true)
    expect(result.method).toBe('Email')
  })

  it('LINE 客戶應用 LINE 發送', async () => {
    const result = await sendCustomerNotification({
      customerId: 'C002',
      customerName: 'XYZ 物流',
      notificationMethod: 'LINE',
      email: null,
      lineId: 'U1234567890',
      yearMonth: '2026-02',
      totalAmount: 1500,
      pdfPath: '/path/to/report.pdf',
    })

    expect(result.success).toBe(true)
    expect(result.method).toBe('LINE')
  })

  it('Both 客戶應同時用 Email + LINE', async () => {
    const result = await sendCustomerNotification({
      customerId: 'C003',
      customerName: '大成製造',
      notificationMethod: 'Both',
      email: 'dacheng@example.com',
      lineId: 'U9876543210',
      yearMonth: '2026-02',
      totalAmount: 4128,
      pdfPath: '/path/to/report.pdf',
    })

    expect(result.success).toBe(true)
    expect(result.method).toBe('Both')
  })
})

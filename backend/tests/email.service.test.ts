// backend/tests/email.service.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sendEmail, sendEmailWithAttachment, type EmailOptions } from '../src/services/email.service'

// Mock nodemailer（避免實際發送）
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id-123' }),
      verify: vi.fn().mockResolvedValue(true),
    }),
  },
}))

describe('Email 發送服務', () => {
  it('應成功發送純文字 Email', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: '測試郵件',
      text: '這是測試內容',
    })

    expect(result.success).toBe(true)
    expect(result.messageId).toBeDefined()
  })

  it('應成功發送帶附件的 Email', async () => {
    const result = await sendEmailWithAttachment({
      to: 'test@example.com',
      subject: '月結明細',
      html: '<p>請查收附件</p>',
      attachmentPath: '/fake/path/report.pdf',
      attachmentName: 'report.pdf',
    })

    expect(result.success).toBe(true)
  })
})

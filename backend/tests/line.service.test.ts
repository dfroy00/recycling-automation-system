// backend/tests/line.service.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sendLineMessage, type LineResult } from '../src/services/line.service'

// Mock LINE SDK
vi.mock('@line/bot-sdk', () => ({
  messagingApi: {
    MessagingApiClient: class {
      pushMessage = vi.fn().mockResolvedValue({})
    },
  },
}))

describe('LINE 通知服務', () => {
  it('應成功發送 LINE 文字訊息', async () => {
    const result = await sendLineMessage('U1234567890', '測試訊息')
    expect(result.success).toBe(true)
  })

  it('應處理空的 LINE ID', async () => {
    const result = await sendLineMessage('', '測試訊息')
    expect(result.success).toBe(false)
    expect(result.error).toContain('LINE ID')
  })
})

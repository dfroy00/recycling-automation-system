// backend/src/services/line.service.ts
import { messagingApi } from '@line/bot-sdk'

export interface LineResult {
  success: boolean
  error?: string
}

function getClient(): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  })
}

// 發送 LINE 文字訊息
export async function sendLineMessage(userId: string, message: string): Promise<LineResult> {
  if (!userId) {
    return { success: false, error: 'LINE ID 不可為空' }
  }

  try {
    const client = getClient()
    await client.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: message }],
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 發送月結明細通知（含金額摘要）
export async function sendStatementNotification(
  userId: string,
  customerName: string,
  yearMonth: string,
  totalAmount: number
): Promise<LineResult> {
  const message = [
    `${yearMonth} 月結明細通知`,
    ``,
    `${customerName} 您好，`,
    `您的 ${yearMonth} 月結明細已產生。`,
    ``,
    `總金額：$${totalAmount.toLocaleString()}`,
    ``,
    `詳細明細已發送至您的 Email，若有疑問請聯絡我們。`,
  ].join('\n')

  return sendLineMessage(userId, message)
}

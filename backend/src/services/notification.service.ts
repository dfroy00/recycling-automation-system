// backend/src/services/notification.service.ts
import { prisma } from '../lib/prisma'
import { sendEmailWithAttachment } from './email.service'
import { sendStatementNotification } from './line.service'
import path from 'path'

export interface NotificationInput {
  customerId: string
  customerName: string
  notificationMethod: string // Email / LINE / Both
  email: string | null
  lineId: string | null
  yearMonth: string
  totalAmount: number
  pdfPath: string
}

export interface NotificationResult {
  success: boolean
  method: string
  emailResult?: { success: boolean; error?: string }
  lineResult?: { success: boolean; error?: string }
}

// 發送客戶通知
export async function sendCustomerNotification(input: NotificationInput): Promise<NotificationResult> {
  const result: NotificationResult = { success: false, method: input.notificationMethod }

  // Email 發送
  if (['Email', 'Both'].includes(input.notificationMethod) && input.email) {
    const emailResult = await sendEmailWithAttachment({
      to: input.email,
      subject: `${input.yearMonth} 月結明細 - ${input.customerName}`,
      html: `<p>${input.customerName} 您好，</p><p>附件為您的 ${input.yearMonth} 月結明細，總金額為 $${input.totalAmount.toLocaleString()}。</p><p>如有疑問請聯絡我們。</p>`,
      attachmentPath: input.pdfPath,
      attachmentName: path.basename(input.pdfPath),
    })
    result.emailResult = emailResult
  }

  // LINE 發送
  if (['LINE', 'Both'].includes(input.notificationMethod) && input.lineId) {
    const lineResult = await sendStatementNotification(
      input.lineId,
      input.customerName,
      input.yearMonth,
      input.totalAmount
    )
    result.lineResult = lineResult
  }

  // 判斷是否成功
  if (input.notificationMethod === 'Both') {
    result.success = (result.emailResult?.success || false) || (result.lineResult?.success || false)
  } else if (input.notificationMethod === 'Email') {
    result.success = result.emailResult?.success || false
    // Email 失敗 + 有 LINE → 降級用 LINE
    if (!result.success && input.lineId) {
      const fallback = await sendStatementNotification(input.lineId, input.customerName, input.yearMonth, input.totalAmount)
      result.lineResult = fallback
      result.success = fallback.success
      result.method = 'LINE (fallback)'
    }
  } else if (input.notificationMethod === 'LINE') {
    result.success = result.lineResult?.success || false
    // LINE 失敗 + 有 Email → 降級用 Email
    if (!result.success && input.email) {
      const fallback = await sendEmailWithAttachment({
        to: input.email,
        subject: `${input.yearMonth} 月結明細 - ${input.customerName}`,
        html: `<p>LINE 發送失敗，改以 Email 發送。</p>`,
        attachmentPath: input.pdfPath,
        attachmentName: path.basename(input.pdfPath),
      })
      result.emailResult = fallback
      result.success = fallback.success
      result.method = 'Email (fallback)'
    }
  }

  // 記錄發送結果
  await prisma.systemLog.create({
    data: {
      eventType: 'send',
      eventContent: `通知 ${input.customerId} (${result.method}): ${result.success ? '成功' : '失敗'} - ${JSON.stringify({
        email: result.emailResult?.success,
        line: result.lineResult?.success,
      })}`,
    },
  })

  return result
}

// 批次發送月結明細通知
export async function sendAllNotifications(yearMonth: string): Promise<{
  total: number
  success: number
  failed: { customerId: string; error: string }[]
}> {
  const statements = await prisma.monthlyStatement.findMany({
    where: { yearMonth, sendStatus: 'pending' },
    include: { customer: true },
  })

  const failed: { customerId: string; error: string }[] = []
  let success = 0

  for (const stmt of statements) {
    if (Number(stmt.totalAmount) === 0) {
      // 金額為 0 不發送
      await prisma.monthlyStatement.update({
        where: { statementId: stmt.statementId },
        data: { sendStatus: 'skipped' },
      })
      continue
    }

    const result = await sendCustomerNotification({
      customerId: stmt.customerId,
      customerName: stmt.customer.customerName,
      notificationMethod: stmt.customer.notificationMethod,
      email: stmt.customer.email,
      lineId: stmt.customer.lineId,
      yearMonth,
      totalAmount: Number(stmt.totalAmount),
      pdfPath: stmt.pdfPath || '',
    })

    await prisma.monthlyStatement.update({
      where: { statementId: stmt.statementId },
      data: {
        sendStatus: result.success ? 'success' : 'failed',
        sentAt: result.success ? new Date() : null,
      },
    })

    if (result.success) {
      success++
    } else {
      failed.push({
        customerId: stmt.customerId,
        error: result.emailResult?.error || result.lineResult?.error || 'Unknown error',
      })
    }
  }

  return { total: statements.length, success, failed }
}

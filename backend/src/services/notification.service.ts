// backend/src/services/notification.service.ts
import nodemailer from 'nodemailer'
import prisma from '../lib/prisma'
import { generateStatementPDFFromId } from './pdf-generator'

// 建立郵件傳輸器
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// 寄送明細 Email 給客戶
export async function sendStatementEmail(statementId: number): Promise<void> {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    include: { customer: true },
  })
  if (!statement) throw new Error('明細不存在')
  if (!statement.customer.notificationEmail) {
    throw new Error('客戶未設定 Email')
  }

  // 產出 PDF 附件
  const pdfBuffer = await generateStatementPDFFromId(statementId)

  const transporter = createTransporter()
  const [yearStr, monthStr] = statement.yearMonth.split('-')

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@recycle.com',
    to: statement.customer.notificationEmail,
    subject: `${statement.customer.name} - ${yearStr}年${monthStr}月 月結明細`,
    text: `${statement.customer.name} 您好，\n\n附件為 ${yearStr}年${monthStr}月的月結明細，請查收。\n\n如有疑問請聯繫我們。`,
    attachments: [{
      filename: `statement-${statement.yearMonth}-${statement.customer.name}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  })

  // 更新寄送狀態
  await prisma.statement.update({
    where: { id: statementId },
    data: {
      status: 'sent',
      sentAt: new Date(),
      sentMethod: 'email',
    },
  })

  // 記錄 log
  await prisma.systemLog.create({
    data: {
      eventType: 'statement_sent',
      eventContent: `明細 #${statementId} 已寄送至 ${statement.customer.notificationEmail}`,
    },
  })
}

// 合約到期提醒
export async function sendContractExpiryReminder(contractId: number, daysLeft: number): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { customer: true },
  })
  if (!contract) throw new Error('合約不存在')

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    // 沒有管理員 Email，只記錄 log
    await prisma.systemLog.create({
      data: {
        eventType: 'contract_expiry_reminder',
        eventContent: `合約 #${contractId}（${contract.customer.name}）將於 ${daysLeft} 天後到期，未設定管理員 Email`,
      },
    })
    return
  }

  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@recycle.com',
    to: adminEmail,
    subject: `合約到期提醒：${contract.customer.name}（${daysLeft} 天後）`,
    text: `以下合約即將到期：\n\n客戶：${contract.customer.name}\n合約期限：${contract.startDate} ~ ${contract.endDate}\n剩餘天數：${daysLeft}\n\n請及時處理合約續約事宜。`,
  })

  await prisma.systemLog.create({
    data: {
      eventType: 'contract_expiry_reminder',
      eventContent: `合約 #${contractId}（${contract.customer.name}）到期提醒已寄送，剩餘 ${daysLeft} 天`,
    },
  })
}

// 寄送失敗報告給管理員
export async function sendFailureReport(failures: { type: string; message: string }[]): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return

  const transporter = createTransporter()
  const failureText = failures.map((f, i) => `${i + 1}. [${f.type}] ${f.message}`).join('\n')

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@recycle.com',
    to: adminEmail,
    subject: `系統異常報告 - ${new Date().toISOString().split('T')[0]}`,
    text: `以下排程任務執行失敗：\n\n${failureText}\n\n請登入系統檢查。`,
  })
}

// LINE 通知介面預留（不實作）
export async function sendLineNotification(_customerId: number, _message: string): Promise<void> {
  // TODO: LINE Messaging API 整合
  throw new Error('LINE 通知尚未實作')
}

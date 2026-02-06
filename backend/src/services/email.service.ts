// backend/src/services/email.service.ts
import nodemailer from 'nodemailer'
import path from 'path'

export interface EmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
}

export interface EmailWithAttachmentOptions extends EmailOptions {
  attachmentPath: string
  attachmentName: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// 建立 SMTP transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// 發送純文字/HTML Email
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    const transporter = createTransporter()
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 發送帶 PDF 附件的 Email
export async function sendEmailWithAttachment(options: EmailWithAttachmentOptions): Promise<EmailResult> {
  try {
    const transporter = createTransporter()
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: [
        {
          filename: options.attachmentName,
          path: options.attachmentPath,
        },
      ],
    })
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 發送管理員預覽 Email
export async function sendPreviewEmail(
  adminEmail: string,
  yearMonth: string,
  totalCustomers: number,
  anomalyCount: number,
  totalAmount: number
): Promise<EmailResult> {
  const subject = `【預覽】${yearMonth} 月結明細即將發送 - 共 ${totalCustomers} 位客戶`
  const html = `
    <h2>${yearMonth} 月結明細預覽</h2>
    <p>以下明細將於 12 小時後自動發送給客戶，如需暫停請登入系統操作。</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
      <tr><td><b>客戶總數</b></td><td>${totalCustomers} 位</td></tr>
      <tr><td><b>異常金額筆數</b></td><td style="color: ${anomalyCount > 0 ? 'red' : 'inherit'}">${anomalyCount} 筆</td></tr>
      <tr><td><b>總金額</b></td><td>$${totalAmount.toLocaleString()}</td></tr>
    </table>
    <br/>
    <p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/reports"
         style="padding: 10px 20px; background: #1890ff; color: white; text-decoration: none; border-radius: 4px;">
        查看明細
      </a>
      &nbsp;&nbsp;
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/reports?action=pause"
         style="padding: 10px 20px; background: #ff4d4f; color: white; text-decoration: none; border-radius: 4px;">
        暫停發送
      </a>
    </p>
  `
  return sendEmail({ to: adminEmail, subject, html })
}

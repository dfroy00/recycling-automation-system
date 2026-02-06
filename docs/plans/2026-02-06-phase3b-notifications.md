# 階段三B：通知發送服務 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作 Email SMTP 與 LINE Messaging API 通知服務，支援月結明細 PDF 附件發送、管理員預覽機制、失敗重試邏輯、發送記錄管理

**Architecture:** 通知服務為獨立模組，支援 Email 和 LINE 兩種管道。發送流程：產生 PDF → 管理員預覽（12 小時緩衝）→ 自動發送 → 記錄結果。失敗時自動降級（LINE 失敗改 Email）或排程重試。

**Tech Stack:** nodemailer, @line/bot-sdk, Vitest

**前置條件:** 階段三A 已完成（PDF 產生服務就緒）

**參考文件:** 設計文檔「通知發送層」及「通知發送失敗處理」章節

---

### Task 1: Email 發送服務

**Files:**
- Create: `backend/tests/email.service.test.ts`
- Create: `backend/src/services/email.service.ts`

**Step 1: 安裝依賴**

Run:
```bash
cd backend
npm install nodemailer
npm install -D @types/nodemailer
```

**Step 2: 在 .env 加入 SMTP 設定**

```bash
# .env 加入
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com
```

同步更新 `.env.example`。

**Step 3: 撰寫 Email 服務測試**

```typescript
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
```

**Step 4: 實作 Email 服務**

```typescript
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
```

**Step 5: 執行測試、Commit**

Run: `cd backend && npm test -- email.service`

```bash
git add backend/src/services/email.service.ts backend/tests/email.service.test.ts backend/package.json backend/package-lock.json .env.example
git commit -m "feat: 實作 Email 發送服務 (SMTP + 附件 + 管理員預覽)"
```

---

### Task 2: LINE 通知服務

**Files:**
- Create: `backend/tests/line.service.test.ts`
- Create: `backend/src/services/line.service.ts`

**Step 1: 安裝 LINE SDK**

Run:
```bash
cd backend
npm install @line/bot-sdk
```

**Step 2: 在 .env 加入 LINE 設定**

```bash
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-token
LINE_CHANNEL_SECRET=your-line-channel-secret
```

**Step 3: 撰寫 LINE 服務測試（Mock）**

```typescript
// backend/tests/line.service.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sendLineMessage, type LineResult } from '../src/services/line.service'

// Mock LINE SDK
vi.mock('@line/bot-sdk', () => ({
  messagingApi: {
    MessagingApiClient: vi.fn().mockImplementation(() => ({
      pushMessage: vi.fn().mockResolvedValue({}),
    })),
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
```

**Step 4: 實作 LINE 服務**

```typescript
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
    `📋 ${yearMonth} 月結明細通知`,
    ``,
    `${customerName} 您好，`,
    `您的 ${yearMonth} 月結明細已產生。`,
    ``,
    `💰 總金額：$${totalAmount.toLocaleString()}`,
    ``,
    `詳細明細已發送至您的 Email，若有疑問請聯絡我們。`,
  ].join('\n')

  return sendLineMessage(userId, message)
}
```

**Step 5: 執行測試、Commit**

Run: `cd backend && npm test -- line.service`

```bash
git add backend/src/services/line.service.ts backend/tests/line.service.test.ts backend/package.json backend/package-lock.json
git commit -m "feat: 實作 LINE 通知服務 (@line/bot-sdk)"
```

---

### Task 3: 統一通知發送與失敗重試服務

**Files:**
- Create: `backend/tests/notification.service.test.ts`
- Create: `backend/src/services/notification.service.ts`

**Step 1: 撰寫通知服務測試**

```typescript
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
```

**Step 2: 實作統一通知服務**

```typescript
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
      eventContent: `通知 ${input.customerId} (${input.method}): ${result.success ? '成功' : '失敗'} - ${JSON.stringify({
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
```

**Step 3: 執行測試、Commit**

Run: `cd backend && npm test -- notification.service`

```bash
git add backend/src/services/notification.service.ts backend/tests/notification.service.test.ts
git commit -m "feat: 實作統一通知服務 (Email/LINE/Both + 失敗降級 + 批次發送)"
```

---

### Task 4: 通知管理 API 與前端通知管理頁面

**Files:**
- Create: `backend/src/routes/notifications.ts`
- Create: `frontend/src/pages/NotificationsPage.tsx`
- Modify: `backend/src/app.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: 實作通知管理路由**

```typescript
// backend/src/routes/notifications.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { sendAllNotifications, sendCustomerNotification } from '../services/notification.service'
import { sendPreviewEmail } from '../services/email.service'

const router = Router()

// POST /api/notifications/send - 批次發送通知
router.post('/send', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { yearMonth } = req.body
    if (!yearMonth) return res.status(400).json({ message: '請指定 yearMonth' })

    const result = await sendAllNotifications(yearMonth)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: '發送失敗', error: error.message })
  }
})

// POST /api/notifications/preview - 發送預覽給管理員
router.post('/preview', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { yearMonth, adminEmail } = req.body
    if (!yearMonth || !adminEmail) {
      return res.status(400).json({ message: '請指定 yearMonth 和 adminEmail' })
    }

    const statements = await prisma.monthlyStatement.findMany({
      where: { yearMonth },
    })

    const totalAmount = statements.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const anomalyCount = statements.filter(s => (s.detailJson as any)?.anomaly).length

    const result = await sendPreviewEmail(adminEmail, yearMonth, statements.length, anomalyCount, totalAmount)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: '預覽發送失敗', error: error.message })
  }
})

// POST /api/notifications/retry/:statementId - 重新發送單一通知
router.post('/retry/:statementId', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const statement = await prisma.monthlyStatement.findUniqueOrThrow({
      where: { statementId: Number(req.params.statementId) },
      include: { customer: true },
    })

    const result = await sendCustomerNotification({
      customerId: statement.customerId,
      customerName: statement.customer.customerName,
      notificationMethod: statement.customer.notificationMethod,
      email: statement.customer.email,
      lineId: statement.customer.lineId,
      yearMonth: statement.yearMonth,
      totalAmount: Number(statement.totalAmount),
      pdfPath: statement.pdfPath || '',
    })

    await prisma.monthlyStatement.update({
      where: { statementId: statement.statementId },
      data: {
        sendStatus: result.success ? 'success' : 'failed',
        sentAt: result.success ? new Date() : null,
      },
    })

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: '重發失敗', error: error.message })
  }
})

// GET /api/notifications/logs - 發送記錄
router.get('/logs', authenticate, async (req: Request, res: Response) => {
  try {
    const { yearMonth, status, page = '1', pageSize = '20' } = req.query
    const where: any = {}

    if (yearMonth) where.yearMonth = yearMonth
    if (status) where.sendStatus = status

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.monthlyStatement.findMany({
        where,
        include: { customer: { select: { customerName: true, notificationMethod: true } } },
        skip,
        take: Number(pageSize),
        orderBy: { generatedAt: 'desc' },
      }),
      prisma.monthlyStatement.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

export default router
```

**Step 2: 掛載路由**

```typescript
// backend/src/app.ts
import notificationsRouter from './routes/notifications'
app.use('/api/notifications', notificationsRouter)
```

**Step 3: 實作前端通知管理頁面**

```typescript
// frontend/src/pages/NotificationsPage.tsx
import { useState } from 'react'
import { Table, Button, Space, Typography, Tag, Input, Select, Modal, Form, message, Row, Col } from 'antd'
import { SendOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

export default function NotificationsPage() {
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 })
  const [previewModal, setPreviewModal] = useState(false)
  const [previewForm] = Form.useForm()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notification-logs', filters],
    queryFn: () => api.get('/notifications/logs', { params: filters }).then(r => r.data),
  })

  const sendMutation = useMutation({
    mutationFn: (yearMonth: string) => api.post('/notifications/send', { yearMonth }),
    onSuccess: (res) => {
      message.success(`發送完成：${res.data.success}/${res.data.total} 成功`)
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] })
    },
  })

  const retryMutation = useMutation({
    mutationFn: (statementId: number) => api.post(`/notifications/retry/${statementId}`),
    onSuccess: () => {
      message.success('重發成功')
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] })
    },
  })

  const previewMutation = useMutation({
    mutationFn: (data: any) => api.post('/notifications/preview', data),
    onSuccess: () => { message.success('預覽已發送到管理員信箱'); setPreviewModal(false) },
  })

  const statusColors: Record<string, string> = {
    success: 'green',
    failed: 'red',
    pending: 'orange',
    skipped: 'default',
  }

  const columns = [
    { title: '客戶', dataIndex: ['customer', 'customerName'], key: 'customer' },
    { title: '年月', dataIndex: 'yearMonth', key: 'yearMonth' },
    { title: '金額', dataIndex: 'totalAmount', key: 'totalAmount', render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: '通知方式', dataIndex: ['customer', 'notificationMethod'], key: 'method' },
    {
      title: '狀態', dataIndex: 'sendStatus', key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: '發送時間', dataIndex: 'sentAt', key: 'sentAt',
      render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        record.sendStatus === 'failed' && (
          <Button type="link" size="small" icon={<ReloadOutlined />}
            loading={retryMutation.isPending}
            onClick={() => retryMutation.mutate(record.statementId)}>
            重發
          </Button>
        )
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>通知管理</Title>
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewModal(true)}>發送預覽</Button>
          <Button type="primary" icon={<SendOutlined />}
            onClick={() => {
              const ym = filters.yearMonth || dayjs().format('YYYY-MM')
              Modal.confirm({
                title: '確認發送',
                content: `確定要發送 ${ym} 的所有待發送明細嗎？`,
                onOk: () => sendMutation.mutate(ym),
              })
            }}>
            批次發送
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Input placeholder="年月 (YYYY-MM)" onChange={e => setFilters((f: any) => ({ ...f, yearMonth: e.target.value, page: 1 }))} />
        </Col>
        <Col span={4}>
          <Select placeholder="狀態" allowClear style={{ width: '100%' }}
            onChange={v => setFilters((f: any) => ({ ...f, status: v, page: 1 }))}>
            <Select.Option value="pending">待發送</Select.Option>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失敗</Select.Option>
          </Select>
        </Col>
      </Row>

      <Table columns={columns} dataSource={data?.data} rowKey="statementId" loading={isLoading}
        pagination={{ current: filters.page, pageSize: filters.pageSize, total: data?.total,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })) }} size="small" />

      {/* 預覽 Modal */}
      <Modal title="發送預覽到管理員信箱" open={previewModal}
        onOk={async () => { const v = await previewForm.validateFields(); previewMutation.mutate(v) }}
        onCancel={() => setPreviewModal(false)}>
        <Form form={previewForm} layout="vertical">
          <Form.Item name="yearMonth" label="年月" rules={[{ required: true }]}>
            <Input placeholder="YYYY-MM" />
          </Form.Item>
          <Form.Item name="adminEmail" label="管理員 Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
```

**Step 4: 更新前端路由**

```typescript
import NotificationsPage from './pages/NotificationsPage'
// 在 reports 路由下方加入
<Route path="notifications" element={<NotificationsPage />} />
```

在 `AppLayout.tsx` 的選單加入通知管理項目（在報表管理之後）。

**Step 5: 執行所有測試、Commit**

Run: `cd backend && npm test`

```bash
git add backend/src/routes/notifications.ts backend/src/app.ts frontend/src/pages/NotificationsPage.tsx frontend/src/App.tsx
git commit -m "feat: 實作通知管理 (API + 前端頁面 + 批次發送 + 重試)"
```

---

## 階段三B 完成標準

- [x] Email 發送服務（SMTP + 附件）
- [x] 管理員預覽 Email
- [x] LINE 通知服務（@line/bot-sdk）
- [x] 統一通知服務（Email/LINE/Both + 失敗降級）
- [x] 批次發送 API
- [x] 重試發送 API
- [x] 預覽發送 API
- [x] 發送記錄查詢 API
- [x] 前端通知管理頁面（記錄 + 批次發送 + 重發）
- [x] 所有測試通過

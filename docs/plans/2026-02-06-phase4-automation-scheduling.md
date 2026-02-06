# 階段四：自動化排程 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 node-cron 建立自動化排程系統，包含檔案監控、資料完整性檢查、合約到期掃描與提醒、月結自動流程（30號）、發票自動流程（15號）、例假日調整邏輯

**Architecture:** 排程服務為獨立模組 `scheduler.service.ts`，啟動時註冊所有 cron job。每個排程任務對應一個獨立函式，執行前後皆寫入 system_logs。管理員可透過 API 調整排程參數（儲存在環境變數或資料庫）。

**Tech Stack:** node-cron, dayjs (日期計算/例假日判斷), Vitest

**前置條件:** 階段三A + 三B 已完成（PDF 產生、通知發送服務就緒）

**參考文件:** 設計文檔「階段四：自動化排程」及「合約管理與提醒」章節

---

### Task 1: 安裝排程依賴與建立排程服務骨架

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/services/scheduler.service.ts`
- Modify: `backend/src/index.ts`

**Step 1: 安裝依賴**

Run:
```bash
cd backend
npm install node-cron
npm install -D @types/node-cron
```

**Step 2: 在 .env 加入排程設定**

```bash
# .env 加入
# 排程設定
SCHEDULE_FILE_WATCH=0 * * * *
SCHEDULE_DATA_INTEGRITY=0 23 * * *
SCHEDULE_CONTRACT_SCAN=0 10 * * *
SCHEDULE_MONTHLY_BILLING=0 9 30 * *
SCHEDULE_INVOICE=0 9 15 * *
SCHEDULE_RETRY_NOTIFICATION=0 9 * * *
ENABLE_SCHEDULER=true
```

同步更新 `.env.example`。

**Step 3: 建立排程服務骨架**

```typescript
// backend/src/services/scheduler.service.ts
import cron from 'node-cron'
import { prisma } from '../lib/prisma'

// 排程任務定義
interface ScheduleTask {
  name: string
  schedule: string
  handler: () => Promise<void>
  enabled: boolean
}

// 寫入排程執行日誌
async function logScheduleEvent(taskName: string, status: 'start' | 'success' | 'error', detail?: string) {
  await prisma.systemLog.create({
    data: {
      eventType: 'schedule',
      eventContent: `[${taskName}] ${status}${detail ? ': ' + detail : ''}`,
    },
  })
}

// 包裝排程處理函式，加上日誌和錯誤處理
function wrapHandler(name: string, handler: () => Promise<void>): () => Promise<void> {
  return async () => {
    await logScheduleEvent(name, 'start')
    try {
      await handler()
      await logScheduleEvent(name, 'success')
    } catch (error: any) {
      await logScheduleEvent(name, 'error', error.message)
      console.error(`[排程錯誤] ${name}:`, error.message)
    }
  }
}

// 啟動所有排程
export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('[排程] 排程已停用 (ENABLE_SCHEDULER !== true)')
    return
  }

  const tasks: ScheduleTask[] = [
    {
      name: '檔案監控掃描',
      schedule: process.env.SCHEDULE_FILE_WATCH || '0 * * * *',
      handler: handleFileWatch,
      enabled: true,
    },
    {
      name: '資料完整性檢查',
      schedule: process.env.SCHEDULE_DATA_INTEGRITY || '0 23 * * *',
      handler: handleDataIntegrityCheck,
      enabled: true,
    },
    {
      name: '合約到期掃描',
      schedule: process.env.SCHEDULE_CONTRACT_SCAN || '0 10 * * *',
      handler: handleContractScan,
      enabled: true,
    },
    {
      name: '月結自動流程',
      schedule: process.env.SCHEDULE_MONTHLY_BILLING || '0 9 30 * *',
      handler: handleMonthlyBilling,
      enabled: true,
    },
    {
      name: '發票自動流程',
      schedule: process.env.SCHEDULE_INVOICE || '0 9 15 * *',
      handler: handleInvoiceGeneration,
      enabled: true,
    },
    {
      name: '通知重試',
      schedule: process.env.SCHEDULE_RETRY_NOTIFICATION || '0 9 * * *',
      handler: handleNotificationRetry,
      enabled: true,
    },
  ]

  for (const task of tasks) {
    if (!task.enabled) continue

    if (!cron.validate(task.schedule)) {
      console.error(`[排程] 無效的 cron 表達式: ${task.name} = ${task.schedule}`)
      continue
    }

    cron.schedule(task.schedule, wrapHandler(task.name, task.handler))
    console.log(`[排程] 已註冊: ${task.name} (${task.schedule})`)
  }

  console.log(`[排程] 共啟動 ${tasks.filter(t => t.enabled).length} 個排程任務`)
}

// ===== 排程任務處理函式（暫時空實作，後續 Task 填充） =====

async function handleFileWatch() {
  // Task 2 實作
}

async function handleDataIntegrityCheck() {
  // Task 3 實作
}

async function handleContractScan() {
  // Task 4 實作
}

async function handleMonthlyBilling() {
  // Task 5 實作
}

async function handleInvoiceGeneration() {
  // Task 5 實作
}

async function handleNotificationRetry() {
  // Task 6 實作
}
```

**Step 4: 在 index.ts 啟動排程**

在 `backend/src/index.ts` 的伺服器啟動後加入：

```typescript
import { startScheduler } from './services/scheduler.service'

// 在 app.listen 回呼內加入
startScheduler()
```

**Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/services/scheduler.service.ts backend/src/index.ts .env.example
git commit -m "feat: 建立排程服務骨架 (node-cron + 6 個排程任務註冊)"
```

---

### Task 2: 檔案監控排程

**Files:**
- Create: `backend/tests/scheduler-file-watch.test.ts`
- Modify: `backend/src/services/scheduler.service.ts`

**Step 1: 撰寫測試**

```typescript
// backend/tests/scheduler-file-watch.test.ts
import { describe, it, expect, vi } from 'vitest'
import { checkForNewFiles } from '../src/services/scheduler.service'
import fs from 'fs'

// Mock fs 和 import service
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      readdirSync: vi.fn().mockReturnValue(['trip_2026-02-05.xlsx', 'item_2026-02-05.xlsx']),
      statSync: vi.fn().mockReturnValue({ mtime: new Date() }),
    },
  }
})

describe('檔案監控排程', () => {
  it('應掃描指定目錄並回傳新檔案清單', async () => {
    const result = await checkForNewFiles('/fake/watch/dir')
    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
  })

  it('目錄不存在時應回傳空陣列', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false)
    const result = await checkForNewFiles('/nonexistent')
    expect(result).toEqual([])
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- scheduler-file-watch`
Expected: FAIL（checkForNewFiles 尚未匯出）

**Step 3: 實作檔案監控邏輯**

在 `scheduler.service.ts` 加入：

```typescript
import fs from 'fs'
import path from 'path'

// 已處理檔案記錄（避免重複匯入）
const processedFiles = new Set<string>()

// 掃描目錄中的新檔案
export async function checkForNewFiles(watchDir: string): Promise<string[]> {
  if (!fs.existsSync(watchDir)) {
    return []
  }

  const files = fs.readdirSync(watchDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .filter(f => !processedFiles.has(path.join(watchDir, f)))

  return files.map(f => path.join(watchDir, f))
}

// 標記檔案已處理
export function markFileProcessed(filePath: string) {
  processedFiles.add(filePath)
}
```

更新 `handleFileWatch`：

```typescript
import { importTripsFromFile, importItemsFromFile } from './import.service'

async function handleFileWatch() {
  const tripDir = process.env.TRIP_WATCH_DIR || './data/trips'
  const itemDir = process.env.ITEM_WATCH_DIR || './data/items'

  // 掃描車趟目錄
  const tripFiles = await checkForNewFiles(tripDir)
  for (const filePath of tripFiles) {
    try {
      await importTripsFromFile(filePath)
      markFileProcessed(filePath)
      await logScheduleEvent('檔案監控', 'success', `已匯入車趟檔案: ${path.basename(filePath)}`)
    } catch (error: any) {
      await logScheduleEvent('檔案監控', 'error', `車趟匯入失敗: ${path.basename(filePath)} - ${error.message}`)
    }
  }

  // 掃描品項目錄
  const itemFiles = await checkForNewFiles(itemDir)
  for (const filePath of itemFiles) {
    try {
      await importItemsFromFile(filePath)
      markFileProcessed(filePath)
      await logScheduleEvent('檔案監控', 'success', `已匯入品項檔案: ${path.basename(filePath)}`)
    } catch (error: any) {
      await logScheduleEvent('檔案監控', 'error', `品項匯入失敗: ${path.basename(filePath)} - ${error.message}`)
    }
  }

  // 檢查是否連續 2 天無新檔案
  const lastLog = await prisma.systemLog.findFirst({
    where: { eventType: 'import' },
    orderBy: { createdAt: 'desc' },
  })

  if (lastLog) {
    const daysSinceLastImport = Math.floor(
      (Date.now() - lastLog.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceLastImport >= 2) {
      await logScheduleEvent('檔案監控', 'error', `警告：已連續 ${daysSinceLastImport} 天無新檔案匯入`)
      // 發送警示 Email 給管理員
      const { sendEmail } = await import('./email.service')
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `【警告】已連續 ${daysSinceLastImport} 天無新檔案匯入`,
          text: `系統偵測到已連續 ${daysSinceLastImport} 天沒有新的 Excel 檔案匯入，請確認車機/ERP 匯出是否正常。`,
        })
      }
    }
  }
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- scheduler-file-watch`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/scheduler.service.ts backend/tests/scheduler-file-watch.test.ts
git commit -m "feat: 實作檔案監控排程 (掃描新檔案 + 自動匯入 + 2天無更新警示)"
```

---

### Task 3: 資料完整性檢查排程

**Files:**
- Create: `backend/tests/scheduler-integrity.test.ts`
- Modify: `backend/src/services/scheduler.service.ts`

**Step 1: 撰寫測試**

```typescript
// backend/tests/scheduler-integrity.test.ts
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
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- scheduler-integrity`
Expected: FAIL

**Step 3: 實作資料完整性檢查**

在 `scheduler.service.ts` 加入：

```typescript
import dayjs from 'dayjs'

export interface IntegrityReport {
  yearMonth: string
  tripCount: number
  itemCount: number
  orphanTrips: number    // 有車趟但無對應品項（非 B 類客戶）
  orphanItems: number    // 有品項但無對應車趟
  missingCustomers: string[] // 引用了不存在的客戶
  issues: string[]
}

// 資料完整性檢查
export async function checkDataIntegrity(yearMonth: string): Promise<IntegrityReport> {
  const [year, month] = yearMonth.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // 該月最後一天

  const report: IntegrityReport = {
    yearMonth,
    tripCount: 0,
    itemCount: 0,
    orphanTrips: 0,
    orphanItems: 0,
    missingCustomers: [],
    issues: [],
  }

  // 統計該月車趟數
  report.tripCount = await prisma.trip.count({
    where: {
      tripDate: { gte: startDate, lte: endDate },
    },
  })

  // 統計該月品項數
  report.itemCount = await prisma.itemCollected.count({
    where: {
      collectionDate: { gte: startDate, lte: endDate },
    },
  })

  // 找出有車趟但無品項的非 B 類客戶
  const tripsWithCustomer = await prisma.trip.findMany({
    where: { tripDate: { gte: startDate, lte: endDate } },
    select: { customerId: true },
    distinct: ['customerId'],
  })

  const itemsWithCustomer = await prisma.itemCollected.findMany({
    where: { collectionDate: { gte: startDate, lte: endDate } },
    select: { customerId: true },
    distinct: ['customerId'],
  })

  const tripCustomerIds = new Set(tripsWithCustomer.map(t => t.customerId))
  const itemCustomerIds = new Set(itemsWithCustomer.map(i => i.customerId))

  // 檢查非 B 類客戶的孤兒車趟
  const nonBCustomers = await prisma.customer.findMany({
    where: { billingType: { not: 'B' } },
    select: { customerId: true },
  })
  const nonBIds = new Set(nonBCustomers.map(c => c.customerId))

  for (const cId of tripCustomerIds) {
    if (nonBIds.has(cId) && !itemCustomerIds.has(cId)) {
      report.orphanTrips++
      report.issues.push(`客戶 ${cId}（非B類）有車趟但無品項記錄`)
    }
  }

  // 有品項但無車趟的客戶
  for (const cId of itemCustomerIds) {
    if (!tripCustomerIds.has(cId)) {
      report.orphanItems++
      report.issues.push(`客戶 ${cId} 有品項但無車趟記錄`)
    }
  }

  // 檢查引用不存在的客戶
  const allCustomers = await prisma.customer.findMany({
    select: { customerId: true },
  })
  const validCustomerIds = new Set(allCustomers.map(c => c.customerId))

  for (const cId of tripCustomerIds) {
    if (!validCustomerIds.has(cId)) {
      report.missingCustomers.push(cId)
    }
  }
  for (const cId of itemCustomerIds) {
    if (!validCustomerIds.has(cId) && !report.missingCustomers.includes(cId)) {
      report.missingCustomers.push(cId)
    }
  }

  return report
}
```

更新 `handleDataIntegrityCheck`：

```typescript
async function handleDataIntegrityCheck() {
  const yearMonth = dayjs().format('YYYY-MM')
  const report = await checkDataIntegrity(yearMonth)

  // 有問題時發送通知
  if (report.issues.length > 0 || report.missingCustomers.length > 0) {
    const { sendEmail } = await import('./email.service')
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `【資料完整性檢查】${yearMonth} 發現 ${report.issues.length} 個問題`,
        html: `
          <h3>${yearMonth} 資料完整性檢查報告</h3>
          <p>車趟數：${report.tripCount}，品項數：${report.itemCount}</p>
          <p>孤兒車趟（非B類無品項）：${report.orphanTrips}</p>
          <p>孤兒品項（無車趟）：${report.orphanItems}</p>
          ${report.missingCustomers.length > 0 ? `<p style="color:red">不存在的客戶：${report.missingCustomers.join(', ')}</p>` : ''}
          <h4>問題清單：</h4>
          <ul>${report.issues.map(i => `<li>${i}</li>`).join('')}</ul>
        `,
      })
    }

    await logScheduleEvent('資料完整性', 'success', `發現 ${report.issues.length} 個問題`)
  } else {
    await logScheduleEvent('資料完整性', 'success', `${yearMonth} 資料正常（車趟: ${report.tripCount}, 品項: ${report.itemCount}）`)
  }
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- scheduler-integrity`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/scheduler.service.ts backend/tests/scheduler-integrity.test.ts
git commit -m "feat: 實作資料完整性檢查排程 (孤兒車趟/品項 + 不存在客戶偵測)"
```

---

### Task 4: 合約到期掃描與提醒

**Files:**
- Create: `backend/tests/scheduler-contract.test.ts`
- Modify: `backend/src/services/scheduler.service.ts`

**Step 1: 撰寫測試**

```typescript
// backend/tests/scheduler-contract.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanExpiringContracts, type ContractExpiryResult } from '../src/services/scheduler.service'

// Mock Prisma
const mockContracts = [
  {
    contractPriceId: 1,
    customerId: 'C003',
    itemName: '紙類',
    contractPrice: 4.5,
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-03-01'), // 23 天後到期
    customer: { customerName: '大成製造', site: { siteName: '台北站' }, email: 'dc@test.com' },
  },
  {
    contractPriceId: 2,
    customerId: 'C004',
    itemName: '塑膠',
    contractPrice: 3.0,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-02-10'), // 4 天後到期（緊急）
    customer: { customerName: '永興工業', site: { siteName: '新北站' }, email: 'yx@test.com' },
  },
]

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    contractPrice: {
      findMany: vi.fn().mockResolvedValue(mockContracts),
      update: vi.fn().mockResolvedValue({}),
    },
    customer: {
      update: vi.fn().mockResolvedValue({}),
    },
    systemLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('合約到期掃描', () => {
  it('應找出 30 天內到期的合約', async () => {
    const result = await scanExpiringContracts()

    expect(result).toBeDefined()
    expect(result.expiring).toBeGreaterThanOrEqual(0)
    expect(result.details).toBeDefined()
  })

  it('應正確分類提醒等級', async () => {
    const result = await scanExpiringContracts()

    // 每個 detail 應有 urgency 屬性
    for (const d of result.details) {
      expect(['30day', '15day', '7day', 'today']).toContain(d.urgency)
    }
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- scheduler-contract`
Expected: FAIL

**Step 3: 實作合約到期掃描**

在 `scheduler.service.ts` 加入：

```typescript
export interface ContractExpiryDetail {
  contractPriceId: number
  customerId: string
  customerName: string
  siteName: string
  itemName: string
  endDate: Date
  daysLeft: number
  urgency: '30day' | '15day' | '7day' | 'today'
}

export interface ContractExpiryResult {
  expiring: number
  details: ContractExpiryDetail[]
  autoSwitched: number
}

// 掃描即將到期的合約
export async function scanExpiringContracts(): Promise<ContractExpiryResult> {
  const now = dayjs()
  const thirtyDaysLater = now.add(30, 'day').toDate()

  // 查詢 30 天內到期的合約
  const contracts = await prisma.contractPrice.findMany({
    where: {
      endDate: {
        gte: now.startOf('day').toDate(),
        lte: thirtyDaysLater,
      },
    },
    include: {
      customer: {
        include: { site: true },
      },
    },
  })

  const details: ContractExpiryDetail[] = []
  let autoSwitched = 0

  for (const contract of contracts) {
    const daysLeft = dayjs(contract.endDate).diff(now, 'day')

    // 判斷提醒等級
    let urgency: ContractExpiryDetail['urgency']
    if (daysLeft <= 0) {
      urgency = 'today'
    } else if (daysLeft <= 7) {
      urgency = '7day'
    } else if (daysLeft <= 15) {
      urgency = '15day'
    } else {
      urgency = '30day'
    }

    details.push({
      contractPriceId: contract.contractPriceId,
      customerId: contract.customerId,
      customerName: contract.customer.customerName,
      siteName: contract.customer.site.siteName,
      itemName: contract.itemName,
      endDate: contract.endDate,
      daysLeft,
      urgency,
    })

    // 當日到期 → 自動切換為牌價（billingType 改為 D）
    if (daysLeft <= 0) {
      // 檢查該客戶是否所有合約都已到期
      const activeContracts = await prisma.contractPrice.findMany({
        where: {
          customerId: contract.customerId,
          endDate: { gt: now.toDate() },
        },
      })

      // 如果沒有其他有效合約，將客戶改為 D 類（全牌價）
      if (activeContracts.length === 0) {
        await prisma.customer.update({
          where: { customerId: contract.customerId },
          data: { billingType: 'D' },
        })
        autoSwitched++
        await logScheduleEvent(
          '合約到期',
          'success',
          `客戶 ${contract.customerId} (${contract.customer.customerName}) 所有合約已到期，自動切換為 D 類（牌價計費）`
        )
      }
    }
  }

  return { expiring: details.length, details, autoSwitched }
}
```

更新 `handleContractScan`：

```typescript
async function handleContractScan() {
  const result = await scanExpiringContracts()

  if (result.details.length === 0) {
    return // 無即將到期合約
  }

  // 依提醒等級分組
  const grouped = {
    today: result.details.filter(d => d.urgency === 'today'),
    '7day': result.details.filter(d => d.urgency === '7day'),
    '15day': result.details.filter(d => d.urgency === '15day'),
    '30day': result.details.filter(d => d.urgency === '30day'),
  }

  // 發送提醒 Email 給管理員
  const { sendEmail } = await import('./email.service')
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return

  const urgencyLabels: Record<string, string> = {
    today: '🔴 今日到期',
    '7day': '🟠 7天內到期',
    '15day': '🟡 15天內到期',
    '30day': '🟢 30天內到期',
  }

  let html = `<h3>合約到期提醒 - 共 ${result.details.length} 筆</h3>`

  if (result.autoSwitched > 0) {
    html += `<p style="color:red; font-weight:bold">⚠️ 已自動切換 ${result.autoSwitched} 位客戶為牌價計費</p>`
  }

  for (const [level, items] of Object.entries(grouped)) {
    if (items.length === 0) continue
    html += `<h4>${urgencyLabels[level]}（${items.length} 筆）</h4>`
    html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">`
    html += `<tr style="background:#f0f0f0"><th>客戶</th><th>站點</th><th>品項</th><th>到期日</th><th>剩餘天數</th></tr>`
    for (const d of items) {
      const rowColor = d.urgency === 'today' ? 'style="background:#fff0f0"' : ''
      html += `<tr ${rowColor}><td>${d.customerName}</td><td>${d.siteName}</td><td>${d.itemName}</td><td>${dayjs(d.endDate).format('YYYY-MM-DD')}</td><td>${d.daysLeft} 天</td></tr>`
    }
    html += `</table><br/>`
  }

  const subject = result.details.some(d => d.urgency === 'today' || d.urgency === '7day')
    ? `【緊急】合約到期提醒 - ${result.details.length} 筆即將到期`
    : `【提醒】合約到期提醒 - ${result.details.length} 筆即將到期`

  await sendEmail({ to: adminEmail, subject, html })
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- scheduler-contract`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/scheduler.service.ts backend/tests/scheduler-contract.test.ts
git commit -m "feat: 實作合約到期掃描 (30/15/7天提醒 + 到期自動切換牌價)"
```

---

### Task 5: 月結與發票自動流程 + 例假日調整

**Files:**
- Create: `backend/tests/scheduler-billing.test.ts`
- Modify: `backend/src/services/scheduler.service.ts`

**Step 1: 撰寫測試**

```typescript
// backend/tests/scheduler-billing.test.ts
import { describe, it, expect } from 'vitest'
import { adjustForHoliday, getWorkingDay } from '../src/services/scheduler.service'
import dayjs from 'dayjs'

describe('例假日調整', () => {
  it('平日應回傳同一天', () => {
    // 2026-02-06 是星期五
    const result = getWorkingDay(dayjs('2026-02-06'))
    expect(result.format('YYYY-MM-DD')).toBe('2026-02-06')
  })

  it('週六應回傳上一個星期五', () => {
    // 2026-02-07 是星期六
    const result = getWorkingDay(dayjs('2026-02-07'))
    expect(result.format('YYYY-MM-DD')).toBe('2026-02-06')
  })

  it('週日應回傳上一個星期五', () => {
    // 2026-02-08 是星期日
    const result = getWorkingDay(dayjs('2026-02-08'))
    expect(result.format('YYYY-MM-DD')).toBe('2026-02-06')
  })

  it('30 號遇例假日應提前到最近工作日', () => {
    const result = adjustForHoliday(2026, 5, 30) // 2026-05-30 是星期六
    expect(result.day()).not.toBe(0) // 不是星期日
    expect(result.day()).not.toBe(6) // 不是星期六
  })

  it('15 號遇例假日應提前到最近工作日', () => {
    const result = adjustForHoliday(2026, 2, 15) // 2026-02-15 是星期日
    expect(result.day()).not.toBe(0)
    expect(result.day()).not.toBe(6)
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- scheduler-billing`
Expected: FAIL

**Step 3: 實作例假日調整與月結/發票流程**

在 `scheduler.service.ts` 加入：

```typescript
// 取得最近的工作日（往前找）
export function getWorkingDay(date: dayjs.Dayjs): dayjs.Dayjs {
  let d = date
  while (d.day() === 0 || d.day() === 6) {
    d = d.subtract(1, 'day')
  }
  return d
}

// 調整特定日期遇例假日的情況
export function adjustForHoliday(year: number, month: number, day: number): dayjs.Dayjs {
  const targetDate = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  return getWorkingDay(targetDate)
}

// 判斷今天是否為目標執行日（考慮例假日調整）
function isScheduledDay(targetDay: number): boolean {
  const today = dayjs()
  const year = today.year()
  const month = today.month() + 1

  // 如果目標日超過該月天數（如 30 號但只有 28/29 天），用該月最後一天
  const lastDay = today.endOf('month').date()
  const actualDay = Math.min(targetDay, lastDay)

  const scheduledDate = adjustForHoliday(year, month, actualDay)
  return today.format('YYYY-MM-DD') === scheduledDate.format('YYYY-MM-DD')
}
```

更新 `handleMonthlyBilling`：

```typescript
async function handleMonthlyBilling() {
  // 檢查今天是否為月結執行日（30 號或調整後的工作日）
  if (!isScheduledDay(30)) {
    await logScheduleEvent('月結流程', 'success', '今日非月結執行日，跳過')
    return
  }

  const yearMonth = dayjs().format('YYYY-MM')

  // Step 1: 產生月結明細
  const { generateAllStatements } = await import('./monthly-statement.service')
  const stmtResult = await generateAllStatements(yearMonth)
  await logScheduleEvent('月結流程', 'success', `已產生 ${stmtResult.total} 筆月結明細`)

  // Step 2: 產生 PDF
  const { generateAllPdfs } = await import('./pdf-batch.service')
  const pdfResult = await generateAllPdfs(yearMonth)
  await logScheduleEvent('月結流程', 'success', `已產生 ${pdfResult.success}/${pdfResult.total} 份 PDF`)

  // Step 3: 發送管理員預覽
  const { sendPreviewEmail } = await import('./email.service')
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) {
    const statements = await prisma.monthlyStatement.findMany({
      where: { yearMonth },
    })
    const totalAmount = statements.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const anomalyCount = statements.filter(s => (s.detailJson as any)?.anomaly).length

    await sendPreviewEmail(adminEmail, yearMonth, statements.length, anomalyCount, totalAmount)
    await logScheduleEvent('月結流程', 'success', '已發送管理員預覽 Email')
  }

  // 注意：實際發送給客戶由 handleNotificationRetry 或管理員手動觸發
  // 預留 12 小時緩衝時間讓管理員檢視
}
```

更新 `handleInvoiceGeneration`：

```typescript
async function handleInvoiceGeneration() {
  // 檢查今天是否為發票執行日（15 號或調整後的工作日）
  if (!isScheduledDay(15)) {
    await logScheduleEvent('發票流程', 'success', '今日非發票執行日，跳過')
    return
  }

  // 產生上個月的發票 Excel
  const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM')

  const { generateInvoiceExcel } = await import('./invoice-excel.service')

  const statements = await prisma.monthlyStatement.findMany({
    where: { yearMonth: lastMonth },
    include: { customer: { include: { site: true } } },
  })

  if (statements.length === 0) {
    await logScheduleEvent('發票流程', 'success', `${lastMonth} 無月結明細，跳過`)
    return
  }

  const invoiceData = statements.map(s => ({
    customerId: s.customerId,
    customerName: s.customer.customerName,
    siteName: s.customer.site.siteName,
    billingType: s.customer.billingType,
    totalAmount: Number(s.totalAmount),
    tripFee: Number((s.detailJson as any)?.tripFee || 0),
    itemFee: Number((s.detailJson as any)?.itemFee || 0),
  }))

  const outputDir = path.join(__dirname, '../../output')
  const filePath = await generateInvoiceExcel(lastMonth, invoiceData, outputDir)

  await logScheduleEvent('發票流程', 'success', `已產生 ${lastMonth} 發票 Excel: ${path.basename(filePath)}`)

  // 發送給財務人員
  const { sendEmailWithAttachment } = await import('./email.service')
  const financeEmail = process.env.FINANCE_EMAIL
  if (financeEmail) {
    await sendEmailWithAttachment({
      to: financeEmail,
      subject: `${lastMonth} 發票明細彙總表`,
      html: `<p>附件為 ${lastMonth} 的發票明細彙總表，共 ${statements.length} 位客戶。</p>`,
      attachmentPath: filePath,
      attachmentName: path.basename(filePath),
    })
    await logScheduleEvent('發票流程', 'success', '已發送發票 Excel 給財務人員')
  }
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- scheduler-billing`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/scheduler.service.ts backend/tests/scheduler-billing.test.ts
git commit -m "feat: 實作月結/發票自動流程 + 例假日調整 (30號月結 + 15號發票 + 管理員預覽)"
```

---

### Task 6: 通知重試排程

**Files:**
- Create: `backend/tests/scheduler-retry.test.ts`
- Modify: `backend/src/services/scheduler.service.ts`

**Step 1: 撰寫測試**

```typescript
// backend/tests/scheduler-retry.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getFailedNotifications } from '../src/services/scheduler.service'

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    monthlyStatement: {
      findMany: vi.fn().mockResolvedValue([
        { statementId: 1, customerId: 'C001', sendStatus: 'failed', yearMonth: '2026-02' },
        { statementId: 2, customerId: 'C002', sendStatus: 'failed', yearMonth: '2026-02' },
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
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- scheduler-retry`
Expected: FAIL

**Step 3: 實作通知重試**

在 `scheduler.service.ts` 加入：

```typescript
// 取得發送失敗的通知
export async function getFailedNotifications() {
  return prisma.monthlyStatement.findMany({
    where: { sendStatus: 'failed' },
    include: { customer: true },
  })
}
```

更新 `handleNotificationRetry`：

```typescript
async function handleNotificationRetry() {
  const failedStatements = await getFailedNotifications()

  if (failedStatements.length === 0) {
    return // 無失敗的通知
  }

  // 檢查每筆的重試次數（從 systemLog 查詢）
  const { sendCustomerNotification } = await import('./notification.service')
  let retried = 0
  let gaveUp = 0

  for (const stmt of failedStatements) {
    // 查詢該筆的重試次數
    const retryLogs = await prisma.systemLog.findMany({
      where: {
        eventType: 'send',
        eventContent: { contains: stmt.customerId },
      },
    })

    // 連續 2 次失敗 → 不再重試，通知管理員
    if (retryLogs.length >= 2) {
      gaveUp++
      continue
    }

    const result = await sendCustomerNotification({
      customerId: stmt.customerId,
      customerName: stmt.customer.customerName,
      notificationMethod: stmt.customer.notificationMethod,
      email: stmt.customer.email,
      lineId: stmt.customer.lineId,
      yearMonth: stmt.yearMonth,
      totalAmount: Number(stmt.totalAmount),
      pdfPath: stmt.pdfPath || '',
    })

    if (result.success) {
      await prisma.monthlyStatement.update({
        where: { statementId: stmt.statementId },
        data: { sendStatus: 'success', sentAt: new Date() },
      })
      retried++
    }
  }

  // 有放棄重試的，通知管理員人工處理
  if (gaveUp > 0) {
    const { sendEmail } = await import('./email.service')
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      const gaveUpItems = failedStatements.slice(0, gaveUp)
      await sendEmail({
        to: adminEmail,
        subject: `【通知發送】${gaveUp} 筆通知連續失敗，需人工處理`,
        html: `
          <h3>以下客戶的月結明細連續發送失敗，請人工處理：</h3>
          <ul>
            ${gaveUpItems.map(s => `<li>${s.customer.customerName} (${s.customerId}) - ${s.yearMonth}</li>`).join('')}
          </ul>
          <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/notifications">前往通知管理</a></p>
        `,
      })
    }
  }

  await logScheduleEvent('通知重試', 'success', `重試 ${retried} 筆成功，${gaveUp} 筆放棄`)
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- scheduler-retry`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/scheduler.service.ts backend/tests/scheduler-retry.test.ts
git commit -m "feat: 實作通知重試排程 (每日自動重試 + 連續2次失敗通知管理員)"
```

---

### Task 7: 排程管理 API

**Files:**
- Create: `backend/src/routes/schedule.ts`
- Modify: `backend/src/app.ts`

**Step 1: 實作排程管理路由**

```typescript
// backend/src/routes/schedule.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { scanExpiringContracts, checkDataIntegrity, getFailedNotifications } from '../services/scheduler.service'

const router = Router()

// GET /api/schedule/status - 查詢排程狀態
router.get('/status', authenticate, authorize('system_admin'), async (_req: Request, res: Response) => {
  try {
    // 從 system_logs 取得最近排程執行記錄
    const recentLogs = await prisma.systemLog.findMany({
      where: { eventType: 'schedule' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    res.json({
      schedulerEnabled: process.env.ENABLE_SCHEDULER === 'true',
      schedules: {
        fileWatch: process.env.SCHEDULE_FILE_WATCH || '0 * * * *',
        dataIntegrity: process.env.SCHEDULE_DATA_INTEGRITY || '0 23 * * *',
        contractScan: process.env.SCHEDULE_CONTRACT_SCAN || '0 10 * * *',
        monthlyBilling: process.env.SCHEDULE_MONTHLY_BILLING || '0 9 30 * *',
        invoice: process.env.SCHEDULE_INVOICE || '0 9 15 * *',
        retryNotification: process.env.SCHEDULE_RETRY_NOTIFICATION || '0 9 * * *',
      },
      recentLogs,
    })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// GET /api/schedule/contracts - 查詢即將到期合約
router.get('/contracts', authenticate, async (_req: Request, res: Response) => {
  try {
    const result = await scanExpiringContracts()
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/schedule/run/:taskName - 手動觸發排程任務
router.post('/run/:taskName', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { taskName } = req.params

    switch (taskName) {
      case 'data-integrity': {
        const yearMonth = (req.body.yearMonth as string) || new Date().toISOString().slice(0, 7)
        const report = await checkDataIntegrity(yearMonth)
        return res.json(report)
      }
      case 'contract-scan': {
        const result = await scanExpiringContracts()
        return res.json(result)
      }
      default:
        return res.status(400).json({ message: `未知的排程任務: ${taskName}` })
    }
  } catch (error: any) {
    res.status(500).json({ message: '執行失敗', error: error.message })
  }
})

// GET /api/schedule/logs - 查詢排程執行日誌
router.get('/logs', authenticate, async (req: Request, res: Response) => {
  try {
    const { eventType = 'schedule', page = '1', pageSize = '50' } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)

    const [data, total] = await Promise.all([
      prisma.systemLog.findMany({
        where: { eventType: String(eventType) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(pageSize),
      }),
      prisma.systemLog.count({ where: { eventType: String(eventType) } }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

export default router
```

**Step 2: 掛載路由**

在 `backend/src/app.ts` 加入：

```typescript
import scheduleRouter from './routes/schedule'
app.use('/api/schedule', scheduleRouter)
```

**Step 3: 執行所有測試、Commit**

Run: `cd backend && npm test`

```bash
git add backend/src/routes/schedule.ts backend/src/app.ts
git commit -m "feat: 實作排程管理 API (狀態查詢 + 手動觸發 + 日誌查詢)"
```

---

### Task 8: 更新前端儀表板 - 合約到期區塊與排程狀態

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Step 1: 在儀表板加入合約到期警示**

在 `DashboardPage.tsx` 加入合約到期表格和排程狀態，呼叫 `GET /api/schedule/contracts` 和 `GET /api/dashboard/stats`：

```typescript
// 在現有的 DashboardPage 中加入合約到期 useQuery
const { data: contractData } = useQuery({
  queryKey: ['expiring-contracts'],
  queryFn: () => api.get('/schedule/contracts').then(r => r.data),
  refetchInterval: 5 * 60 * 1000, // 每 5 分鐘刷新
})

// 合約到期表格欄位
const contractColumns = [
  { title: '客戶', dataIndex: 'customerName', key: 'customer' },
  { title: '站點', dataIndex: 'siteName', key: 'site' },
  { title: '品項', dataIndex: 'itemName', key: 'item' },
  { title: '到期日', dataIndex: 'endDate', key: 'endDate',
    render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
  { title: '剩餘天數', dataIndex: 'daysLeft', key: 'daysLeft',
    render: (d: number) => {
      const color = d <= 7 ? 'red' : d <= 15 ? 'orange' : 'green'
      return <Tag color={color}>{d} 天</Tag>
    }},
]

// 在 JSX 中加入：
// <Card title="即將到期合約" extra={<Badge count={contractData?.expiring || 0} />}>
//   <Table columns={contractColumns} dataSource={contractData?.details || []}
//     rowKey="contractPriceId" size="small" pagination={false} />
// </Card>
```

**Step 2: 執行前端 build 驗證**

Run: `cd frontend && npm run build`
Expected: 編譯成功

**Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: 儀表板加入合約到期警示表格 (顏色標示 + 自動刷新)"
```

---

## 環境變數完整清單（新增）

```bash
# 排程設定
ENABLE_SCHEDULER=true
SCHEDULE_FILE_WATCH=0 * * * *        # 每小時
SCHEDULE_DATA_INTEGRITY=0 23 * * *   # 每日 23:00
SCHEDULE_CONTRACT_SCAN=0 10 * * *    # 每日 10:00
SCHEDULE_MONTHLY_BILLING=0 9 30 * *  # 30 號 09:00
SCHEDULE_INVOICE=0 9 15 * *          # 15 號 09:00
SCHEDULE_RETRY_NOTIFICATION=0 9 * * * # 每日 09:00

# 管理員通知
ADMIN_EMAIL=admin@example.com
FINANCE_EMAIL=finance@example.com
```

---

## 階段四完成標準

- [ ] node-cron 排程服務骨架（6 個任務）
- [ ] 檔案監控排程（掃描 + 自動匯入 + 2 天無更新警示）
- [ ] 資料完整性檢查（孤兒車趟/品項 + 不存在客戶）
- [ ] 合約到期掃描（30/15/7 天提醒 + 到期自動切換牌價）
- [ ] 月結自動流程（產生明細 → PDF → 管理員預覽）
- [ ] 發票自動流程（產生 Excel → 發送財務人員）
- [ ] 例假日自動調整（週六/日提前到最近工作日）
- [ ] 通知重試排程（每日自動重試 + 連續失敗通知管理員）
- [ ] 排程管理 API（狀態/手動觸發/日誌）
- [ ] 儀表板合約到期警示
- [ ] 所有測試通過

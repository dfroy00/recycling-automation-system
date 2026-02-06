import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
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

// ===== 檔案監控 (Task 2) =====

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

async function handleFileWatch() {
  const tripDir = process.env.TRIP_WATCH_DIR || './data/trips'
  const itemDir = process.env.ITEM_WATCH_DIR || './data/items'
  const defaultSiteId = process.env.DEFAULT_SITE_ID || 'S001'

  // 掃描車趟目錄
  const tripFiles = await checkForNewFiles(tripDir)
  for (const filePath of tripFiles) {
    try {
      const { importTrips } = await import('./import.service')
      await importTrips(filePath, defaultSiteId)
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
      const { importItems } = await import('./import.service')
      await importItems(filePath, defaultSiteId)
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

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

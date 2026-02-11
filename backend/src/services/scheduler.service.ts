// backend/src/services/scheduler.service.ts
import cron from 'node-cron'
import prisma from '../lib/prisma'
import { generateMonthlyStatements } from './statement.service'
import { getWorkday } from './holiday.service'
import { sendStatementEmail, sendContractExpiryReminder, sendFailureReport } from './notification.service'

interface ScheduleJob {
  name: string
  schedule: string
  description: string
  lastRun: Date | null
  lastResult: string | null
  enabled: boolean
  task: ReturnType<typeof cron.schedule> | null
  handler: () => Promise<void>
}

const jobs: Map<string, ScheduleJob> = new Map()

// 初始化所有排程
export function initScheduler() {
  // 每月 5 號 09:00 → 月結明細產出（先算工作日）
  registerJob('monthly-statement', '0 9 5 * *', '每月 5 號產出月結明細', async () => {
    const now = new Date()
    const targetDate = new Date(now.getFullYear(), now.getMonth(), 5)
    const workday = await getWorkday(targetDate)

    // 只在工作日執行
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    workday.setHours(0, 0, 0, 0)
    if (today.getTime() !== workday.getTime()) {
      await logEvent('monthly_statement_skip', `今日非工作日，跳過月結產出（目標工作日：${workday.toISOString().split('T')[0]}）`)
      return
    }

    // 計算上個月
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const yearMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

    const result = await generateMonthlyStatements(yearMonth)
    await logEvent('monthly_statement_generate', `月結產出完成：新增 ${result.created}，跳過 ${result.skipped}，失敗 ${result.errors.length}`)

    if (result.errors.length > 0) {
      await sendFailureReport(result.errors.map(e => ({
        type: 'statement_generate',
        message: `${e.customerName}(ID:${e.customerId}): ${e.error}`,
      })))
    }
  })

  // 每日 09:00 → 檢查寄送日 + 自動寄送
  registerJob('daily-send', '0 9 * * *', '每日檢查明細寄送', async () => {
    const today = new Date()
    const day = today.getDate()

    // 找出今天是寄送日的客戶已審核/已開票明細
    const customers = await prisma.customer.findMany({
      where: { statementSendDay: day, status: 'active' },
    })

    let sent = 0
    let failed = 0
    const failures: { type: string; message: string }[] = []

    for (const customer of customers) {
      const statements = await prisma.statement.findMany({
        where: {
          customerId: customer.id,
          status: { in: customer.invoiceRequired ? ['invoiced'] : ['approved', 'invoiced'] },
        },
      })

      for (const stmt of statements) {
        try {
          if (customer.notificationMethod === 'email' && customer.notificationEmail) {
            await sendStatementEmail(stmt.id)
            sent++
          }
          // LINE 通知暫不實作
        } catch (e: any) {
          failed++
          // 更新重試計數
          await prisma.statement.update({
            where: { id: stmt.id },
            data: { sendRetryCount: { increment: 1 } },
          })
          failures.push({
            type: 'statement_send',
            message: `明細 #${stmt.id}（${customer.name}）：${e.message}`,
          })
        }
      }
    }

    await logEvent('daily_send', `寄送完成：成功 ${sent}，失敗 ${failed}`)
    if (failures.length > 0) {
      await sendFailureReport(failures)
    }
  })

  // 每日 09:00 → 通知重試（寄送失敗 < 3 次的重試）
  registerJob('send-retry', '5 9 * * *', '寄送失敗重試', async () => {
    const retryStatements = await prisma.statement.findMany({
      where: {
        status: { in: ['approved', 'invoiced'] },
        sendRetryCount: { gt: 0, lt: 3 },
      },
      include: { customer: true },
    })

    let retried = 0
    for (const stmt of retryStatements) {
      try {
        if (stmt.customer.notificationMethod === 'email' && stmt.customer.notificationEmail) {
          await sendStatementEmail(stmt.id)
          retried++
        }
      } catch (e: any) {
        await prisma.statement.update({
          where: { id: stmt.id },
          data: { sendRetryCount: { increment: 1 } },
        })
      }
    }

    await logEvent('send_retry', `重試完成：成功 ${retried}/${retryStatements.length}`)
  })

  // 每日 10:00 → 合約到期掃描
  registerJob('contract-expiry', '0 10 * * *', '合約到期掃描', async () => {
    const today = new Date()
    const thirtyDaysLater = new Date(today)
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

    const expiringContracts = await prisma.contract.findMany({
      where: {
        status: 'active',
        endDate: { lte: thirtyDaysLater, gte: today },
      },
      include: { customer: true },
    })

    for (const contract of expiringContracts) {
      const daysLeft = Math.ceil((contract.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      // 只在 30、14、7、3、1 天時提醒
      if ([30, 14, 7, 3, 1].includes(daysLeft)) {
        try {
          await sendContractExpiryReminder(contract.id, daysLeft)
        } catch (e: any) {
          await logEvent('contract_expiry_error', `合約 #${contract.id} 到期提醒失敗：${e.message}`)
        }
      }
    }

    await logEvent('contract_expiry_scan', `掃描完成：${expiringContracts.length} 份合約即將到期`)
  })
}

function registerJob(name: string, schedule: string, description: string, handler: () => Promise<void>) {
  const task = cron.schedule(schedule, async () => {
    const job = jobs.get(name)
    if (!job || !job.enabled) return

    try {
      await handler()
      if (job) {
        job.lastRun = new Date()
        job.lastResult = 'success'
      }
    } catch (e: any) {
      if (job) {
        job.lastRun = new Date()
        job.lastResult = `error: ${e.message}`
      }
      await logEvent(`scheduler_error`, `排程 ${name} 執行失敗：${e.message}`)
    }
  })

  jobs.set(name, {
    name,
    schedule,
    description,
    lastRun: null,
    lastResult: null,
    enabled: true,
    task,
    handler,
  })
}

// 取得排程狀態
export function getScheduleStatus() {
  const result: any[] = []
  for (const job of jobs.values()) {
    result.push({
      name: job.name,
      schedule: job.schedule,
      description: job.description,
      lastRun: job.lastRun,
      lastResult: job.lastResult,
      enabled: job.enabled,
    })
  }
  return result
}

// 手動觸發排程
export async function triggerJob(name: string): Promise<string> {
  const job = jobs.get(name)
  if (!job) throw new Error(`排程 ${name} 不存在`)

  try {
    await job.handler()
    job.lastRun = new Date()
    job.lastResult = 'success (manual)'
    return `排程 ${name} 已觸發並完成`
  } catch (e: any) {
    job.lastRun = new Date()
    job.lastResult = `error: ${e.message}`
    throw e
  }
}

async function logEvent(eventType: string, eventContent: string) {
  await prisma.systemLog.create({
    data: { eventType, eventContent },
  })
}

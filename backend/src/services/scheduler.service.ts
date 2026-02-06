import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'
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

// ===== 資料完整性檢查 (Task 3) =====

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

// ===== 合約到期掃描 (Task 4) =====

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

// ===== 月結與發票自動流程 + 例假日調整 (Task 5) =====

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

async function handleMonthlyBilling() {
  // 檢查今天是否為月結執行日（30 號或調整後的工作日）
  if (!isScheduledDay(30)) {
    await logScheduleEvent('月結流程', 'success', '今日非月結執行日，跳過')
    return
  }

  const yearMonth = dayjs().format('YYYY-MM')

  // Step 1: 產生月結明細
  const { generateAllStatements } = await import('./monthly-statement.service')
  const stmtResults = await generateAllStatements(yearMonth)
  await logScheduleEvent('月結流程', 'success', `已產生 ${stmtResults.length} 筆月結明細`)

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

async function handleNotificationRetry() {
  // Task 6 實作
}

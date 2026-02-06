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
        res.json(report)
        return
      }
      case 'contract-scan': {
        const result = await scanExpiringContracts()
        res.json(result)
        return
      }
      default:
        res.status(400).json({ message: `未知的排程任務: ${taskName}` })
        return
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

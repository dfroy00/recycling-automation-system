// backend/src/routes/schedule.ts
import { Router, Request, Response } from 'express'
import { getScheduleStatus, triggerJob } from '../services/scheduler.service'

const router = Router()

// GET /api/schedule — 排程狀態
router.get('/', async (_req: Request, res: Response) => {
  const status = getScheduleStatus()
  res.json(status)
})

// POST /api/schedule/:name/trigger — 手動觸發
router.post('/:name/trigger', async (req: Request, res: Response) => {
  try {
    const message = await triggerJob(req.params.name as string)
    res.json({ message })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router

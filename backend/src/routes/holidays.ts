// backend/src/routes/holidays.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authorize } from '../middleware/authorize'

const router = Router()

// GET /api/holidays — 列表（可依年份篩選）
router.get('/', async (req: Request, res: Response) => {
  const { year } = req.query
  const where: any = {}
  if (year) where.year = Number(year)

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: { date: 'asc' },
  })
  res.json(holidays)
})

// POST /api/holidays — 新增單筆 — 僅 super_admin
router.post('/', authorize('super_admin'), async (req: Request, res: Response) => {
  const { date, name, year } = req.body
  if (!date || !name || !year) {
    res.status(400).json({ error: '日期、名稱和年份為必填' })
    return
  }

  try {
    const holiday = await prisma.holiday.create({
      data: { date: new Date(date), name, year },
    })
    res.status(201).json(holiday)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '該日期已存在假日紀錄' })
      return
    }
    throw e
  }
})

// POST /api/holidays/import — 批次匯入 — 僅 super_admin
router.post('/import', authorize('super_admin'), async (req: Request, res: Response) => {
  const { holidays } = req.body
  if (!Array.isArray(holidays) || holidays.length === 0) {
    res.status(400).json({ error: '請提供假日陣列' })
    return
  }

  let created = 0
  let skipped = 0

  for (const h of holidays) {
    if (!h.date || !h.name || !h.year) {
      skipped++
      continue
    }
    try {
      await prisma.holiday.upsert({
        where: { date: new Date(h.date) },
        update: { name: h.name, year: h.year },
        create: { date: new Date(h.date), name: h.name, year: h.year },
      })
      created++
    } catch {
      skipped++
    }
  }

  res.json({ message: `匯入完成：${created} 筆成功，${skipped} 筆跳過` })
})

// DELETE /api/holidays/:id — 刪除 — 僅 super_admin
router.delete('/:id', authorize('super_admin'), async (req: Request, res: Response) => {
  try {
    await prisma.holiday.delete({ where: { id: Number(req.params.id) } })
    res.json({ message: '已刪除' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '假日不存在' })
      return
    }
    throw e
  }
})

export default router

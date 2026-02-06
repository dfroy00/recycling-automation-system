// 使用者管理 API
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { hashPassword } from '../services/auth.service'

const router = Router()

// GET /api/users - 查詢使用者清單
router.get('/', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { role, status, page = '1', pageSize = '20' } = req.query
    const where: any = {}
    if (role) where.role = role
    if (status) where.status = status

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          userId: true, username: true, name: true, role: true,
          siteId: true, email: true, status: true, createdAt: true,
          site: { select: { siteName: true } },
        },
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/users - 新增使用者
router.post('/', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { username, password, name, role, siteId, email } = req.body
    if (!username || !password || !name || !role) {
      res.status(400).json({ message: '缺少必填欄位' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      res.status(409).json({ message: `帳號 ${username} 已存在` })
      return
    }

    const user = await prisma.user.create({
      data: {
        username,
        password: await hashPassword(password),
        name,
        role,
        siteId: siteId || null,
        email: email || null,
      },
      select: {
        userId: true, username: true, name: true, role: true,
        siteId: true, email: true, status: true, createdAt: true,
      },
    })

    res.status(201).json(user)
  } catch (error: any) {
    res.status(500).json({ message: '新增失敗', error: error.message })
  }
})

// PUT /api/users/:id - 更新使用者
router.put('/:id', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { name, role, siteId, email, status, password } = req.body
    const data: any = {}

    if (name !== undefined) data.name = name
    if (role !== undefined) data.role = role
    if (siteId !== undefined) data.siteId = siteId || null
    if (email !== undefined) data.email = email || null
    if (status !== undefined) data.status = status
    if (password) data.password = await hashPassword(password)

    const user = await prisma.user.update({
      where: { userId: Number(req.params.id) },
      data,
      select: {
        userId: true, username: true, name: true, role: true,
        siteId: true, email: true, status: true, createdAt: true,
      },
    })

    res.json(user)
  } catch (error: any) {
    res.status(500).json({ message: '更新失敗', error: error.message })
  }
})

export default router

// backend/src/routes/users.ts
import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { validatePassword } from '../middleware/validate-password'

const router = Router()

// 排除 passwordHash 的 select
const userSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}

// GET /api/users — 列表
router.get('/', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { id: 'asc' },
  })
  res.json(users)
})

// GET /api/users/:id — 詳情
router.get('/:id', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: userSelect,
  })
  if (!user) {
    res.status(404).json({ error: '使用者不存在' })
    return
  }
  res.json(user)
})

// POST /api/users — 新增
router.post('/', async (req: Request, res: Response) => {
  const { username, password, name, email, role } = req.body
  if (!username || !password || !name) {
    res.status(400).json({ error: '帳號、密碼和姓名為必填' })
    return
  }

  // 密碼策略驗證
  const pwCheck = validatePassword(password)
  if (!pwCheck.valid) {
    res.status(400).json({ error: pwCheck.message })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username, passwordHash, name, email, role },
      select: userSelect,
    })
    res.status(201).json(user)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '帳號已存在' })
      return
    }
    throw e
  }
})

// PATCH /api/users/:id — 更新
router.patch('/:id', async (req: Request, res: Response) => {
  const { name, email, role, status, password } = req.body
  const data: any = {}
  if (name) data.name = name
  if (email !== undefined) data.email = email
  if (role) data.role = role
  if (status) data.status = status
  if (password) {
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      res.status(400).json({ error: pwCheck.message })
      return
    }
    data.passwordHash = await bcrypt.hash(password, 10)
  }

  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data,
      select: userSelect,
    })
    res.json(user)
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '使用者不存在' })
      return
    }
    throw e
  }
})

// DELETE /api/users/:id — 刪除（軟刪除）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { status: 'inactive' },
    })
    res.json({ message: '已停用' })
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: '使用者不存在' })
      return
    }
    throw e
  }
})

export default router

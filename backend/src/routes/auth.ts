// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /api/auth/login — 登入
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ error: '請輸入帳號和密碼' })
    return
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || user.status !== 'active') {
    res.status(401).json({ error: '帳號或密碼錯誤' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: '帳號或密碼錯誤' })
    return
  }

  const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn']
  const token = jwt.sign(
    { userId: user.id, userName: user.name },
    process.env.JWT_SECRET!,
    { expiresIn }
  )

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  })
})

// GET /api/auth/me — 取得當前使用者
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, name: true, email: true, role: true },
  })
  if (!user) {
    res.status(404).json({ error: '使用者不存在' })
    return
  }
  res.json(user)
})

export default router

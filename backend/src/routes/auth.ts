import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { hashPassword, comparePassword, generateToken } from '../services/auth.service'

const router = Router()

// POST /api/auth/register - 註冊
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, name, role, siteId, email } = req.body

    // 驗證必填欄位
    if (!username || !password || !name || !role) {
      res.status(400).json({ message: '缺少必填欄位：username, password, name, role' })
      return
    }

    // 檢查 username 是否已存在
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      res.status(409).json({ message: `使用者 ${username} 已存在` })
      return
    }

    // 建立使用者
    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role,
        siteId: siteId || null,
        email: email || null,
      },
    })

    // 回傳（排除密碼）
    const { password: _, ...userWithoutPassword } = user
    res.status(201).json({ user: userWithoutPassword })
  } catch (error) {
    console.error('註冊失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// POST /api/auth/login - 登入
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ message: '缺少 username 或 password' })
      return
    }

    // 查詢使用者
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      res.status(401).json({ message: `帳號 ${username} 不存在` })
      return
    }

    // 檢查帳號狀態
    if (user.status !== '啟用') {
      res.status(403).json({ message: '帳號已停用' })
      return
    }

    // 驗證密碼
    const isValid = await comparePassword(password, user.password)
    if (!isValid) {
      res.status(401).json({ message: '密碼錯誤' })
      return
    }

    // 產生 Token
    const token = generateToken({
      userId: user.userId,
      username: user.username,
      role: user.role,
      siteId: user.siteId,
    })

    // 回傳（排除密碼）
    const { password: _, ...userWithoutPassword } = user
    res.json({ token, user: userWithoutPassword })
  } catch (error) {
    console.error('登入失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router

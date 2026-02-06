import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { prisma } from './lib/prisma'
import authRouter from './routes/auth'

const app = express()

// 中介層
app.use(helmet())
app.use(cors())
app.use(express.json())

// 健康檢查（含資料庫連線狀態）
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() })
  }
})

// 路由
app.use('/api/auth', authRouter)

export default app

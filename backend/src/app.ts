import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { prisma } from './lib/prisma'
import authRouter from './routes/auth'
import sitesRouter from './routes/sites'
import customersRouter from './routes/customers'
import contractsRouter from './routes/contracts'
import importRouter from './routes/import'
import itemPricesRouter from './routes/item-prices'
import reportsRouter from './routes/reports'
import dashboardRouter from './routes/dashboard'
import dataRouter from './routes/data'
import notificationsRouter from './routes/notifications'
import scheduleRouter from './routes/schedule'
import usersRouter from './routes/users'

const app = express()

// 中介層
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
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
app.use('/api/sites', sitesRouter)
app.use('/api/customers', customersRouter)
app.use('/api', contractsRouter)
app.use('/api/import', importRouter)
app.use('/api/item-prices', itemPricesRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/data', dataRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/schedule', scheduleRouter)
app.use('/api/users', usersRouter)

// 404 處理
app.use((_req, res) => {
  res.status(404).json({ message: '找不到該端點' })
})

// 全域錯誤處理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('未處理的錯誤:', err)
  res.status(500).json({ message: '伺服器內部錯誤' })
})

export default app

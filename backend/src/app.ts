// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { authMiddleware } from './middleware/auth'
import { globalErrorHandler } from './middleware/error-handler'
import { apiLimiter, loginLimiter, reportLimiter } from './middleware/rate-limit'
import authRoutes from './routes/auth'
import siteRoutes from './routes/sites'
import itemRoutes from './routes/items'
import userRoutes from './routes/users'
import holidayRoutes from './routes/holidays'
import dashboardRoutes from './routes/dashboard'
import customerRoutes from './routes/customers'
import contractRoutes from './routes/contracts'
import tripRoutes from './routes/trips'
import statementRoutes from './routes/statements'
import reportRoutes from './routes/reports'
import scheduleRoutes from './routes/schedule'
import syncRoutes from './routes/sync'
import businessEntityRoutes from './routes/business-entities'

dotenv.config()

const app = express()

// 安全性標頭
app.use(helmet())

// CORS
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))

// Body parser
app.use(express.json())

// 健康檢查（不需認證）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 認證路由（不需 JWT，但有登入速率限制）
app.use('/api/auth/login', loginLimiter)
app.use('/api/auth', authRoutes)

// 以下路由需要 JWT 認證 + API 速率限制
app.use('/api', apiLimiter)
app.use('/api/sites', authMiddleware as any, siteRoutes)
app.use('/api/items', authMiddleware as any, itemRoutes)
app.use('/api/users', authMiddleware as any, userRoutes)
app.use('/api/holidays', authMiddleware as any, holidayRoutes)
app.use('/api/dashboard', authMiddleware as any, dashboardRoutes)
app.use('/api/customers', authMiddleware as any, customerRoutes)
app.use('/api/contracts', authMiddleware as any, contractRoutes)
app.use('/api/trips', authMiddleware as any, tripRoutes)
app.use('/api/statements', authMiddleware as any, statementRoutes)
app.use('/api/reports', authMiddleware as any, reportLimiter, reportRoutes)
app.use('/api/schedule', authMiddleware as any, scheduleRoutes)
app.use('/api/sync', authMiddleware as any, syncRoutes)
app.use('/api/business-entities', authMiddleware as any, businessEntityRoutes)

// 全域錯誤處理（必須放在所有路由之後）
app.use(globalErrorHandler)

export default app

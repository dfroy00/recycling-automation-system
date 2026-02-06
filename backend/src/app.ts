import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

const app = express()

// 中介層
app.use(helmet())
app.use(cors())
app.use(express.json())

// 健康檢查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app

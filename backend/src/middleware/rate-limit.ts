// backend/src/middleware/rate-limit.ts
// API 速率限制
import rateLimit from 'express-rate-limit'

// 登入端點：5 次/分鐘/IP
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '登入嘗試次數過多，請 1 分鐘後再試' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 一般 API：100 次/分鐘/IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: '請求次數過多，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 報表下載：10 次/分鐘/IP
export const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '報表下載次數過多，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false,
})

import { Request, Response, NextFunction } from 'express'
import { verifyToken, TokenPayload } from '../services/auth.service'

// 擴展 Express Request 型別
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

// JWT 驗證中介層
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: '未提供驗證 Token' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ message: '無效或過期的 Token' })
  }
}

// 角色授權中介層
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: '未驗證身份' })
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        message: `權限不足，需要角色：${allowedRoles.join(' 或 ')}`,
      })
      return
    }

    next()
  }
}

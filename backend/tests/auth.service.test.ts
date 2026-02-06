import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword, generateToken, verifyToken } from '../src/services/auth.service'

describe('Auth Service', () => {
  describe('密碼雜湊', () => {
    it('應成功雜湊密碼', async () => {
      const hash = await hashPassword('test123')
      expect(hash).toBeDefined()
      expect(hash).not.toBe('test123')
    })

    it('應正確比對密碼', async () => {
      const hash = await hashPassword('test123')
      const match = await comparePassword('test123', hash)
      expect(match).toBe(true)
    })

    it('應拒絕錯誤密碼', async () => {
      const hash = await hashPassword('test123')
      const match = await comparePassword('wrong', hash)
      expect(match).toBe(false)
    })
  })

  describe('JWT Token', () => {
    it('應產生有效 Token', () => {
      const token = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('應正確解析 Token', () => {
      const payload = { userId: 1, username: 'admin', role: 'system_admin' }
      const token = generateToken(payload)
      const decoded = verifyToken(token)

      expect(decoded.userId).toBe(1)
      expect(decoded.username).toBe('admin')
      expect(decoded.role).toBe('system_admin')
    })

    it('應拒絕無效 Token', () => {
      expect(() => verifyToken('invalid-token')).toThrow()
    })
  })
})

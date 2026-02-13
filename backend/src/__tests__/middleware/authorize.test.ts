// backend/src/__tests__/middleware/authorize.test.ts
import { Request, Response, NextFunction } from 'express'
import { authorize } from '../../middleware/authorize'

// 模擬 request
const mockReq = (role?: string, userId?: number) => ({
  userId: userId ?? 1,
  userRole: role,
  userSiteId: role === 'super_admin' ? null : 1,
} as unknown as Request)

// 模擬 response
const mockRes = () => {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('authorize 中介層', () => {
  it('允許在角色清單中的使用者通過', () => {
    const req = mockReq('super_admin')
    const res = mockRes()
    const next = jest.fn()

    authorize('super_admin', 'site_manager')(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('允許 site_manager 通過包含 site_manager 的清單', () => {
    const req = mockReq('site_manager')
    const res = mockRes()
    const next = jest.fn()

    authorize('super_admin', 'site_manager')(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('拒絕不在角色清單中的使用者，回傳 403', () => {
    const req = mockReq('site_staff')
    const res = mockRes()
    const next = jest.fn()

    authorize('super_admin', 'site_manager')(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: '權限不足' })
  })

  it('未登入時回傳 401', () => {
    const req = {} as Request
    const res = mockRes()
    const next = jest.fn()

    authorize('super_admin')(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: '未登入' })
  })

  it('userRole 為 undefined 時回傳 403', () => {
    const req = mockReq(undefined, 1)
    const res = mockRes()
    const next = jest.fn()

    authorize('super_admin')(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('允許單一角色通過', () => {
    const req = mockReq('super_admin')
    const res = mockRes()
    const next = jest.fn()

    authorize('super_admin')(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})

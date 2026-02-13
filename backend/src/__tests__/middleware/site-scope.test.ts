// backend/src/__tests__/middleware/site-scope.test.ts
import { Request, Response, NextFunction } from 'express'
import { siteScope } from '../../middleware/site-scope'

// 模擬 request
const mockReq = (role: string, siteId: number | null) => ({
  userId: 1,
  userRole: role,
  userSiteId: siteId,
  query: {},
} as unknown as Request)

// 模擬 response
const mockRes = () => {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('siteScope 中介層', () => {
  it('super_admin 不注入 scopedSiteId', () => {
    const req = mockReq('super_admin', null)
    const res = mockRes()
    const next = jest.fn()

    siteScope()(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).scopedSiteId).toBeUndefined()
  })

  it('site_manager 注入自己的 siteId', () => {
    const req = mockReq('site_manager', 2)
    const res = mockRes()
    const next = jest.fn()

    siteScope()(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).scopedSiteId).toBe(2)
  })

  it('site_staff 注入自己的 siteId', () => {
    const req = mockReq('site_staff', 3)
    const res = mockRes()
    const next = jest.fn()

    siteScope()(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).scopedSiteId).toBe(3)
  })

  it('非 super_admin 若無 siteId 則回傳 403', () => {
    const req = mockReq('site_manager', null)
    const res = mockRes()
    const next = jest.fn()

    siteScope()(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: '使用者未綁定站區' })
  })

  it('site_staff 若無 siteId 則回傳 403', () => {
    const req = mockReq('site_staff', null)
    const res = mockRes()
    const next = jest.fn()

    siteScope()(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('super_admin 可帶 siteId 但不注入 scopedSiteId', () => {
    const req = mockReq('super_admin', 5)
    const res = mockRes()
    const next = jest.fn()

    siteScope()(req, res, next)

    expect(next).toHaveBeenCalled()
    // super_admin 即使有 siteId 也不注入 scopedSiteId
    expect((req as any).scopedSiteId).toBeUndefined()
  })
})

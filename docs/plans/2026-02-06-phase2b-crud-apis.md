# 階段二B：管理介面 CRUD API 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作客戶管理、合約管理、品項單價管理、資料查詢與修正等後端 CRUD API

**Architecture:** RESTful API 設計，支援分頁、篩選、排序。站點管理員只能存取所屬站點資料（Row-Level Security 透過中介層實現）。

**Tech Stack:** Express.js, Prisma, Vitest, Supertest

**前置條件:** 階段一 + 階段二A 已完成

---

### Task 1: 客戶管理 CRUD API

**Files:**
- Create: `backend/tests/customers.routes.test.ts`
- Create: `backend/src/routes/customers.ts`
- Modify: `backend/src/app.ts`

**Step 1: 撰寫客戶 API 失敗測試**

```typescript
// backend/tests/customers.routes.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'
import { generateToken } from '../src/services/auth.service'

describe('Customers Routes', () => {
  let adminToken: string
  let siteAdminToken: string

  beforeAll(async () => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
    siteAdminToken = generateToken({ userId: 2, username: 'site1', role: 'site_admin', siteId: 'S001' })

    // 清理測試客戶
    await prisma.customer.deleteMany({ where: { customerId: { startsWith: 'TEST_' } } })
  })

  describe('GET /api/customers', () => {
    it('系統管理員應看到所有客戶', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.total).toBeDefined()
    })

    it('站點管理員應只看到自己站點的客戶', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${siteAdminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.every((c: any) => c.siteId === 'S001')).toBe(true)
    })

    it('應支援計費類型篩選', async () => {
      const res = await request(app)
        .get('/api/customers?billingType=A')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.every((c: any) => c.billingType === 'A')).toBe(true)
    })
  })

  describe('POST /api/customers', () => {
    it('應成功新增客戶', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'TEST_C099',
          siteId: 'S001',
          customerName: '測試客戶',
          billingType: 'A',
          tripPrice: 300,
          notificationMethod: 'Email',
          email: 'test@example.com',
        })

      expect(res.status).toBe(201)
      expect(res.body.customerId).toBe('TEST_C099')
    })
  })

  describe('PUT /api/customers/:id', () => {
    it('應成功更新客戶', async () => {
      const res = await request(app)
        .put('/api/customers/TEST_C099')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerName: '更新後的測試客戶' })

      expect(res.status).toBe(200)
      expect(res.body.customerName).toBe('更新後的測試客戶')
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- customers.routes`
Expected: FAIL

**Step 3: 實作客戶路由**

```typescript
// backend/src/routes/customers.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// 建立站點篩選條件（站點管理員只看自己站點）
function getSiteFilter(user: any) {
  if (user.role === 'site_admin' && user.siteId) {
    return { siteId: user.siteId }
  }
  return {}
}

// GET /api/customers - 取得客戶清單
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { siteId, billingType, status, search, page = '1', pageSize = '20' } = req.query
    const where: any = { ...getSiteFilter(req.user) }

    if (siteId) where.siteId = siteId
    if (billingType) where.billingType = billingType
    if (status) where.status = status
    if (search) {
      where.OR = [
        { customerId: { contains: String(search), mode: 'insensitive' } },
        { customerName: { contains: String(search), mode: 'insensitive' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { site: { select: { siteName: true } } },
        skip,
        take: Number(pageSize),
        orderBy: { customerId: 'asc' },
      }),
      prisma.customer.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// GET /api/customers/:id - 取得單一客戶
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { customerId: req.params.id },
      include: {
        site: { select: { siteName: true } },
        contractPrices: true,
      },
    })
    if (!customer) {
      return res.status(404).json({ message: '客戶不存在' })
    }
    res.json(customer)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/customers - 新增客戶
router.post('/', authenticate, authorize('system_admin', 'site_admin'), async (req: Request, res: Response) => {
  try {
    const { customerId, siteId, customerName, billingType, tripPrice, notificationMethod, lineId, email } = req.body

    if (!customerId || !siteId || !customerName || !billingType) {
      return res.status(400).json({ message: '缺少必填欄位' })
    }

    const customer = await prisma.customer.create({
      data: { customerId, siteId, customerName, billingType, tripPrice, notificationMethod, lineId, email },
    })
    res.status(201).json(customer)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: '客戶編號已存在' })
    }
    res.status(500).json({ message: '新增失敗', error: error.message })
  }
})

// PUT /api/customers/:id - 更新客戶
router.put('/:id', authenticate, authorize('system_admin', 'site_admin'), async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.update({
      where: { customerId: req.params.id },
      data: req.body,
    })
    res.json(customer)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: '客戶不存在' })
    }
    res.status(500).json({ message: '更新失敗', error: error.message })
  }
})

export default router
```

**Step 4: 在 app.ts 掛載路由**

```typescript
import customersRouter from './routes/customers'
app.use('/api/customers', customersRouter)
```

**Step 5: 執行測試驗證通過**

Run: `cd backend && npm test -- customers.routes`
Expected: 所有客戶 API 測試通過

**Step 6: Commit**

```bash
git add backend/src/routes/customers.ts backend/tests/customers.routes.test.ts backend/src/app.ts
git commit -m "feat: 實作客戶管理 CRUD API (含站點權限過濾)"
```

---

### Task 2: 合約管理 API

**Files:**
- Create: `backend/src/routes/contracts.ts`
- Create: `backend/tests/contracts.routes.test.ts`
- Modify: `backend/src/app.ts`

**Step 1: 撰寫合約 API 測試**

```typescript
// backend/tests/contracts.routes.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'
import { generateToken } from '../src/services/auth.service'

describe('Contracts Routes', () => {
  let adminToken: string

  beforeAll(async () => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
  })

  describe('GET /api/customers/:id/contracts', () => {
    it('應回傳 C 類客戶的合約', async () => {
      const res = await request(app)
        .get('/api/customers/C003/contracts')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body[0]).toHaveProperty('itemName')
      expect(res.body[0]).toHaveProperty('contractPrice')
    })
  })

  describe('POST /api/customers/:id/contracts', () => {
    it('應成功新增合約品項', async () => {
      const res = await request(app)
        .post('/api/customers/C003/contracts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemName: '鋁罐',
          contractPrice: 30.0,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        })

      expect(res.status).toBe(201)
      expect(res.body.itemName).toBe('鋁罐')
    })
  })

  describe('PUT /api/contracts/:id', () => {
    it('應成功更新合約價格', async () => {
      // 先取得剛才建立的合約 ID
      const contracts = await prisma.contractPrice.findMany({
        where: { customerId: 'C003', itemName: '鋁罐' },
      })
      const contractId = contracts[0].contractPriceId

      const res = await request(app)
        .put(`/api/contracts/${contractId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contractPrice: 32.0 })

      expect(res.status).toBe(200)
      expect(Number(res.body.contractPrice)).toBe(32)
    })
  })
})
```

**Step 2: 實作合約路由**

```typescript
// backend/src/routes/contracts.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/customers/:customerId/contracts - 取得客戶合約
router.get('/customers/:customerId/contracts', authenticate, async (req: Request, res: Response) => {
  try {
    const contracts = await prisma.contractPrice.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { endDate: 'desc' },
    })
    res.json(contracts)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/customers/:customerId/contracts - 新增合約品項
router.post(
  '/customers/:customerId/contracts',
  authenticate,
  authorize('system_admin', 'site_admin', 'sales'),
  async (req: Request, res: Response) => {
    try {
      const { itemName, contractPrice, startDate, endDate } = req.body
      if (!itemName || !contractPrice || !startDate || !endDate) {
        return res.status(400).json({ message: '缺少必填欄位' })
      }

      const contract = await prisma.contractPrice.create({
        data: {
          customerId: req.params.customerId,
          itemName,
          contractPrice,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      })
      res.status(201).json(contract)
    } catch (error: any) {
      res.status(500).json({ message: '新增失敗', error: error.message })
    }
  }
)

// PUT /api/contracts/:id - 更新合約
router.put(
  '/contracts/:id',
  authenticate,
  authorize('system_admin', 'site_admin', 'sales'),
  async (req: Request, res: Response) => {
    try {
      const contract = await prisma.contractPrice.update({
        where: { contractPriceId: Number(req.params.id) },
        data: req.body,
      })
      res.json(contract)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: '合約不存在' })
      }
      res.status(500).json({ message: '更新失敗', error: error.message })
    }
  }
)

// DELETE /api/contracts/:id - 刪除合約
router.delete(
  '/contracts/:id',
  authenticate,
  authorize('system_admin'),
  async (req: Request, res: Response) => {
    try {
      await prisma.contractPrice.delete({
        where: { contractPriceId: Number(req.params.id) },
      })
      res.json({ message: '已刪除' })
    } catch (error: any) {
      res.status(500).json({ message: '刪除失敗', error: error.message })
    }
  }
)

export default router
```

**Step 3: 在 app.ts 掛載（注意：合約路由有兩種 path pattern）**

```typescript
import contractsRouter from './routes/contracts'
app.use('/api', contractsRouter) // 因路由同時包含 /customers/:id/contracts 和 /contracts/:id
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- contracts.routes`
Expected: 通過

**Step 5: Commit**

```bash
git add backend/src/routes/contracts.ts backend/tests/contracts.routes.test.ts backend/src/app.ts
git commit -m "feat: 實作合約管理 API (CRUD + 客戶關聯)"
```

---

### Task 3: 品項單價管理 API

**Files:**
- Create: `backend/src/routes/item-prices.ts`
- Create: `backend/tests/item-prices.routes.test.ts`
- Modify: `backend/src/app.ts`

**Step 1: 撰寫品項單價 API 測試**

```typescript
// backend/tests/item-prices.routes.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { generateToken } from '../src/services/auth.service'

describe('Item Prices Routes', () => {
  let adminToken: string

  beforeAll(() => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
  })

  describe('GET /api/item-prices', () => {
    it('應回傳品項清單', async () => {
      const res = await request(app)
        .get('/api/item-prices')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data[0]).toHaveProperty('itemName')
      expect(res.body.data[0]).toHaveProperty('standardPrice')
    })
  })

  describe('POST /api/item-prices', () => {
    it('應成功新增品項', async () => {
      const res = await request(app)
        .post('/api/item-prices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemName: '測試品項',
          standardPrice: 99.9,
          effectiveDate: '2026-03-01',
        })

      expect(res.status).toBe(201)
      expect(res.body.itemName).toBe('測試品項')
    })
  })

  describe('PUT /api/item-prices/:id/adjust', () => {
    it('應成功調整單價（保留歷史）', async () => {
      const res = await request(app)
        .get('/api/item-prices?itemName=紙類')
        .set('Authorization', `Bearer ${adminToken}`)

      const priceId = res.body.data[0].itemPriceId

      const adjustRes = await request(app)
        .put(`/api/item-prices/${priceId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newPrice: 5.5,
          effectiveDate: '2026-04-01',
        })

      expect(adjustRes.status).toBe(200)
      expect(adjustRes.body.message).toContain('調整')
    })
  })
})
```

**Step 2: 實作品項單價路由**

```typescript
// backend/src/routes/item-prices.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/item-prices - 取得品項清單（目前有效的）
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { itemName, includeExpired, page = '1', pageSize = '50' } = req.query

    const where: any = {}
    if (itemName) where.itemName = { contains: String(itemName), mode: 'insensitive' }
    if (!includeExpired) where.expiryDate = null // 只顯示目前有效的

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.itemPrice.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: [{ itemName: 'asc' }, { effectiveDate: 'desc' }],
      }),
      prisma.itemPrice.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// GET /api/item-prices/history/:itemName - 品項價格歷史
router.get('/history/:itemName', authenticate, async (req: Request, res: Response) => {
  try {
    const history = await prisma.itemPrice.findMany({
      where: { itemName: req.params.itemName },
      orderBy: { effectiveDate: 'desc' },
    })
    res.json(history)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// POST /api/item-prices - 新增品項
router.post('/', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { itemName, standardPrice, effectiveDate } = req.body
    if (!itemName || standardPrice === undefined || !effectiveDate) {
      return res.status(400).json({ message: '缺少必填欄位' })
    }

    const item = await prisma.itemPrice.create({
      data: {
        itemName,
        standardPrice,
        effectiveDate: new Date(effectiveDate),
      },
    })
    res.status(201).json(item)
  } catch (error: any) {
    res.status(500).json({ message: '新增失敗', error: error.message })
  }
})

// PUT /api/item-prices/:id/adjust - 調整單價（舊價格設到期日，建新價格）
router.put('/:id/adjust', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { newPrice, effectiveDate } = req.body
    if (newPrice === undefined || !effectiveDate) {
      return res.status(400).json({ message: '缺少 newPrice 或 effectiveDate' })
    }

    const oldPrice = await prisma.itemPrice.findUnique({
      where: { itemPriceId: Number(req.params.id) },
    })
    if (!oldPrice) {
      return res.status(404).json({ message: '品項不存在' })
    }

    // 將舊價格設到期日
    const effectiveDateObj = new Date(effectiveDate)
    const expiryDate = new Date(effectiveDateObj)
    expiryDate.setDate(expiryDate.getDate() - 1)

    await prisma.$transaction([
      prisma.itemPrice.update({
        where: { itemPriceId: Number(req.params.id) },
        data: { expiryDate },
      }),
      prisma.itemPrice.create({
        data: {
          itemName: oldPrice.itemName,
          standardPrice: newPrice,
          effectiveDate: effectiveDateObj,
        },
      }),
    ])

    res.json({ message: `${oldPrice.itemName} 單價已調整為 ${newPrice}，生效日 ${effectiveDate}` })
  } catch (error: any) {
    res.status(500).json({ message: '調整失敗', error: error.message })
  }
})

export default router
```

**Step 3: 掛載路由、測試、Commit**

```typescript
// app.ts
import itemPricesRouter from './routes/item-prices'
app.use('/api/item-prices', itemPricesRouter)
```

Run: `cd backend && npm test -- item-prices.routes`
Expected: 通過

```bash
git add backend/src/routes/item-prices.ts backend/tests/item-prices.routes.test.ts backend/src/app.ts
git commit -m "feat: 實作品項單價管理 API (CRUD + 價格調整保留歷史)"
```

---

### Task 4: 資料查詢與修正 API

**Files:**
- Create: `backend/src/routes/data.ts`
- Create: `backend/tests/data.routes.test.ts`
- Modify: `backend/src/app.ts`

**Step 1: 實作資料查詢與修正路由**

```typescript
// backend/src/routes/data.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/data/trips - 查詢車趟記錄
router.get('/trips', authenticate, async (req: Request, res: Response) => {
  try {
    const { siteId, customerId, startDate, endDate, driver, page = '1', pageSize = '20' } = req.query
    const where: any = {}

    if (siteId) where.siteId = siteId
    if (customerId) where.customerId = customerId
    if (driver) where.driver = { contains: String(driver), mode: 'insensitive' }
    if (startDate || endDate) {
      where.tripDate = {}
      if (startDate) where.tripDate.gte = new Date(String(startDate))
      if (endDate) where.tripDate.lte = new Date(String(endDate))
    }

    // 站點管理員限制
    if (req.user?.role === 'site_admin' && req.user.siteId) {
      where.siteId = req.user.siteId
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: { customer: { select: { customerName: true } } },
        skip,
        take: Number(pageSize),
        orderBy: [{ tripDate: 'desc' }, { tripTime: 'desc' }],
      }),
      prisma.trip.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// GET /api/data/items - 查詢品項收取記錄
router.get('/items', authenticate, async (req: Request, res: Response) => {
  try {
    const { siteId, customerId, itemName, startDate, endDate, page = '1', pageSize = '20' } = req.query
    const where: any = {}

    if (siteId) where.siteId = siteId
    if (customerId) where.customerId = customerId
    if (itemName) where.itemName = { contains: String(itemName), mode: 'insensitive' }
    if (startDate || endDate) {
      where.collectionDate = {}
      if (startDate) where.collectionDate.gte = new Date(String(startDate))
      if (endDate) where.collectionDate.lte = new Date(String(endDate))
    }

    if (req.user?.role === 'site_admin' && req.user.siteId) {
      where.siteId = req.user.siteId
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total, stats] = await Promise.all([
      prisma.itemCollected.findMany({
        where,
        include: { customer: { select: { customerName: true } } },
        skip,
        take: Number(pageSize),
        orderBy: [{ collectionDate: 'desc' }],
      }),
      prisma.itemCollected.count({ where }),
      prisma.itemCollected.aggregate({
        where,
        _sum: { weightKg: true },
        _avg: { weightKg: true },
      }),
    ])

    res.json({
      data,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      stats: {
        totalWeight: stats._sum.weightKg || 0,
        avgWeight: stats._avg.weightKg || 0,
      },
    })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

// PUT /api/data/items/:id - 修正品項收取記錄
router.put(
  '/items/:id',
  authenticate,
  authorize('system_admin', 'site_admin'),
  async (req: Request, res: Response) => {
    try {
      const { itemName, weightKg, customerId } = req.body

      const updated = await prisma.itemCollected.update({
        where: { collectionId: Number(req.params.id) },
        data: {
          ...(itemName && { itemName }),
          ...(weightKg !== undefined && { weightKg }),
          ...(customerId && { customerId }),
        },
      })

      // 記錄修正日誌
      await prisma.systemLog.create({
        data: {
          siteId: updated.siteId,
          eventType: 'data_correction',
          eventContent: `品項記錄 ${req.params.id} 已修正 by ${req.user?.username}`,
        },
      })

      res.json(updated)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: '記錄不存在' })
      }
      res.status(500).json({ message: '修正失敗', error: error.message })
    }
  }
)

// PUT /api/data/trips/:id - 修正車趟記錄
router.put(
  '/trips/:id',
  authenticate,
  authorize('system_admin', 'site_admin'),
  async (req: Request, res: Response) => {
    try {
      const updated = await prisma.trip.update({
        where: { tripId: Number(req.params.id) },
        data: req.body,
      })

      await prisma.systemLog.create({
        data: {
          siteId: updated.siteId,
          eventType: 'data_correction',
          eventContent: `車趟記錄 ${req.params.id} 已修正 by ${req.user?.username}`,
        },
      })

      res.json(updated)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: '記錄不存在' })
      }
      res.status(500).json({ message: '修正失敗', error: error.message })
    }
  }
)

export default router
```

**Step 2: 撰寫測試**

```typescript
// backend/tests/data.routes.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { generateToken } from '../src/services/auth.service'

describe('Data Routes', () => {
  let adminToken: string

  beforeAll(() => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
  })

  describe('GET /api/data/trips', () => {
    it('應回傳車趟記錄', async () => {
      const res = await request(app)
        .get('/api/data/trips')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('total')
    })
  })

  describe('GET /api/data/items', () => {
    it('應回傳品項記錄與統計', async () => {
      const res = await request(app)
        .get('/api/data/items')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('stats')
      expect(res.body.stats).toHaveProperty('totalWeight')
    })
  })
})
```

**Step 3: 掛載路由、測試、Commit**

```typescript
import dataRouter from './routes/data'
app.use('/api/data', dataRouter)
```

Run: `cd backend && npm test -- data.routes`

```bash
git add backend/src/routes/data.ts backend/tests/data.routes.test.ts backend/src/app.ts
git commit -m "feat: 實作資料查詢與修正 API (車趟/品項查詢+修正+統計)"
```

---

### Task 5: 站點管理 API 補完

**Files:**
- Modify: `backend/src/routes/sites.ts`

**Step 1: 補完站點路由（PUT 更新）**

在 `backend/src/routes/sites.ts` 加入：

```typescript
// PUT /api/sites/:id - 更新站點
router.put('/:id', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const site = await prisma.site.update({
      where: { siteId: req.params.id },
      data: req.body,
    })
    res.json(site)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: '站點不存在' })
    }
    res.status(500).json({ message: '更新失敗', error: error.message })
  }
})

// GET /api/sites/:id - 取得單一站點
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const site = await prisma.site.findUnique({
      where: { siteId: req.params.id },
      include: { _count: { select: { customers: true } } },
    })
    if (!site) {
      return res.status(404).json({ message: '站點不存在' })
    }
    res.json(site)
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})
```

**Step 2: 執行全部測試、Commit**

Run: `cd backend && npm test`
Expected: 所有測試通過

```bash
git add backend/src/routes/sites.ts
git commit -m "feat: 補完站點管理 API (GET/:id + PUT)"
```

---

## 階段二B 完成標準

- [x] 客戶管理 CRUD API（含站點權限過濾、搜尋、分頁）
- [x] 合約管理 API（新增/更新/刪除合約品項）
- [x] 品項單價管理 API（CRUD + 價格調整保留歷史）
- [x] 資料查詢 API（車趟 + 品項，含篩選、分頁、統計）
- [x] 資料修正 API（修正記錄 + 日誌）
- [x] 站點管理 API 補完
- [x] 所有 API 皆有 JWT 驗證 + RBAC 授權
- [x] 所有測試通過

## API 端點總覽

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/sites
GET    /api/sites/:id
POST   /api/sites
PUT    /api/sites/:id

GET    /api/customers
GET    /api/customers/:id
POST   /api/customers
PUT    /api/customers/:id

GET    /api/customers/:id/contracts
POST   /api/customers/:id/contracts
PUT    /api/contracts/:id
DELETE /api/contracts/:id

GET    /api/item-prices
GET    /api/item-prices/history/:itemName
POST   /api/item-prices
PUT    /api/item-prices/:id/adjust

POST   /api/import/trips
POST   /api/import/items

GET    /api/data/trips
GET    /api/data/items
PUT    /api/data/trips/:id
PUT    /api/data/items/:id

POST   /api/reports/monthly/generate
GET    /api/reports/monthly

GET    /api/dashboard/stats
```

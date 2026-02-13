# 客戶詳情頁 + 權限系統 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立客戶詳情頁 Tab 架構（整合合約管理），並實作三層權限系統（super_admin / site_manager / site_staff）。

**Architecture:** 後端新增 authorize 和 siteScope 兩層 middleware，透過 JWT payload 攜帶 role 和 siteId。前端建立 `/customers/:id` 詳情頁取代 Modal 編輯模式，使用 Tabs 組織基本資料/合約/附加費用/車趟/明細。AuthContext 擴充角色 helper 供 UI 控制使用。

**Tech Stack:** Express.js + Prisma + PostgreSQL（後端）、React 18 + Ant Design 5 + React Query（前端）、Jest + Supertest（測試）

**設計文件:** `docs/plans/2026-02-13-customer-detail-and-permissions-design.md`

---

## Phase 1：權限系統 — 後端

### Task 1：更新 Prisma Schema（User 模型 + Migration）

**Files:**
- Modify: `backend/prisma/schema.prisma:255-271`（User 模型）
- Modify: `backend/prisma/seed.ts`（種子資料）

**Step 1: 修改 User 模型**

在 `backend/prisma/schema.prisma` 的 User 模型中：
- `role` 欄位預設值從 `"admin"` 改為 `"site_staff"`
- 新增 `siteId` 欄位和 `site` 關聯

```prisma
model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String   @map("password_hash")
  name         String
  email        String?
  role         String   @default("site_staff") /// 角色：super_admin / site_manager / site_staff
  siteId       Int?     @map("site_id") /// 綁定站區（super_admin 為 null）
  status       String   @default("active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  site               Site?        @relation(fields: [siteId], references: [id])
  reviewedStatements Statement[]  @relation("ReviewerStatements")
  voidedStatements   Statement[]  @relation("VoidedByUser")
  systemLogs         SystemLog[]

  @@map("users")
}
```

同時在 Site 模型中加入反向關聯：
```prisma
model Site {
  // ...現有欄位
  users     User[]     /// 站區的使用者
}
```

**Step 2: 執行 Migration**

```bash
cd backend && npx prisma migrate dev --name add-user-role-and-site
```

**Step 3: 更新種子資料**

修改 `backend/prisma/seed.ts`，將現有使用者設為 `super_admin`，並新增 `site_manager` 和 `site_staff` 測試帳號。

```typescript
// 更新現有 admin 使用者
await prisma.user.upsert({
  where: { username: 'admin' },
  update: { role: 'super_admin', siteId: null },
  create: {
    username: 'admin',
    passwordHash: await bcrypt.hash('admin123', 10),
    name: '系統管理員',
    email: 'admin@example.com',
    role: 'super_admin',
    siteId: null,
  },
})

// 新增站區主管（綁定第一個站區）
const site1 = await prisma.site.findFirst()
await prisma.user.upsert({
  where: { username: 'manager1' },
  update: { role: 'site_manager', siteId: site1?.id },
  create: {
    username: 'manager1',
    passwordHash: await bcrypt.hash('manager123', 10),
    name: '站區一主管',
    email: 'manager1@example.com',
    role: 'site_manager',
    siteId: site1?.id ?? 1,
  },
})

// 新增站區人員（唯讀）
await prisma.user.upsert({
  where: { username: 'staff1' },
  update: { role: 'site_staff', siteId: site1?.id },
  create: {
    username: 'staff1',
    passwordHash: await bcrypt.hash('staff123', 10),
    name: '站區一人員',
    email: 'staff1@example.com',
    role: 'site_staff',
    siteId: site1?.id ?? 1,
  },
})
```

**Step 4: 執行 seed**

```bash
cd backend && npx prisma db seed
```

**Step 5: Commit**

```bash
git add backend/prisma/
git commit -m "feat: 更新 User 模型，新增 role 和 siteId 欄位"
```

---

### Task 2：建立 authorize middleware

**Files:**
- Create: `backend/src/middleware/authorize.ts`
- Create: `backend/src/__tests__/middleware/authorize.test.ts`

**Step 1: 寫失敗測試**

```typescript
// backend/src/__tests__/middleware/authorize.test.ts
import { Request, Response, NextFunction } from 'express'
import { authorize } from '../../middleware/authorize'

// mock request helper
const mockReq = (role: string) => ({
  userId: 1,
  userRole: role,
  userSiteId: role === 'super_admin' ? null : 1,
} as unknown as Request)

const mockRes = () => {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('authorize middleware', () => {
  it('允許在角色清單中的使用者通過', () => {
    const req = mockReq('super_admin')
    const res = mockRes()
    const next = jest.fn()

    authorize('super_admin', 'site_manager')(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('拒絕不在角色清單中的使用者', () => {
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

    expect(res.status).toHaveBeenCalledWith(401)
  })
})
```

**Step 2: 執行測試確認失敗**

```bash
cd backend && npx jest src/__tests__/middleware/authorize.test.ts --verbose
```

預期：FAIL（模組不存在）

**Step 3: 實作 authorize middleware**

```typescript
// backend/src/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express'

// 擴展 AuthRequest 型別
export interface RoleRequest extends Request {
  userId?: number
  userName?: string
  userRole?: string
  userSiteId?: number | null
}

/**
 * 角色授權中介層
 * 檢查使用者角色是否在允許清單中
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleReq = req as RoleRequest

    if (!roleReq.userId) {
      res.status(401).json({ error: '未登入' })
      return
    }

    if (!roleReq.userRole || !allowedRoles.includes(roleReq.userRole)) {
      res.status(403).json({ error: '權限不足' })
      return
    }

    next()
  }
}
```

**Step 4: 執行測試確認通過**

```bash
cd backend && npx jest src/__tests__/middleware/authorize.test.ts --verbose
```

預期：PASS

**Step 5: Commit**

```bash
git add backend/src/middleware/authorize.ts backend/src/__tests__/middleware/authorize.test.ts
git commit -m "feat: 新增 authorize 角色授權中介層"
```

---

### Task 3：建立 siteScope middleware

**Files:**
- Create: `backend/src/middleware/site-scope.ts`
- Create: `backend/src/__tests__/middleware/site-scope.test.ts`

**Step 1: 寫失敗測試**

```typescript
// backend/src/__tests__/middleware/site-scope.test.ts
import { Request, Response, NextFunction } from 'express'
import { siteScope } from '../../middleware/site-scope'

const mockReq = (role: string, siteId: number | null) => ({
  userId: 1,
  userRole: role,
  userSiteId: siteId,
  query: {},
} as unknown as Request)

const mockRes = () => {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('siteScope middleware', () => {
  it('super_admin 不注入 siteId 過濾', () => {
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
  })
})
```

**Step 2: 執行測試確認失敗**

```bash
cd backend && npx jest src/__tests__/middleware/site-scope.test.ts --verbose
```

**Step 3: 實作 siteScope middleware**

```typescript
// backend/src/middleware/site-scope.ts
import { Request, Response, NextFunction } from 'express'
import type { RoleRequest } from './authorize'

export interface ScopedRequest extends RoleRequest {
  scopedSiteId?: number  // 非 super_admin 時，自動注入的站區過濾 ID
}

/**
 * 站區範圍中介層
 * 為非 super_admin 的使用者自動注入 siteId 過濾條件
 */
export function siteScope() {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleReq = req as ScopedRequest

    // super_admin 不限制站區
    if (roleReq.userRole === 'super_admin') {
      next()
      return
    }

    // 非 super_admin 必須有 siteId
    if (!roleReq.userSiteId) {
      res.status(403).json({ error: '使用者未綁定站區' })
      return
    }

    // 注入站區過濾 ID 供 route handler 使用
    roleReq.scopedSiteId = roleReq.userSiteId
    next()
  }
}
```

**Step 4: 執行測試確認通過**

```bash
cd backend && npx jest src/__tests__/middleware/site-scope.test.ts --verbose
```

**Step 5: Commit**

```bash
git add backend/src/middleware/site-scope.ts backend/src/__tests__/middleware/site-scope.test.ts
git commit -m "feat: 新增 siteScope 站區範圍中介層"
```

---

### Task 4：更新 auth middleware 和 JWT payload

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/auth.ts`（login 回傳 role/siteId）

**Step 1: 更新 auth middleware**

修改 `backend/src/middleware/auth.ts`，JWT 驗證後同時設定 `userRole` 和 `userSiteId`：

```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { RoleRequest } from './authorize'

export type AuthRequest = RoleRequest

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: '未提供認證 token' })
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number
      userName: string
      role: string
      siteId: number | null
    }
    const authReq = req as AuthRequest
    authReq.userId = decoded.userId
    authReq.userName = decoded.userName
    authReq.userRole = decoded.role
    authReq.userSiteId = decoded.siteId
    next()
  } catch {
    res.status(401).json({ error: '無效或過期的 token' })
  }
}
```

**Step 2: 更新 login route 的 JWT 簽發**

修改 `backend/src/routes/auth.ts`，login 時查詢 user 的 role 和 siteId，並加入 JWT payload：

在 login handler 中：
- 查詢 user 時 select 加上 `role` 和 `siteId`
- JWT sign payload 加上 `role` 和 `siteId`
- 回傳的 user 物件加上 `role` 和 `siteId`

在 `/auth/me` handler 中：
- 查詢 user 時 select 加上 `role` 和 `siteId`
- 回傳的 user 物件加上 `role` 和 `siteId`

**Step 3: 執行現有測試確認不破壞**

```bash
cd backend && npx jest --verbose
```

**Step 4: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/auth.ts
git commit -m "feat: 更新 JWT payload 攜帶 role 和 siteId"
```

---

### Task 5：為路由套用權限中介層

**Files:**
- Modify: `backend/src/routes/customers.ts`
- Modify: `backend/src/routes/contracts.ts`
- Modify: `backend/src/routes/trips.ts`
- Modify: `backend/src/routes/statements.ts`
- Modify: `backend/src/routes/sites.ts`
- Modify: `backend/src/routes/items.ts`
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/routes/holidays.ts`
- Modify: `backend/src/routes/dashboard.ts`
- Modify: `backend/src/routes/sync.ts`
- Modify: `backend/src/routes/business-entities.ts`

**Step 1: 定義各路由的權限策略**

在每個路由檔案頂部 import 新 middleware：

```typescript
import { authorize } from '../middleware/authorize'
import { siteScope } from '../middleware/site-scope'
import type { ScopedRequest } from '../middleware/site-scope'
```

**策略對照表：**

| 路由 | GET（讀取） | POST/PATCH/DELETE（寫入） |
|------|-----------|------------------------|
| customers | 所有角色 + siteScope | authorize('super_admin', 'site_manager') + siteScope |
| contracts | 所有角色 + siteScope | authorize('super_admin', 'site_manager') + siteScope |
| trips | 所有角色 + siteScope | authorize('super_admin', 'site_manager') + siteScope |
| statements | 所有角色 + siteScope | authorize('super_admin', 'site_manager') + siteScope |
| sites | 所有角色 | authorize('super_admin') |
| items | 所有角色 | authorize('super_admin') |
| users | authorize('super_admin') | authorize('super_admin') |
| holidays | 所有角色 | authorize('super_admin') |
| dashboard | 所有角色 + siteScope | N/A |
| sync | authorize('super_admin') | authorize('super_admin') |
| business-entities | 所有角色 | authorize('super_admin') |

**Step 2: 修改 customers 路由**

以 customers 為例，示範如何套用：

```typescript
// GET /api/customers — 所有角色可讀，但限制站區範圍
router.get('/', siteScope(), async (req, res) => {
  const scopedReq = req as ScopedRequest
  const { page, pageSize } = parsePagination(req)
  const { siteId, type, status, search } = req.query

  const where: any = {}
  // 站區範圍過濾（優先使用 scopedSiteId）
  if (scopedReq.scopedSiteId) {
    where.siteId = scopedReq.scopedSiteId
  } else if (siteId) {
    where.siteId = Number(siteId)
  }
  // ...其餘邏輯不變
})

// POST /api/customers — 僅 super_admin 和 site_manager
router.post('/', authorize('super_admin', 'site_manager'), siteScope(), async (req, res) => {
  const scopedReq = req as ScopedRequest
  // 若非 super_admin，強制使用自己的站區
  const siteId = scopedReq.scopedSiteId ?? req.body.siteId
  // ...
})

// PATCH /api/customers/:id — 僅 super_admin 和 site_manager
router.patch('/:id', authorize('super_admin', 'site_manager'), siteScope(), async (req, res) => {
  // 先查詢客戶是否屬於自己站區
  // ...
})

// DELETE — 同上
router.delete('/:id', authorize('super_admin', 'site_manager'), siteScope(), async (req, res) => {
  // ...
})
```

**Step 3: 依同樣模式修改其他路由**

按照策略對照表，依序修改每個路由檔案。

**Step 4: 執行全部測試**

```bash
cd backend && npx jest --verbose
```

注意：現有測試可能需要更新 mock request 物件以包含 `userRole` 和 `userSiteId`。

**Step 5: Commit**

```bash
git add backend/src/routes/
git commit -m "feat: 為所有路由套用角色授權和站區範圍中介層"
```

---

### Task 6：更新使用者管理 API

**Files:**
- Modify: `backend/src/routes/users.ts`

**Step 1: 新增/修改使用者時支援 role 和 siteId**

在 POST/PATCH handler 中：
- 接受 `role` 和 `siteId` 參數
- 驗證 role 值必須是 `super_admin`、`site_manager`、`site_staff` 之一
- 驗證 super_admin 的 siteId 應為 null
- 驗證 site_manager/site_staff 的 siteId 必填

在 GET handler 中：
- 回傳 role 和 siteId 資訊
- 包含 site 關聯資料

**Step 2: 執行測試**

```bash
cd backend && npx jest --verbose
```

**Step 3: Commit**

```bash
git add backend/src/routes/users.ts
git commit -m "feat: 使用者管理 API 支援 role 和 siteId"
```

---

## Phase 2：權限系統 — 前端

### Task 7：更新 AuthContext

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`
- Modify: `frontend/src/types/index.ts`

**Step 1: 擴充 User 型別**

在 `frontend/src/types/index.ts` 中更新 User 相關型別：

```typescript
// 在 types/index.ts 中新增或更新
export type UserRole = 'super_admin' | 'site_manager' | 'site_staff'
```

**Step 2: 擴充 AuthContext**

修改 `frontend/src/contexts/AuthContext.tsx`：

```typescript
// User 介面加入 role 和 siteId
interface User {
  id: number
  username: string
  name: string
  email: string | null
  role: string
  siteId: number | null
}

// AuthContextType 介面新增 helper
interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  // 角色 helper
  isSuperAdmin: boolean
  isSiteManager: boolean
  isSiteStaff: boolean
  canEdit: boolean        // super_admin 或 site_manager
  canManageSystem: boolean // 僅 super_admin
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}
```

在 AuthProvider 中計算衍生值：

```typescript
const isSuperAdmin = user?.role === 'super_admin'
const isSiteManager = user?.role === 'site_manager'
const isSiteStaff = user?.role === 'site_staff'
const canEdit = isSuperAdmin || isSiteManager
const canManageSystem = isSuperAdmin

const value = {
  user, token, isAuthenticated, isLoading,
  isSuperAdmin, isSiteManager, isSiteStaff, canEdit, canManageSystem,
  login, logout,
}
```

**Step 3: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx frontend/src/types/index.ts
git commit -m "feat: AuthContext 擴充角色權限 helper"
```

---

### Task 8：更新 AppLayout 選單權限控制

**Files:**
- Modify: `frontend/src/components/AppLayout.tsx`

**Step 1: 依角色過濾選單項目**

修改 `frontend/src/components/AppLayout.tsx` 中的 menuItems：

```typescript
const { user, logout, isSuperAdmin, canEdit, canManageSystem } = useAuth()

// 動態生成選單項目
const menuItems = useMemo(() => {
  const items: MenuItem[] = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '儀表板' },
    {
      key: 'base-data',
      icon: <DatabaseOutlined />,
      label: '基礎資料',
      children: [
        { key: '/sites', label: '站區管理' },
        { key: '/items', label: '品項管理' },
        { key: '/customers', label: '客戶管理' },
        { key: '/business-entities', label: '行號管理' },
        // 合約總覽僅 super_admin 可見
        ...(isSuperAdmin ? [{ key: '/contracts', label: '合約總覽' }] : []),
      ],
    },
    {
      key: 'operations',
      icon: <CarOutlined />,
      label: '營運管理',
      children: [
        { key: '/trips', label: '車趟管理' },
        // 同步管理僅 super_admin 可見
        ...(canManageSystem ? [{ key: '/sync', label: '外部同步' }] : []),
      ],
    },
    {
      key: 'finance',
      icon: <FileTextOutlined />,
      label: '帳務管理',
      children: [
        { key: '/statements', label: '月結管理' },
        { key: '/reports', label: '報表' },
      ],
    },
    // 系統管理僅 super_admin 可見
    ...(canManageSystem ? [{
      key: 'system',
      icon: <SettingOutlined />,
      label: '系統',
      children: [
        { key: '/users', label: '使用者' },
        { key: '/holidays', label: '假日設定' },
        { key: '/schedule', label: '排程管理' },
      ],
    }] : []),
  ]
  return items
}, [isSuperAdmin, canManageSystem])
```

**Step 2: 頁首使用者資訊顯示角色**

在用戶資訊區域加上角色標籤：

```typescript
const roleLabels: Record<string, string> = {
  super_admin: '系統管理員',
  site_manager: '站區主管',
  site_staff: '站區人員',
}

// 在使用者名稱旁顯示
<Tag color={isSuperAdmin ? 'red' : isSiteManager ? 'blue' : 'default'}>
  {roleLabels[user?.role ?? ''] ?? user?.role}
</Tag>
```

**Step 3: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/components/AppLayout.tsx
git commit -m "feat: AppLayout 選單依角色動態顯示/隱藏"
```

---

### Task 9：更新使用者管理頁面

**Files:**
- Modify: `frontend/src/pages/UsersPage.tsx`

**Step 1: 新增/編輯使用者表單加入 role 和 siteId 欄位**

在 Modal 的 Form 中新增：

```tsx
<Form.Item name="role" label="角色" rules={[{ required: true }]}>
  <Select options={[
    { value: 'super_admin', label: '系統管理員' },
    { value: 'site_manager', label: '站區主管' },
    { value: 'site_staff', label: '站區人員' },
  ]} />
</Form.Item>

{/* 僅非 super_admin 時顯示站區選擇 */}
{watchedRole !== 'super_admin' && (
  <Form.Item name="siteId" label="所屬站區" rules={[{ required: true, message: '非系統管理員需選擇站區' }]}>
    <Select options={siteOptions} placeholder="請選擇站區" />
  </Form.Item>
)}
```

**Step 2: 表格欄位顯示角色和站區**

新增欄位：

```tsx
{ title: '角色', dataIndex: 'role', key: 'role', render: (v: string) => roleLabels[v] ?? v },
{ title: '站區', key: 'site', render: (_, record) => record.site?.name ?? '全站區' },
```

**Step 3: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/pages/UsersPage.tsx
git commit -m "feat: 使用者管理頁面支援 role 和 siteId 設定"
```

---

## Phase 3：客戶詳情頁 — 前端

### Task 10：建立 CustomerDetailPage 基本結構

**Files:**
- Create: `frontend/src/pages/CustomerDetailPage.tsx`
- Modify: `frontend/src/App.tsx`（新增路由）

**Step 1: 建立 CustomerDetailPage 骨架**

```tsx
// frontend/src/pages/CustomerDetailPage.tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tabs, Button, Space, Typography, Spin, Result } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useCustomer } from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'

const { Title } = Typography

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEdit } = useAuth()
  const customerId = Number(id)

  const { data: customer, isLoading } = useCustomer(customerId)

  if (isLoading) {
    return <Spin tip="載入中..." style={{ display: 'block', margin: '100px auto' }} />
  }

  if (!customer) {
    return <Result status="404" title="找不到此客戶" extra={
      <Button onClick={() => navigate('/customers')}>回客戶列表</Button>
    } />
  }

  const tabItems = [
    { key: 'info', label: '基本資料', children: <div>基本資料 Tab（待實作）</div> },
    { key: 'contracts', label: '合約管理', children: <div>合約 Tab（待實作）</div> },
    { key: 'fees', label: '附加費用', children: <div>附加費用 Tab（待實作）</div> },
    { key: 'trips', label: '車趟紀錄', children: <div>車趟 Tab（待實作）</div> },
    { key: 'statements', label: '結算明細', children: <div>明細 Tab（待實作）</div> },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>
          返回列表
        </Button>
        <Title level={4} style={{ margin: 0 }}>{customer.name}</Title>
      </Space>
      <Tabs items={tabItems} />
    </div>
  )
}
```

**Step 2: 新增路由**

修改 `frontend/src/App.tsx`，在受保護路由區塊中新增：

```tsx
import CustomerDetailPage from './pages/CustomerDetailPage'

// 在 Route 定義中，放在 /customers 路由之後
<Route path="/customers/:id" element={<CustomerDetailPage />} />
```

**Step 3: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/pages/CustomerDetailPage.tsx frontend/src/App.tsx
git commit -m "feat: 建立客戶詳情頁骨架與路由"
```

---

### Task 11：實作基本資料 Tab

**Files:**
- Create: `frontend/src/pages/CustomerInfoTab.tsx`
- Modify: `frontend/src/pages/CustomerDetailPage.tsx`

**Step 1: 建立 CustomerInfoTab 元件**

從 `CustomersPage.tsx` 提取客戶表單，改為 inline 表單（非 Modal）：

```tsx
// frontend/src/pages/CustomerInfoTab.tsx
import { Form, Input, InputNumber, Select, Switch, Row, Col, Divider, Button, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useUpdateCustomer, useSites, useBusinessEntities } from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import type { Customer } from '../types'

interface Props {
  customer: Customer
}

export default function CustomerInfoTab({ customer }: Props) {
  const { canEdit } = useAuth()
  const [form] = Form.useForm()
  const updateCustomer = useUpdateCustomer()
  const { data: sitesData } = useSites({ all: true })
  const { data: businessEntitiesData } = useBusinessEntities({ all: true })

  const tripFeeEnabled = Form.useWatch('tripFeeEnabled', form)
  const invoiceRequired = Form.useWatch('invoiceRequired', form)

  const siteOptions = (sitesData?.data ?? []).map(s => ({ value: s.id, label: s.name }))
  const businessEntityOptions = (businessEntitiesData?.data ?? [])
    .filter(e => e.status === 'active')
    .map(e => ({ value: e.id, label: `${e.name}（${e.taxId}）` }))

  const handleSave = async () => {
    const values = await form.validateFields()
    await updateCustomer.mutateAsync({ id: customer.id, ...values })
    message.success('客戶資料已更新')
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        ...customer,
        tripFeeAmount: customer.tripFeeAmount ? Number(customer.tripFeeAmount) : null,
        businessEntityId: customer.businessEntityId ?? undefined,
      }}
      disabled={!canEdit}
    >
      {/* 與 CustomersPage Modal 中相同的表單欄位 */}
      {/* 基本資料區塊 */}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Form.Item name="name" label="客戶名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="siteId" label="所屬站區" rules={[{ required: true }]}>
            <Select options={siteOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="type" label="客戶類型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'contracted', label: '簽約客戶' },
              { value: 'temporary', label: '臨時客戶' },
            ]} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="contactPerson" label="聯絡人"><Input /></Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="phone" label="電話"><Input /></Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
        </Col>
      </Row>

      {/* 車趟費設定 */}
      <Divider>車趟費設定</Divider>
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Form.Item name="tripFeeEnabled" label="是否收車趟費" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        {tripFeeEnabled && (
          <>
            <Col xs={24} lg={8}>
              <Form.Item name="tripFeeType" label="車趟費類型">
                <Select options={[
                  { value: 'per_trip', label: '按次' },
                  { value: 'per_month', label: '按月' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="tripFeeAmount" label="車趟費金額">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </>
        )}
      </Row>

      {/* 結算與付款 */}
      <Divider>結算與付款</Divider>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Form.Item name="statementType" label="明細產出方式">
            <Select options={[
              { value: 'monthly', label: '月結' },
              { value: 'per_trip', label: '按趟' },
            ]} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="paymentType" label="付款方式">
            <Select options={[
              { value: 'lump_sum', label: '一次付清' },
              { value: 'per_trip', label: '按趟分次付款' },
            ]} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="statementSendDay" label="明細寄送日（每月幾號）">
            <InputNumber style={{ width: '100%' }} min={1} max={28} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="paymentDueDay" label="付款到期日（每月幾號）">
            <InputNumber style={{ width: '100%' }} min={1} max={28} />
          </Form.Item>
        </Col>
      </Row>

      {/* 發票與通知 */}
      <Divider>發票與通知</Divider>
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Form.Item name="invoiceRequired" label="是否開立發票" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={24} lg={8}>
          <Form.Item name="invoiceType" label="開票方式">
            <Select options={[
              { value: 'net', label: '淨額一張' },
              { value: 'separate', label: '應收應付分開' },
            ]} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={8}>
          <Form.Item name="businessEntityId" label="開票行號"
            rules={[{ required: invoiceRequired, message: '開立發票時必填' }]}>
            <Select allowClear options={businessEntityOptions} showSearch optionFilterProp="label" />
          </Form.Item>
        </Col>
        <Col xs={24} lg={8}>
          <Form.Item name="notificationMethod" label="通知方式">
            <Select options={[
              { value: 'email', label: 'Email' },
              { value: 'line', label: 'LINE' },
              { value: 'both', label: 'Email + LINE' },
            ]} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="notificationEmail" label="通知 Email"><Input /></Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="paymentAccount" label="匯款帳戶資訊"><Input /></Form.Item>
        </Col>
      </Row>

      <Form.Item name="status" label="狀態">
        <Select options={[
          { value: 'active', label: '啟用' },
          { value: 'inactive', label: '停用' },
        ]} />
      </Form.Item>

      {/* 儲存按鈕（僅可編輯角色） */}
      {canEdit && (
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}
            loading={updateCustomer.isPending}>
            儲存變更
          </Button>
        </div>
      )}
    </Form>
  )
}
```

**Step 2: 在 CustomerDetailPage 中引用**

```tsx
import CustomerInfoTab from './CustomerInfoTab'

// tabItems 中替換
{ key: 'info', label: '基本資料', children: <CustomerInfoTab customer={customer} /> },
```

**Step 3: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/pages/CustomerInfoTab.tsx frontend/src/pages/CustomerDetailPage.tsx
git commit -m "feat: 實作客戶詳情頁基本資料 Tab"
```

---

### Task 12：實作合約管理 Tab

**Files:**
- Create: `frontend/src/pages/CustomerContractsTab.tsx`
- Modify: `frontend/src/pages/CustomerDetailPage.tsx`

**Step 1: 建立 CustomerContractsTab**

從 `ContractsPage.tsx` 提取合約列表和 Modal 編輯邏輯，預設篩選 customerId：

```tsx
// frontend/src/pages/CustomerContractsTab.tsx
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, DatePicker, Popconfirm, Tag, Divider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useContracts, useCreateContract, useUpdateContract, useDeleteContract,
  useContractItems, useCreateContractItem, useUpdateContractItem, useDeleteContractItem,
  useItems,
} from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import type { Contract, ContractFormData, ContractItem, ContractItemFormData } from '../types'

// 常數定義（合約狀態、計費方向等，從 ContractsPage 搬過來）
const contractStatusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '生效中' },
  { value: 'expired', label: '已到期' },
  { value: 'terminated', label: '已終止' },
]
const statusColorMap: Record<string, string> = { draft: 'default', active: 'green', expired: 'orange', terminated: 'red' }
const statusLabelMap: Record<string, string> = { draft: '草稿', active: '生效中', expired: '已到期', terminated: '已終止' }
const billingDirectionOptions = [
  { value: 'receivable', label: '應收' },
  { value: 'payable', label: '應付' },
  { value: 'free', label: '免費' },
]
const directionColorMap: Record<string, string> = { receivable: 'blue', payable: 'orange', free: 'default' }
const directionLabelMap: Record<string, string> = { receivable: '應收', payable: '應付', free: '免費' }

// 合約品項子元件（從 ContractsPage 搬過來，不修改）
function ContractItemsSection({ contractId }: { contractId: number }) {
  // ...（與 ContractsPage 中的 ContractItemsSection 完全相同）
}

interface Props {
  customerId: number
}

export default function CustomerContractsTab({ customerId }: Props) {
  const { canEdit } = useAuth()
  const { isMobile } = useResponsive()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [form] = Form.useForm()

  // 查詢該客戶的合約（不分頁，通常不多）
  const { data, isLoading } = useContracts({ customerId, pageSize: 999 })
  const createContract = useCreateContract()
  const updateContract = useUpdateContract()
  const deleteContract = useDeleteContract()

  const openModal = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract)
      form.setFieldsValue({
        contractNumber: contract.contractNumber,
        startDate: dayjs(contract.startDate),
        endDate: dayjs(contract.endDate),
        status: contract.status,
        notes: contract.notes,
      })
    } else {
      setEditingContract(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const formData: ContractFormData = {
      customerId,  // 自動帶入客戶 ID
      contractNumber: values.contractNumber,
      startDate: values.startDate.format('YYYY-MM-DD'),
      endDate: values.endDate.format('YYYY-MM-DD'),
      status: values.status,
      notes: values.notes || null,
    }
    if (editingContract) {
      await updateContract.mutateAsync({ id: editingContract.id, ...formData })
    } else {
      await createContract.mutateAsync(formData)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingContract(null)
  }

  const columns = [
    { title: '合約編號', dataIndex: 'contractNumber', key: 'contractNumber',
      render: (v: string, record: Contract) => (
        canEdit ? <Button type="link" onClick={() => openModal(record)} style={{ padding: 0 }}>{v}</Button> : v
      ),
    },
    { title: '起始日', dataIndex: 'startDate', key: 'startDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    { title: '到期日', dataIndex: 'endDate', key: 'endDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    { title: '狀態', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={statusColorMap[v]}>{statusLabelMap[v] ?? v}</Tag>,
    },
    ...(canEdit ? [{
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, record: Contract) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>編輯</Button>
          <Popconfirm title="確定刪除？" onConfirm={() => deleteContract.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新增合約
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={data?.data ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      {/* 新增/編輯合約 Modal */}
      <Modal
        title={editingContract ? `編輯合約：${editingContract.contractNumber}` : '新增合約'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingContract(null); form.resetFields() }}
        confirmLoading={createContract.isPending || updateContract.isPending}
        width={isMobile ? '95%' : 640}
      >
        <Form form={form} layout="vertical">
          {/* 不需要客戶選擇（自動帶入） */}
          <Form.Item name="contractNumber" label="合約編號" rules={[{ required: true }]}>
            <Input placeholder="例：C-2026-001" />
          </Form.Item>
          <Space style={{ width: '100%' }} direction={isMobile ? 'vertical' : 'horizontal'}>
            <Form.Item name="startDate" label="起始日" rules={[{ required: true }]} style={{ flex: 1, minWidth: 200 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="endDate" label="到期日" rules={[{ required: true }]} style={{ flex: 1, minWidth: 200 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="status" label="狀態" initialValue="draft">
            <Select options={contractStatusOptions} />
          </Form.Item>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} />
          </Form.Item>
          {editingContract && (
            <>
              <Divider />
              <ContractItemsSection contractId={editingContract.id} />
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
```

**Step 2: 在 CustomerDetailPage 中引用**

```tsx
import CustomerContractsTab from './CustomerContractsTab'

// tabItems 中替換
{ key: 'contracts', label: '合約管理', children: <CustomerContractsTab customerId={customerId} /> },
```

**Step 3: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/pages/CustomerContractsTab.tsx frontend/src/pages/CustomerDetailPage.tsx
git commit -m "feat: 實作客戶詳情頁合約管理 Tab"
```

---

### Task 13：實作附加費用 Tab

**Files:**
- Create: `frontend/src/pages/CustomerFeesTab.tsx`
- Modify: `frontend/src/pages/CustomerDetailPage.tsx`

**Step 1: 建立 CustomerFeesTab**

從 `CustomersPage.tsx` 提取附加費用區塊，獨立成 Tab：

```tsx
// frontend/src/pages/CustomerFeesTab.tsx
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useCustomerFees, useCreateCustomerFee, useUpdateCustomerFee, useDeleteCustomerFee } from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import type { CustomerFee, CustomerFeeFormData } from '../types'

interface Props {
  customerId: number
}

export default function CustomerFeesTab({ customerId }: Props) {
  const { canEdit } = useAuth()
  const { isMobile } = useResponsive()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<CustomerFee | null>(null)
  const [form] = Form.useForm<CustomerFeeFormData>()

  const { data: fees, isLoading } = useCustomerFees(customerId)
  const createFee = useCreateCustomerFee(customerId)
  const updateFee = useUpdateCustomerFee(customerId)
  const deleteFee = useDeleteCustomerFee(customerId)

  // ...（Modal 開啟/關閉/送出邏輯，與 CustomersPage 中相同）

  const columns = [
    { title: '費用名稱', dataIndex: 'name', key: 'name' },
    { title: '金額', dataIndex: 'amount', key: 'amount',
      render: (v: string) => `$${Number(v).toLocaleString()}` },
    { title: '方向', dataIndex: 'billingDirection', key: 'billingDirection',
      render: (v: string) => v === 'receivable' ? '應收' : '應付' },
    { title: '頻率', dataIndex: 'frequency', key: 'frequency',
      render: (v: string) => v === 'monthly' ? '按月' : '按趟' },
    ...(canEdit ? [{
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, record: CustomerFee) => (
        <Space>
          <Button type="link" size="small" onClick={() => openFeeModal(record)}>編輯</Button>
          <Popconfirm title="確定刪除？" onConfirm={() => deleteFee.mutate(record.id)}>
            <Button type="link" size="small" danger>刪除</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openFeeModal()}>
            新增附加費用
          </Button>
        </div>
      )}

      <Table columns={columns} dataSource={fees ?? []} rowKey="id" loading={isLoading} pagination={false} />

      {/* 附加費用 Modal（與 CustomersPage 中相同） */}
    </div>
  )
}
```

**Step 2: 在 CustomerDetailPage 中引用**

```tsx
import CustomerFeesTab from './CustomerFeesTab'

{ key: 'fees', label: '附加費用', children: <CustomerFeesTab customerId={customerId} /> },
```

**Step 3: Commit**

```bash
git add frontend/src/pages/CustomerFeesTab.tsx frontend/src/pages/CustomerDetailPage.tsx
git commit -m "feat: 實作客戶詳情頁附加費用 Tab"
```

---

### Task 14：實作車趟紀錄 Tab（唯讀）

**Files:**
- Create: `frontend/src/pages/CustomerTripsTab.tsx`
- Modify: `frontend/src/pages/CustomerDetailPage.tsx`

**Step 1: 建立 CustomerTripsTab**

查詢該客戶的車趟紀錄，唯讀展示：

```tsx
// frontend/src/pages/CustomerTripsTab.tsx
import { useState } from 'react'
import { Table, Tag, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { useTrips } from '../api/hooks'

interface Props {
  customerId: number
}

export default function CustomerTripsTab({ customerId }: Props) {
  const [page, setPage] = useState(1)
  const [yearMonth, setYearMonth] = useState<string | undefined>()

  const { data, isLoading } = useTrips({
    page,
    pageSize: 20,
    customerId,
    yearMonth,
  })

  const columns = [
    { title: '日期', dataIndex: 'tripDate', key: 'tripDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
    { title: '時間', dataIndex: 'tripTime', key: 'tripTime',
      render: (v: string | null) => v ?? '-' },
    { title: '站區', key: 'site',
      render: (_: unknown, record: any) => record.site?.name ?? '-' },
    { title: '司機', dataIndex: 'driver', key: 'driver',
      render: (v: string | null) => v ?? '-' },
    { title: '車牌', dataIndex: 'vehiclePlate', key: 'vehiclePlate',
      render: (v: string | null) => v ?? '-' },
    { title: '來源', dataIndex: 'source', key: 'source',
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          manual: { color: 'blue', label: '手動' },
          pos_sync: { color: 'green', label: 'POS' },
          vehicle_sync: { color: 'orange', label: '車機' },
        }
        return <Tag color={map[v]?.color}>{map[v]?.label ?? v}</Tag>
      },
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <DatePicker.MonthPicker
          placeholder="篩選月份"
          onChange={(_, dateStr) => { setYearMonth(dateStr as string || undefined); setPage(1) }}
          allowClear
        />
      </div>
      <Table
        columns={columns}
        dataSource={data?.data ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.pagination?.total ?? 0,
          onChange: setPage,
        }}
      />
    </div>
  )
}
```

注意：需要確認 `useTrips` hook 是否支援 `customerId` 篩選。如果不支援，需要在 `hooks.ts` 中擴充。

**Step 2: 檢查並擴充 useTrips hook**

確認 `backend/src/routes/trips.ts` GET 端點支援 `customerId` query param。如果已支援（查看現有路由），前端 hook 也需要傳遞此參數。

**Step 3: 在 CustomerDetailPage 中引用**

```tsx
import CustomerTripsTab from './CustomerTripsTab'

{ key: 'trips', label: '車趟紀錄', children: <CustomerTripsTab customerId={customerId} /> },
```

**Step 4: Commit**

```bash
git add frontend/src/pages/CustomerTripsTab.tsx frontend/src/pages/CustomerDetailPage.tsx
git commit -m "feat: 實作客戶詳情頁車趟紀錄 Tab（唯讀）"
```

---

### Task 15：實作結算明細 Tab（唯讀）

**Files:**
- Create: `frontend/src/pages/CustomerStatementsTab.tsx`
- Modify: `frontend/src/pages/CustomerDetailPage.tsx`

**Step 1: 建立 CustomerStatementsTab**

查詢該客戶的結算明細，唯讀展示：

```tsx
// frontend/src/pages/CustomerStatementsTab.tsx
import { useState } from 'react'
import { Table, Tag, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { useStatements } from '../api/hooks'

interface Props {
  customerId: number
}

export default function CustomerStatementsTab({ customerId }: Props) {
  const [page, setPage] = useState(1)
  const [yearMonth, setYearMonth] = useState<string | undefined>()

  const { data, isLoading } = useStatements({
    page,
    pageSize: 20,
    customerId,
    yearMonth,
  })

  const statusMap: Record<string, { color: string; label: string }> = {
    draft: { color: 'default', label: '草稿' },
    approved: { color: 'green', label: '已核准' },
    rejected: { color: 'red', label: '已退回' },
    invoiced: { color: 'blue', label: '已開票' },
    sent: { color: 'cyan', label: '已寄送' },
  }

  const columns = [
    { title: '月份', dataIndex: 'yearMonth', key: 'yearMonth' },
    { title: '類型', dataIndex: 'statementType', key: 'statementType',
      render: (v: string) => v === 'monthly' ? '月結' : '按趟' },
    { title: '應收', dataIndex: 'totalReceivable', key: 'totalReceivable',
      render: (v: string) => `$${Number(v).toLocaleString()}` },
    { title: '應付', dataIndex: 'totalPayable', key: 'totalPayable',
      render: (v: string) => `$${Number(v).toLocaleString()}` },
    { title: '淨額', dataIndex: 'netAmount', key: 'netAmount',
      render: (v: string) => `$${Number(v).toLocaleString()}` },
    { title: '狀態', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.label ?? v}</Tag> },
    { title: '寄送日', dataIndex: 'sentAt', key: 'sentAt',
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <DatePicker.MonthPicker
          placeholder="篩選月份"
          onChange={(_, dateStr) => { setYearMonth(dateStr as string || undefined); setPage(1) }}
          allowClear
        />
      </div>
      <Table
        columns={columns}
        dataSource={data?.data ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.pagination?.total ?? 0,
          onChange: setPage,
        }}
      />
    </div>
  )
}
```

**Step 2: 在 CustomerDetailPage 中引用**

```tsx
import CustomerStatementsTab from './CustomerStatementsTab'

{ key: 'statements', label: '結算明細', children: <CustomerStatementsTab customerId={customerId} /> },
```

**Step 3: Commit**

```bash
git add frontend/src/pages/CustomerStatementsTab.tsx frontend/src/pages/CustomerDetailPage.tsx
git commit -m "feat: 實作客戶詳情頁結算明細 Tab（唯讀）"
```

---

### Task 16：重構 CustomersPage 為列表頁

**Files:**
- Modify: `frontend/src/pages/CustomersPage.tsx`

**Step 1: 移除 Modal 編輯，改為導航到詳情頁**

修改 `CustomersPage.tsx`：

1. 移除所有 Modal 相關 state 和 Form
2. 移除附加費用相關邏輯
3. 客戶名稱改為 `<Link>` 導航到 `/customers/:id`
4. 保留搜尋/篩選功能
5. 「新增客戶」改為導航到 `/customers/new`（或保留 Modal 簡化版只輸入基本資料）
6. 新增欄位：合約摘要（如「1 份生效中」）

```tsx
// 客戶名稱欄位改為連結
{ title: '客戶名稱', dataIndex: 'name', key: 'name',
  render: (name: string, record: Customer) => (
    <Link to={`/customers/${record.id}`}>{name}</Link>
  ),
},
```

操作欄位根據權限控制：
```tsx
...(canEdit ? [{
  title: '操作', key: 'actions', width: 80,
  render: (_: unknown, record: Customer) => (
    <Popconfirm title="確定刪除？" onConfirm={() => deleteCustomer.mutate(record.id)}>
      <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
    </Popconfirm>
  ),
}] : []),
```

**Step 2: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/src/pages/CustomersPage.tsx
git commit -m "refactor: CustomersPage 改為純列表頁，客戶編輯移至詳情頁"
```

---

### Task 17：新增客戶功能

**Files:**
- Create: `frontend/src/pages/CustomerCreatePage.tsx`（或在 CustomerDetailPage 中處理 new 狀態）
- Modify: `frontend/src/App.tsx`

**Step 1: 決定新增客戶的 UI 方式**

兩種選擇：
- **選項 A**：在 CustomerDetailPage 中處理 `/customers/new`（id 為 undefined 時進入新增模式）
- **選項 B**：在 CustomersPage 保留簡化版 Modal 只填基本資料，建立後跳轉詳情頁

建議選擇 **選項 A**：CustomerDetailPage 判斷 `id === 'new'` 時進入新增模式。

修改 `CustomerDetailPage.tsx`：

```tsx
const isNew = id === 'new'

// 新增模式：不查詢現有資料，顯示空白表單
if (isNew) {
  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>返回列表</Button>
        <Title level={4} style={{ margin: 0 }}>新增客戶</Title>
      </Space>
      <CustomerInfoTab customer={null} isNew onCreated={(newId) => navigate(`/customers/${newId}`)} />
    </div>
  )
}
```

修改 `CustomerInfoTab` 支援新增模式（`customer` 為 null 時使用 `createCustomer`）。

**Step 2: 更新路由**

在 `App.tsx` 中確保 `/customers/new` 路由在 `/customers/:id` 之前：

```tsx
<Route path="/customers/new" element={<CustomerDetailPage />} />
<Route path="/customers/:id" element={<CustomerDetailPage />} />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/CustomerDetailPage.tsx frontend/src/pages/CustomerInfoTab.tsx frontend/src/App.tsx
git commit -m "feat: 支援從客戶詳情頁新增客戶"
```

---

### Task 18：更新合約總覽頁連結

**Files:**
- Modify: `frontend/src/pages/ContractsPage.tsx`

**Step 1: 合約列表中的客戶名稱改為連結**

```tsx
{ title: '客戶', key: 'customer',
  render: (_: unknown, record: Contract) => (
    record.customer ? (
      <Link to={`/customers/${record.customerId}?tab=contracts`}>{record.customer.name}</Link>
    ) : '-'
  ),
},
```

**Step 2: 根據權限控制操作按鈕**

```tsx
const { canManageSystem } = useAuth()

// 新增/編輯/刪除按鈕僅 super_admin 可見（因為這是全局管理頁面）
```

**Step 3: Commit**

```bash
git add frontend/src/pages/ContractsPage.tsx
git commit -m "refactor: 合約總覽頁加入客戶連結和權限控制"
```

---

### Task 19：各頁面權限控制收尾

**Files:**
- Modify: `frontend/src/pages/SitesPage.tsx`
- Modify: `frontend/src/pages/ItemsPage.tsx`
- Modify: `frontend/src/pages/StatementsPage.tsx`
- Modify: `frontend/src/pages/TripsPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Step 1: 為各頁面加入權限控制**

通用模式：

```tsx
const { canEdit, canManageSystem } = useAuth()

// 主檔管理頁（sites, items, business-entities, holidays）
// → 新增/編輯/刪除按鈕僅 canManageSystem（super_admin）可見

// 營運頁面（trips, statements）
// → 新增/編輯按鈕僅 canEdit（super_admin + site_manager）可見
// → site_staff 只看得到資料

// Dashboard
// → 所有角色可見，但資料自動受 siteScope 限制
```

**Step 2: 確認前端編譯通過**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: 所有頁面套用角色權限控制"
```

---

### Task 20：全面測試

**Step 1: 執行後端測試**

```bash
cd backend && npx jest --verbose
```

修復任何因為 auth middleware 變更而失敗的測試。

**Step 2: 執行前端 TypeScript 檢查**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: 執行瀏覽器測試**

使用 `/browser-testing` 技能測試三種角色的完整流程：
1. 以 super_admin 登入 → 確認所有功能可用
2. 以 site_manager 登入 → 確認只能操作自己站區
3. 以 site_staff 登入 → 確認所有操作按鈕不可見

**Step 4: 最終 Commit**

```bash
git add -A
git commit -m "test: 全面測試權限系統和客戶詳情頁"
```

---

## 任務摘要

| Phase | Task | 內容 | 預估 |
|-------|------|------|------|
| 1 | 1 | Prisma schema + migration + seed | 中 |
| 1 | 2 | authorize middleware + 測試 | 小 |
| 1 | 3 | siteScope middleware + 測試 | 小 |
| 1 | 4 | 更新 auth middleware + JWT | 小 |
| 1 | 5 | 各路由套用權限中介層 | 大 |
| 1 | 6 | 使用者管理 API | 小 |
| 2 | 7 | AuthContext 擴充 | 小 |
| 2 | 8 | AppLayout 選單權限 | 小 |
| 2 | 9 | 使用者管理頁面 | 小 |
| 3 | 10 | CustomerDetailPage 骨架 | 小 |
| 3 | 11 | 基本資料 Tab | 中 |
| 3 | 12 | 合約管理 Tab | 中 |
| 3 | 13 | 附加費用 Tab | 小 |
| 3 | 14 | 車趟紀錄 Tab | 小 |
| 3 | 15 | 結算明細 Tab | 小 |
| 3 | 16 | CustomersPage 重構 | 中 |
| 3 | 17 | 新增客戶功能 | 小 |
| 3 | 18 | 合約總覽頁更新 | 小 |
| 3 | 19 | 各頁面權限控制收尾 | 中 |
| 3 | 20 | 全面測試 | 中 |

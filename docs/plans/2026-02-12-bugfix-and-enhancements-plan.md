# Bug 修復 + 功能增強 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修復所有已知 Bug（Dashboard 欄位不匹配、`all=true` 下拉空白、Users/Holidays 格式不匹配）、完成車趟介面重構為 Tabs、新增行號管理功能、新增月結車趟預覽、修復 PDF 中文亂碼。

**Architecture:** 後端修正 API 回傳格式使其與前端型別一致，前端 hooks 增加陣列/分頁雙格式相容處理。車趟頁面拆為 TripsPage + SiteTripsTab 元件。新增 BusinessEntity model 及對應 CRUD。PDF 改用 Noto Sans TC 字型。

**Tech Stack:** React 18 + TypeScript + Ant Design 5 + React Query | Express.js + TypeScript + Prisma + PostgreSQL 16

**設計文件：**
- `docs/plans/2026-02-11-trips-ui-refactor-design.md`
- `docs/plans/2026-02-11-system-optimization-design.md`

---

## Phase 1: Bug 修復

### Task 1: 修復 Dashboard 欄位名稱不匹配

**問題：** 後端 `GET /api/dashboard/stats` 回傳 `tripCount`、`activeCustomerCount`、`pendingReviewCount`、`contractAlerts`、`contractAlerts[].daysLeft`，但前端 `DashboardStats` 型別期望 `monthlyTrips`、`customerCount`、`pendingReviews`、`expiringContracts`、`expiringContracts[].daysRemaining`、`pendingItems`。

**Files:**
- Modify: `backend/src/routes/dashboard.ts:74-81`
- Test: `backend/src/__tests__/dashboard.test.ts`

**Step 1: 寫失敗測試**

在 `backend/src/__tests__/dashboard.test.ts` 中新增以下測試（如果已有此檔案，追加到最後；如果測試框架結構不同則配合現有結構）：

```typescript
// 在現有測試中新增
it('回傳的欄位名稱應與前端 DashboardStats 型別一致', async () => {
  const res = await request(app)
    .get('/api/dashboard/stats')
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(200)
  // 確認使用前端期望的欄位名稱
  expect(res.body).toHaveProperty('monthlyTrips')
  expect(res.body).toHaveProperty('customerCount')
  expect(res.body).toHaveProperty('pendingReviews')
  expect(res.body).toHaveProperty('expiringContracts')
  expect(res.body).toHaveProperty('pendingItems')
  // 確認不再使用舊欄位名稱
  expect(res.body).not.toHaveProperty('tripCount')
  expect(res.body).not.toHaveProperty('activeCustomerCount')
  expect(res.body).not.toHaveProperty('pendingReviewCount')
  expect(res.body).not.toHaveProperty('contractAlerts')

  // 檢查 expiringContracts 子欄位
  if (res.body.expiringContracts.length > 0) {
    expect(res.body.expiringContracts[0]).toHaveProperty('daysRemaining')
    expect(res.body.expiringContracts[0]).not.toHaveProperty('daysLeft')
  }
})
```

**Step 2: 跑測試確認失敗**

```bash
cd D:\recycling-automation-system\backend
npx jest src/__tests__/dashboard.test.ts --verbose
```
Expected: FAIL — `monthlyTrips` 不存在

**Step 3: 修改 `backend/src/routes/dashboard.ts` 第 60-81 行**

將 `res.json({...})` 內的回傳物件改為：

```typescript
  // 組裝 pendingItems
  const pendingItems = []
  if (pendingReviewCount > 0) {
    pendingItems.push({
      type: 'statement_review',
      count: pendingReviewCount,
      label: '待審核明細',
      link: '/statements?status=draft',
    })
  }

  // 計算每個合約距到期的天數
  const expiringContracts = rawExpiringContracts.map((c) => {
    const daysRemaining = Math.ceil(
      (new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    return {
      customerId: c.customer.id,
      customerName: c.customer.name,
      contractNumber: c.contractNumber,
      endDate: c.endDate,
      daysRemaining,
    }
  })

  res.json({
    monthlyTrips: tripCount,
    totalReceivable,
    totalPayable,
    customerCount: activeCustomerCount,
    pendingReviews: pendingReviewCount,
    expiringContracts,
    pendingItems,
  })
```

注意：同時把原本的 `expiringContracts` 查詢結果變數名改為 `rawExpiringContracts`，避免與回傳欄位衝突。完整修改如下：

將 `backend/src/routes/dashboard.ts` 第 48 行的 `const expiringContracts = await prisma.contract.findMany({` 改為 `const rawExpiringContracts = await prisma.contract.findMany({`。

將第 60-81 行（原本的 `contractAlerts` 計算和 `res.json`）替換為上方程式碼。

**Step 4: 跑測試確認通過**

```bash
cd D:\recycling-automation-system\backend
npx jest src/__tests__/dashboard.test.ts --verbose
```
Expected: PASS

**Step 5: Commit**

```bash
cd D:\recycling-automation-system
git add backend/src/routes/dashboard.ts backend/src/__tests__/dashboard.test.ts
git commit -m "fix: Dashboard API 欄位名稱與前端 DashboardStats 型別對齊"
```

---

### Task 2: 修復 `all=true` 下拉空白 — 前端 hooks 相容處理

**問題：** 後端 `all=true` 時回傳純陣列 `T[]`，但前端 hook 型別宣告為 `PaginatedResponse<T>`，導致 `.data` 為 `undefined`。受影響 hooks：`useSites`、`useItems`、`useCustomers`、`useTrips`、`useContracts`。

**Files:**
- Modify: `frontend/src/api/hooks.ts:37-46`（useSites）
- Modify: `frontend/src/api/hooks.ts:100-108`（useItems）
- Modify: `frontend/src/api/hooks.ts:287-294`（useCustomers）
- Modify: `frontend/src/api/hooks.ts` 中 `useTrips` 和 `useContracts`

**Step 1: 在 `frontend/src/api/hooks.ts` 檔案頂部新增輔助函數**

在 import 區塊後（約第 21 行之後）加入：

```typescript
// 輔助：將後端 all=true 回傳的純陣列統一轉為 PaginatedResponse 格式
function normalizePaginatedResponse<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return {
      data,
      pagination: { page: 1, pageSize: data.length, total: data.length, totalPages: 1 },
    }
  }
  return data
}
```

**Step 2: 修改 `useSites` hook（第 37-46 行）**

```typescript
export function useSites(params?: { page?: number; pageSize?: number; all?: boolean }) {
  return useQuery<PaginatedResponse<Site>>({
    queryKey: ['sites', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/sites', { params })
      return normalizePaginatedResponse<Site>(data)
    },
    staleTime: 5 * 60 * 1000,
  })
}
```

**Step 3: 修改 `useItems` hook（第 100-108 行）**

```typescript
export function useItems(params?: { page?: number; pageSize?: number; category?: string; all?: boolean }) {
  return useQuery<PaginatedResponse<Item>>({
    queryKey: ['items', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/items', { params })
      return normalizePaginatedResponse<Item>(data)
    },
    staleTime: 5 * 60 * 1000,
  })
}
```

**Step 4: 修改 `useCustomers` hook（第 287-294 行）**

```typescript
export function useCustomers(params?: { page?: number; pageSize?: number; siteId?: number; type?: string; search?: string }) {
  return useQuery<PaginatedResponse<Customer>>({
    queryKey: ['customers', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/customers', { params })
      return normalizePaginatedResponse<Customer>(data)
    },
  })
}
```

**Step 5: 找到 `useTrips` 和 `useContracts` 並同樣修改**

對 `useTrips` 和 `useContracts` 做相同包裝：在 `queryFn` 的 `return data` 改為 `return normalizePaginatedResponse<Trip>(data)` 和 `return normalizePaginatedResponse<Contract>(data)`。

**Step 6: 驗證**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無型別錯誤

**Step 7: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/api/hooks.ts
git commit -m "fix: 前端 hooks 相容 all=true 純陣列回傳，修復下拉選單空白"
```

---

### Task 3: 修復 Users / Holidays hooks 回傳格式

**問題：** 後端 `GET /users` 和 `GET /holidays` 回傳純陣列，但前端 hooks 型別宣告 `PaginatedResponse<User>` / `PaginatedResponse<Holiday>`。

**Files:**
- Modify: `frontend/src/api/hooks.ts`（useUsers 第 163-171 行、useHolidays 第 225-232 行）

**Step 1: 修改 `useUsers` hook**

```typescript
export function useUsers(params?: { page?: number; pageSize?: number }) {
  return useQuery<User[]>({
    queryKey: ['users', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/users', { params })
      return data
    },
  })
}
```

**Step 2: 修改 `useHolidays` hook**

```typescript
export function useHolidays(params?: { page?: number; pageSize?: number; year?: number }) {
  return useQuery<Holiday[]>({
    queryKey: ['holidays', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/holidays', { params })
      return data
    },
  })
}
```

**Step 3: 修改 `UsersPage.tsx` 和 `HolidaysPage.tsx` 中所有 `.data?.data` 改為直接使用陣列**

在 `UsersPage.tsx` 中，將所有 `data?.data` 改為 `data`，將 `data?.pagination?.total` 改為 `data?.length`，移除分頁相關的 Table pagination 設定（因後端不支援分頁）。

在 `HolidaysPage.tsx` 中同理。

> **注意：** 如果頁面中只是 `data?.data`，直接改為 `data` 即可。如果有用到分頁的 `pagination` 屬性，需一併移除。

**Step 4: 驗證**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無型別錯誤

**Step 5: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/api/hooks.ts frontend/src/pages/UsersPage.tsx frontend/src/pages/HolidaysPage.tsx
git commit -m "fix: Users/Holidays hooks 型別改為純陣列，對齊後端回傳格式"
```

---

## Phase 2: PDF 中文亂碼修復

### Task 4: 下載 Noto Sans TC 字型

**Files:**
- Create: `backend/assets/fonts/NotoSansTC-Regular.ttf`
- Create: `backend/assets/fonts/NotoSansTC-Bold.ttf`

**Step 1: 建立 fonts 目錄並下載字型**

```bash
cd D:\recycling-automation-system\backend
mkdir -p assets/fonts
cd assets/fonts
curl -L -o NotoSansTC-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf"
```

> **備註：** 如果 curl 下載失敗，手動從 https://fonts.google.com/noto/specimen/Noto+Sans+TC 下載 Regular 和 Bold ttf 檔，放到 `backend/assets/fonts/` 目錄。也可以使用可變字型（Variable Font）的 `.ttf`，此時 Regular 和 Bold 都在同一個檔案內。

**Step 2: 驗證檔案存在**

```bash
ls -la D:\recycling-automation-system\backend\assets\fonts\
```
Expected: 至少一個 `.ttf` 檔案存在

**Step 3: Commit**

```bash
cd D:\recycling-automation-system
git add backend/assets/fonts/
git commit -m "chore: 新增 Noto Sans TC 中文字型（PDF 報表用）"
```

---

### Task 5: 修改 PDF Generator 使用中文字型

**Files:**
- Modify: `backend/src/services/pdf-generator.ts:53-56`

**Step 1: 寫測試**

在 `backend/src/__tests__/` 新增或修改 `reports.test.ts`，加入：

```typescript
it('PDF 產出應包含正確的中文內容', async () => {
  // 需要有種子資料中的 customerId 和 yearMonth
  // 此測試主要確認不拋錯（字型載入成功）
  const res = await request(app)
    .get('/api/reports/statement-pdf?customerId=1&yearMonth=2025-12')
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(200)
  expect(res.headers['content-type']).toContain('pdf')
  expect(res.body.length).toBeGreaterThan(0)
})
```

**Step 2: 修改 `buildPDF` 函數**

在 `backend/src/services/pdf-generator.ts` 中，修改 `buildPDF` 函數開頭（第 53-66 行）：

```typescript
import path from 'path'

function buildPDF(customer: any, yearMonth: string, billing: BillingResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // 註冊中文字型
      const fontPath = path.join(__dirname, '../../assets/fonts/NotoSansTC-Regular.ttf')
      doc.registerFont('NotoSansTC', fontPath)
      doc.font('NotoSansTC')

      // 公司標頭
      doc.fontSize(18).text('資源回收管理系統', { align: 'center' })
      // ... 後續程式碼不變
```

> **注意：** 如果下載的是可變字型（Variable Font），只有一個 `.ttf`，就只註冊一個 `NotoSansTC`。如果有分 Regular/Bold，則額外 `doc.registerFont('NotoSansTC-Bold', fontBoldPath)`，並在標題處使用 `doc.font('NotoSansTC-Bold')`。

同時在檔案頂部確認有 `import path from 'path'`。

**Step 3: 跑測試**

```bash
cd D:\recycling-automation-system\backend
npx jest src/__tests__/reports.test.ts --verbose
```
Expected: PASS

**Step 4: Commit**

```bash
cd D:\recycling-automation-system
git add backend/src/services/pdf-generator.ts
git commit -m "fix: PDF 報表改用 Noto Sans TC 字型，修復中文亂碼"
```

---

## Phase 3: 車趟介面重構為 Tabs

### Task 6: 拆分 TripItemsExpand 為獨立元件

**Files:**
- Create: `frontend/src/pages/TripItemsExpand.tsx`
- Modify: `frontend/src/pages/TripsPage.tsx`

**Step 1: 建立 `frontend/src/pages/TripItemsExpand.tsx`**

將 `TripsPage.tsx` 中的 `TripItemsExpand` 函數（第 45-163 行）原封不動搬到新檔案，加上必要的 import：

```typescript
// frontend/src/pages/TripItemsExpand.tsx
import { useState } from 'react'
import {
  Table, Button, Modal, Form, InputNumber, Select, Space,
  Popconfirm, Typography, Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTripItems, useCreateTripItem, useDeleteTripItem, useItems } from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { TripItem, TripItemFormData } from '../types'

const { Text } = Typography

// 計費方向
const directionLabelMap: Record<string, string> = {
  receivable: '應收',
  payable: '應付',
  free: '免費',
}
const directionColorMap: Record<string, string> = {
  receivable: 'blue',
  payable: 'orange',
  free: 'default',
}

export default function TripItemsExpand({ tripId }: { tripId: number }) {
  // ... 原 TripItemsExpand 函數體（第 46-162 行）完全不變
}
```

**Step 2: 在 `TripsPage.tsx` 中移除 TripItemsExpand 函數體，改為 import**

```typescript
import TripItemsExpand from './TripItemsExpand'
```

移除 `TripsPage.tsx` 中第 45-163 行的 `TripItemsExpand` 函數定義，以及只有 `TripItemsExpand` 用到的 `directionLabelMap`、`directionColorMap`（如果主頁面也有用到則保留）。

**Step 3: 驗證編譯**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無錯誤

**Step 4: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/pages/TripItemsExpand.tsx frontend/src/pages/TripsPage.tsx
git commit -m "refactor: 拆分 TripItemsExpand 為獨立元件"
```

---

### Task 7: 建立 SiteTripsTab 元件

**Files:**
- Create: `frontend/src/pages/SiteTripsTab.tsx`

**Step 1: 建立 `frontend/src/pages/SiteTripsTab.tsx`**

```typescript
// frontend/src/pages/SiteTripsTab.tsx
// 單一站區的車趟列表 Tab 內容
import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, InputNumber, Select, Space, DatePicker,
  Popconfirm, Typography, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip,
  useCustomers,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import TripItemsExpand from './TripItemsExpand'
import type { Trip, TripFormData } from '../types'

const { RangePicker } = DatePicker

// 資料來源標籤
const sourceLabelMap: Record<string, string> = {
  manual: '手動',
  pos_sync: 'POS 同步',
  vehicle_sync: '車機同步',
}
const sourceColorMap: Record<string, string> = {
  manual: 'blue',
  pos_sync: 'green',
  vehicle_sync: 'purple',
}

interface SiteTripsTabProps {
  siteId: number
  siteName: string
}

export default function SiteTripsTab({ siteId, siteName }: SiteTripsTabProps) {
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [filterCustomerId, setFilterCustomerId] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useTrips({
    page,
    pageSize: 20,
    siteId,
    customerId: filterCustomerId,
    dateFrom: dateRange?.[0],
    dateTo: dateRange?.[1],
  })

  // 只顯示當前站區的客戶
  const { data: customersData } = useCustomers({ siteId, pageSize: 999 })
  const createTrip = useCreateTrip()
  const updateTrip = useUpdateTrip()
  const deleteTrip = useDeleteTrip()

  const customerOptions = (customersData?.data ?? []).map(c => ({
    value: c.id,
    label: c.name,
  }))

  const openModal = (trip?: Trip) => {
    if (trip) {
      setEditingTrip(trip)
      form.setFieldsValue({
        customerId: trip.customerId,
        tripDate: dayjs(trip.tripDate),
        tripTime: trip.tripTime,
        driver: trip.driver,
        vehiclePlate: trip.vehiclePlate,
        notes: trip.notes,
      })
    } else {
      setEditingTrip(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const formData: TripFormData = {
      customerId: values.customerId,
      siteId, // 自動帶入當前 Tab 的站區
      tripDate: values.tripDate.format('YYYY-MM-DD'),
      tripTime: values.tripTime || null,
      driver: values.driver || null,
      vehiclePlate: values.vehiclePlate || null,
      notes: values.notes || null,
    }
    if (editingTrip) {
      await updateTrip.mutateAsync({ id: editingTrip.id, ...formData })
    } else {
      await createTrip.mutateAsync(formData)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingTrip(null)
  }

  const columns = [
    {
      title: '收運日期',
      dataIndex: 'tripDate',
      key: 'tripDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '客戶',
      key: 'customer',
      render: (_: unknown, record: Trip) => record.customer?.name ?? '-',
    },
    {
      title: '司機',
      dataIndex: 'driver',
      key: 'driver',
      responsive: ['md' as const],
    },
    {
      title: '車牌',
      dataIndex: 'vehiclePlate',
      key: 'vehiclePlate',
      responsive: ['md' as const],
    },
    {
      title: '來源',
      dataIndex: 'source',
      key: 'source',
      render: (v: string) => (
        <Tag color={sourceColorMap[v] ?? 'default'}>
          {sourceLabelMap[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: Trip) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除此車趟？" onConfirm={() => deleteTrip.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 篩選列 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="篩選客戶"
          style={{ width: 200 }}
          options={customerOptions}
          value={filterCustomerId}
          onChange={setFilterCustomerId}
          showSearch
          optionFilterProp="label"
        />
        <RangePicker
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
            } else {
              setDateRange(undefined)
            }
          }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          新增車趟
        </Button>
      </Space>

      {/* 車趟列表 */}
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
          showTotal: (total) => `共 ${total} 筆`,
        }}
        expandable={{
          expandedRowRender: (record: Trip) => <TripItemsExpand tripId={record.id} />,
        }}
        scroll={isMobile ? { x: 600 } : undefined}
        size={isMobile ? 'small' : 'middle'}
      />

      {/* 新增/編輯 Modal（站區不顯示，自動帶入） */}
      <Modal
        title={editingTrip ? '編輯車趟' : '新增車趟'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingTrip(null) }}
        confirmLoading={createTrip.isPending || updateTrip.isPending}
        width={isMobile ? '95%' : 560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customerId" label="客戶" rules={[{ required: true, message: '請選擇客戶' }]}>
            <Select options={customerOptions} placeholder="請選擇客戶" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="tripDate" label="收運日期" rules={[{ required: true, message: '請選擇日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tripTime" label="收運時間">
            <Input placeholder="例：08:30" />
          </Form.Item>
          <Form.Item name="driver" label="司機">
            <Input placeholder="司機姓名" />
          </Form.Item>
          <Form.Item name="vehiclePlate" label="車牌">
            <Input placeholder="車牌號碼" />
          </Form.Item>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} placeholder="備註" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無錯誤

**Step 3: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/pages/SiteTripsTab.tsx
git commit -m "feat: 新增 SiteTripsTab 元件（站區車趟 Tab 內容）"
```

---

### Task 8: 改寫 TripsPage 為 Tabs 架構

**Files:**
- Modify: `frontend/src/pages/TripsPage.tsx`

**Step 1: 重寫 `frontend/src/pages/TripsPage.tsx`**

```typescript
// frontend/src/pages/TripsPage.tsx
import { Tabs, Spin, Typography } from 'antd'
import { useSites } from '../api/hooks'
import SiteTripsTab from './SiteTripsTab'

const { Title } = Typography

export default function TripsPage() {
  const { data: sitesData, isLoading } = useSites({ all: true })

  // 只顯示 active 的站區
  const activeSites = (sitesData?.data ?? []).filter(s => s.status === 'active')

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="載入站區..." />
      </div>
    )
  }

  if (activeSites.length === 0) {
    return (
      <div>
        <Title level={4}>車趟管理</Title>
        <p>目前沒有啟用的站區。</p>
      </div>
    )
  }

  const tabItems = activeSites.map(site => ({
    key: String(site.id),
    label: site.name,
    children: <SiteTripsTab siteId={site.id} siteName={site.name} />,
  }))

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>車趟管理</Title>
      <Tabs
        defaultActiveKey={String(activeSites[0]?.id)}
        items={tabItems}
        type="card"
      />
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無錯誤

**Step 3: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/pages/TripsPage.tsx
git commit -m "feat: 車趟管理改為站區 Tabs 頁籤架構"
```

---

## Phase 4: 新增行號（BusinessEntity）功能

### Task 9: 新增 BusinessEntity Prisma Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: 在 `schema.prisma` 中新增 BusinessEntity model**

在 `Site` model 之後（約第 26 行之後）加入：

```prisma
// ==================== 行號主檔 ====================
model BusinessEntity {
  id        Int      @id @default(autoincrement()) /// 自動遞增
  name      String   @unique /// 行號名稱
  taxId     String   @unique @map("tax_id") /// 統一編號
  bizItems  String?  @map("biz_items") /// 營業項目說明
  status    String   @default("active") /// 狀態：active / inactive
  createdAt DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt DateTime @updatedAt @map("updated_at") /// 更新時間

  customers  Customer[]  /// 使用此行號的客戶
  statements Statement[] /// 快照此行號的明細

  @@map("business_entities")
}
```

**Step 2: 在 Customer model 新增 `businessEntityId` 欄位**

在 `Customer` model 中（`paymentAccount` 之後、`status` 之前）加入：

```prisma
  businessEntityId Int? @map("business_entity_id") /// 開票行號
```

並在 Customer 的 relations 區塊加入：

```prisma
  businessEntity BusinessEntity? @relation(fields: [businessEntityId], references: [id])
```

**Step 3: 在 Statement model 新增 `businessEntityId` 欄位**

在 Statement model 中加入：

```prisma
  businessEntityId Int? @map("business_entity_id") /// 快照：產出明細當下的開票行號
```

並加入 relation：

```prisma
  businessEntity BusinessEntity? @relation(fields: [businessEntityId], references: [id])
```

**Step 4: 執行 Migration**

```bash
cd D:\recycling-automation-system\backend
npx prisma migrate dev --name add-business-entity
```
Expected: Migration 成功

**Step 5: Commit**

```bash
cd D:\recycling-automation-system
git add backend/prisma/
git commit -m "feat: 新增 BusinessEntity model，Customer/Statement 關聯行號"
```

---

### Task 10: 新增 BusinessEntity 後端 CRUD API

**Files:**
- Create: `backend/src/routes/business-entities.ts`
- Create: `backend/src/__tests__/business-entities.test.ts`
- Modify: `backend/src/app.ts`

**Step 1: 建立 `backend/src/routes/business-entities.ts`**

```typescript
// backend/src/routes/business-entities.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parsePagination, paginationResponse } from '../middleware/pagination'
import { asyncHandler, handlePrismaError } from '../middleware/error-handler'

const router = Router()

// GET /api/business-entities — 列表
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, skip, all } = parsePagination(req)

  if (all) {
    const entities = await prisma.businessEntity.findMany({
      where: { status: 'active' },
      orderBy: { id: 'asc' },
    })
    res.json(entities)
    return
  }

  const [entities, total] = await Promise.all([
    prisma.businessEntity.findMany({ orderBy: { id: 'asc' }, skip, take: pageSize }),
    prisma.businessEntity.count(),
  ])
  res.json(paginationResponse(entities, total, page, pageSize))
}))

// GET /api/business-entities/:id — 詳情
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const entity = await prisma.businessEntity.findUnique({
    where: { id: Number(req.params.id) },
  })
  if (!entity) {
    res.status(404).json({ error: '行號不存在' })
    return
  }
  res.json(entity)
}))

// POST /api/business-entities — 新增
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, taxId, bizItems, status } = req.body
  if (!name || !taxId) {
    res.status(400).json({ error: '行號名稱和統一編號為必填' })
    return
  }
  try {
    const entity = await prisma.businessEntity.create({
      data: { name, taxId, bizItems, status },
    })
    res.status(201).json(entity)
  } catch (e: any) {
    if (!handlePrismaError(e, res, '行號')) throw e
  }
}))

// PATCH /api/business-entities/:id — 更新
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name, taxId, bizItems, status } = req.body
  try {
    const entity = await prisma.businessEntity.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(taxId !== undefined && { taxId }),
        ...(bizItems !== undefined && { bizItems }),
        ...(status !== undefined && { status }),
      },
    })
    res.json(entity)
  } catch (e: any) {
    if (!handlePrismaError(e, res, '行號')) throw e
  }
}))

// DELETE /api/business-entities/:id — 刪除
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    await prisma.businessEntity.delete({ where: { id: Number(req.params.id) } })
    res.json({ message: '行號已刪除' })
  } catch (e: any) {
    if (!handlePrismaError(e, res, '行號')) throw e
  }
}))

export default router
```

**Step 2: 在 `backend/src/app.ts` 註冊路由**

在 import 區塊加入：
```typescript
import businessEntityRoutes from './routes/business-entities'
```

在 `app.use('/api/sync', ...)` 之後加入：
```typescript
app.use('/api/business-entities', authMiddleware as any, businessEntityRoutes)
```

**Step 3: 寫測試 `backend/src/__tests__/business-entities.test.ts`**

```typescript
import request from 'supertest'
import app from '../app'

// 使用與其他測試相同的 token 取得方式
let token: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
  token = res.body.token
})

describe('GET /api/business-entities', () => {
  it('應回傳行號列表', async () => {
    const res = await request(app)
      .get('/api/business-entities')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('pagination')
  })
})

describe('POST /api/business-entities', () => {
  it('應新增行號', async () => {
    const res = await request(app)
      .post('/api/business-entities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '測試行號', taxId: '12345678' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('測試行號')
    expect(res.body.taxId).toBe('12345678')
  })

  it('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post('/api/business-entities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '缺統編行號' })
    expect(res.status).toBe(400)
  })
})
```

**Step 4: 跑測試**

```bash
cd D:\recycling-automation-system\backend
npx jest src/__tests__/business-entities.test.ts --verbose
```
Expected: PASS

**Step 5: Commit**

```bash
cd D:\recycling-automation-system
git add backend/src/routes/business-entities.ts backend/src/__tests__/business-entities.test.ts backend/src/app.ts
git commit -m "feat: 新增行號管理 CRUD API"
```

---

### Task 11: 前端 — 行號型別、hooks、頁面

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/hooks.ts`
- Create: `frontend/src/pages/BusinessEntitiesPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`

**Step 1: 在 `frontend/src/types/index.ts` 新增型別**

在 `Site` 型別區塊之前或之後加入：

```typescript
// ==================== 行號 ====================
export interface BusinessEntity {
  id: number
  name: string
  taxId: string
  bizItems: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface BusinessEntityFormData {
  name: string
  taxId: string
  bizItems?: string | null
  status?: string
}
```

同時在 `Customer` interface 加入：
```typescript
  businessEntityId: number | null
  businessEntity?: BusinessEntity
```

在 `CustomerFormData` interface 加入：
```typescript
  businessEntityId?: number | null
```

**Step 2: 在 `frontend/src/api/hooks.ts` 新增 hooks**

在 import 中加入 `BusinessEntity, BusinessEntityFormData`。

在 hooks 檔案適當位置新增：

```typescript
// ==================== 行號 ====================

export function useBusinessEntities(params?: { page?: number; pageSize?: number; all?: boolean }) {
  return useQuery<PaginatedResponse<BusinessEntity>>({
    queryKey: ['businessEntities', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/business-entities', { params })
      return normalizePaginatedResponse<BusinessEntity>(data)
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: BusinessEntityFormData) => {
      const { data } = await apiClient.post('/business-entities', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號新增成功')
    },
    onError: () => {
      message.error('行號新增失敗')
    },
  })
}

export function useUpdateBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: BusinessEntityFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/business-entities/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號更新成功')
    },
    onError: () => {
      message.error('行號更新失敗')
    },
  })
}

export function useDeleteBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/business-entities/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號刪除成功')
    },
    onError: () => {
      message.error('行號刪除失敗')
    },
  })
}
```

**Step 3: 建立 `frontend/src/pages/BusinessEntitiesPage.tsx`**

建立標準 CRUD 頁面，模式參照 `SitesPage.tsx`（Table + Modal 新增/編輯）：

```typescript
// frontend/src/pages/BusinessEntitiesPage.tsx
import { useState } from 'react'
import { Table, Card, Button, Modal, Form, Input, Select, Space, Popconfirm, Typography, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  useBusinessEntities, useCreateBusinessEntity,
  useUpdateBusinessEntity, useDeleteBusinessEntity,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { BusinessEntity, BusinessEntityFormData } from '../types'

const { Title } = Typography

export default function BusinessEntitiesPage() {
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BusinessEntity | null>(null)
  const [form] = Form.useForm<BusinessEntityFormData>()

  const { data, isLoading } = useBusinessEntities({ page, pageSize: 20 })
  const createEntity = useCreateBusinessEntity()
  const updateEntity = useUpdateBusinessEntity()
  const deleteEntity = useDeleteBusinessEntity()

  const openModal = (entity?: BusinessEntity) => {
    if (entity) {
      setEditing(entity)
      form.setFieldsValue({
        name: entity.name,
        taxId: entity.taxId,
        bizItems: entity.bizItems,
        status: entity.status,
      })
    } else {
      setEditing(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editing) {
      await updateEntity.mutateAsync({ id: editing.id, ...values })
    } else {
      await createEntity.mutateAsync(values)
    }
    setModalOpen(false)
    form.resetFields()
    setEditing(null)
  }

  const columns = [
    { title: '行號名稱', dataIndex: 'name', key: 'name' },
    { title: '統一編號', dataIndex: 'taxId', key: 'taxId' },
    {
      title: '營業項目',
      dataIndex: 'bizItems',
      key: 'bizItems',
      responsive: ['lg' as const],
      render: (v: string | null) => v || '-',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={v === 'active' ? 'green' : 'default'}>
          {v === 'active' ? '啟用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: BusinessEntity) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除？" onConfirm={() => deleteEntity.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>行號管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新增行號</Button>
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
          showTotal: (total) => `共 ${total} 筆`,
        }}
        scroll={isMobile ? { x: 500 } : undefined}
        size={isMobile ? 'small' : 'middle'}
      />
      <Modal
        title={editing ? '編輯行號' : '新增行號'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null) }}
        confirmLoading={createEntity.isPending || updateEntity.isPending}
        width={isMobile ? '95%' : 480}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="行號名稱" rules={[{ required: true, message: '請輸入行號名稱' }]}>
            <Input placeholder="行號名稱" />
          </Form.Item>
          <Form.Item name="taxId" label="統一編號" rules={[{ required: true, message: '請輸入統一編號' }]}>
            <Input placeholder="統一編號（8碼）" maxLength={8} />
          </Form.Item>
          <Form.Item name="bizItems" label="營業項目">
            <Input.TextArea rows={3} placeholder="營業項目說明" />
          </Form.Item>
          <Form.Item name="status" label="狀態" initialValue="active">
            <Select options={[
              { value: 'active', label: '啟用' },
              { value: 'inactive', label: '停用' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

**Step 4: 在 `frontend/src/App.tsx` 加入路由**

新增 import：
```typescript
import BusinessEntitiesPage from './pages/BusinessEntitiesPage'
```

在 protected routes 中加入：
```tsx
<Route path="/business-entities" element={<ProtectedRoute><BusinessEntitiesPage /></ProtectedRoute>} />
```

**Step 5: 在 `frontend/src/components/AppLayout.tsx` 側邊選單加入入口**

在 `menuItems` 的 `basic-data` children 中加入：
```typescript
{ key: '/business-entities', icon: <FileTextOutlined />, label: '行號管理' },
```

> **注意：** 使用已有的 `FileTextOutlined` icon 或選擇其他合適的 icon（如 `BankOutlined`）。如果使用新 icon 需在頂部 import。

**Step 6: 驗證編譯**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無錯誤

**Step 7: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/types/index.ts frontend/src/api/hooks.ts frontend/src/pages/BusinessEntitiesPage.tsx frontend/src/App.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat: 新增行號管理頁面（前端 CRUD + 路由 + 側邊選單）"
```

---

### Task 12: 客戶 Modal 加入行號下拉

**Files:**
- Modify: `frontend/src/pages/CustomersPage.tsx`

**Step 1: 在 CustomersPage.tsx 加入 hook 呼叫**

在 import 區塊加入 `useBusinessEntities`。

在元件內呼叫：
```typescript
const { data: businessEntitiesData } = useBusinessEntities({ all: true })
const businessEntityOptions = (businessEntitiesData?.data ?? []).map(e => ({
  value: e.id,
  label: `${e.name}（${e.taxId}）`,
}))
```

**Step 2: 在客戶新增/編輯 Modal 的 Form 中加入下拉**

在表單的「發票與通知」區塊（`invoiceRequired` 附近）加入：

```tsx
<Form.Item name="businessEntityId" label="開票行號">
  <Select
    allowClear
    placeholder="請選擇開票行號"
    options={businessEntityOptions}
    showSearch
    optionFilterProp="label"
  />
</Form.Item>
```

**Step 3: 確認 openModal 的 `form.setFieldsValue` 有包含 `businessEntityId`**

在編輯模式設值時加入：
```typescript
businessEntityId: customer.businessEntityId,
```

**Step 4: 驗證編譯**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無錯誤

**Step 5: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/pages/CustomersPage.tsx
git commit -m "feat: 客戶 Modal 新增開票行號下拉選單"
```

---

## Phase 5: 月結車趟預覽

### Task 13: 月結頁面新增車趟預覽區塊

**Files:**
- Modify: `frontend/src/pages/StatementsPage.tsx`

**Step 1: 在 StatementsPage.tsx 加入預覽邏輯**

在 import 區塊加入 `useTrips`（如果尚未 import）。
新增 `Collapse` 或 `Descriptions` 元件的 import。

在元件內新增狀態和查詢：

```typescript
const [previewCustomerId, setPreviewCustomerId] = useState<number | undefined>()
const [previewMonth, setPreviewMonth] = useState<string | undefined>()

// 預覽用：查該客戶該月的所有車趟
const { data: previewTrips, isLoading: previewLoading } = useTrips(
  previewCustomerId && previewMonth
    ? {
        customerId: previewCustomerId,
        dateFrom: `${previewMonth}-01`,
        dateTo: dayjs(`${previewMonth}-01`).endOf('month').format('YYYY-MM-DD'),
        pageSize: 999,
      }
    : undefined,
  // 只在兩個條件都滿足時才啟用查詢
)
```

> **注意：** 需確認 `useTrips` hook 支援 `enabled` 選項或透過 `params` 為 `undefined` 時不發出請求。如果 `useTrips` 不支援 `undefined` params 作為停用條件，需要包一層 `useQuery` 的 `enabled` 邏輯。

**Step 2: 在篩選列下方、明細列表上方加入預覽區塊**

```tsx
{/* 車趟預覽 */}
{previewCustomerId && previewMonth ? (
  <Card
    title={`車趟預覽：${previewMonth}`}
    style={{ marginBottom: 16 }}
    loading={previewLoading}
    size="small"
  >
    {(previewTrips?.data ?? []).length === 0 ? (
      <p>該月無車趟紀錄</p>
    ) : (
      <>
        <p>共 {previewTrips?.data?.length ?? 0} 趟</p>
        <Table
          columns={[
            { title: '日期', dataIndex: 'tripDate', render: (v: string) => dayjs(v).format('MM/DD') },
            { title: '司機', dataIndex: 'driver' },
            { title: '車牌', dataIndex: 'vehiclePlate' },
            { title: '來源', dataIndex: 'source' },
            { title: '品項數', key: 'itemCount', render: (_: unknown, r: any) => r.items?.length ?? 0 },
          ]}
          dataSource={previewTrips?.data ?? []}
          rowKey="id"
          size="small"
          pagination={false}
          expandable={{
            expandedRowRender: (record: any) => (
              <Table
                columns={[
                  { title: '品項', render: (_: unknown, r: any) => r.item?.name ?? '-' },
                  { title: '數量', dataIndex: 'quantity', render: (v: string, r: any) => `${Number(v)} ${r.unit}` },
                  { title: '單價', dataIndex: 'unitPrice', render: (v: string) => `$${Number(v)}` },
                  { title: '方向', dataIndex: 'billingDirection' },
                  { title: '金額', dataIndex: 'amount', render: (v: string) => `$${Number(v)}` },
                ]}
                dataSource={record.items ?? []}
                rowKey="id"
                size="small"
                pagination={false}
              />
            ),
          }}
        />
      </>
    )}
  </Card>
) : (
  <Card style={{ marginBottom: 16 }} size="small">
    <p style={{ color: '#999' }}>請選擇月份和客戶以預覽車趟</p>
  </Card>
)}
```

**Step 3: 確認月份和客戶的篩選控制項會更新 `previewCustomerId` 和 `previewMonth`**

在頁面中已有的月份選擇器（`DatePicker` month mode）和客戶下拉的 `onChange` 事件中，同步設定 `setPreviewCustomerId` 和 `setPreviewMonth`。

具體需要查看 `StatementsPage.tsx` 現有的篩選邏輯，將其 `onChange` 同時更新預覽狀態。

**Step 4: 驗證編譯**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無錯誤

**Step 5: Commit**

```bash
cd D:\recycling-automation-system
git add frontend/src/pages/StatementsPage.tsx
git commit -m "feat: 月結頁面新增車趟預覽區塊"
```

---

## Phase 6: 整合驗證

### Task 14: 跑全部後端測試

**Files:** 無新增修改

**Step 1: 跑全部測試**

```bash
cd D:\recycling-automation-system\backend
npx jest --verbose
```
Expected: 全部 PASS

**Step 2: 修正任何失敗的測試**

如果有測試因為先前的修改而失敗（例如 Dashboard 測試期望舊欄位名），修正對應的測試斷言。

**Step 3: Commit（如有修正）**

```bash
cd D:\recycling-automation-system
git add -A
git commit -m "test: 修正因 API 變更而失敗的測試"
```

---

### Task 15: 前端編譯檢查 + 開發伺服器驗證

**Files:** 無新增修改

**Step 1: TypeScript 編譯檢查**

```bash
cd D:\recycling-automation-system\frontend
npx tsc --noEmit
```
Expected: 無錯誤

**Step 2: 啟動開發伺服器確認頁面可載入**

```bash
cd D:\recycling-automation-system\frontend
npm run dev -- --port 3300
```

手動或使用 Playwright 驗證：
1. `/trips` — 看到站區 Tabs
2. `/business-entities` — 看到行號管理頁面
3. `/dashboard` — 統計數字正確顯示
4. `/statements` — 預覽區塊出現

**Step 3: Commit（如有修正）**

```bash
cd D:\recycling-automation-system
git add -A
git commit -m "fix: 整合驗證修正"
```

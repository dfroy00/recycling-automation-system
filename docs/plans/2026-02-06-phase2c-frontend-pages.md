# 階段二C：前端管理介面 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作完整前端管理介面，包含應用程式外殼（Layout）、儀表板、站點管理、客戶管理、合約管理、品項管理、資料管理等頁面

**Architecture:** 使用 Ant Design Pro Layout 模式（Sider + Header + Content）。資料請求使用 TanStack Query 管理快取與狀態。所有 CRUD 頁面遵循一致的設計模式：Table + Modal Form。

**Tech Stack:** React 18, Ant Design 5.x, TanStack Query, React Router v6, Axios, dayjs

**前置條件:** 階段一 + 階段二A + 階段二B 已完成（所有 API 端點就緒）

---

### Task 1: 安裝 TanStack Query 與前端架構

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/main.tsx`（更新）
- Create: `frontend/src/hooks/useApi.ts`

**Step 1: 安裝依賴**

Run:
```bash
cd frontend
npm install @tanstack/react-query
```

**Step 2: 在 main.tsx 設定 QueryClient**

```typescript
// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 秒
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
```

**Step 3: 建立通用 API Hooks 工具**

```typescript
// frontend/src/hooks/useApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { message } from 'antd'

// 通用分頁查詢 Hook
export function usePaginatedQuery<T>(
  key: string[],
  url: string,
  params?: Record<string, any>
) {
  return useQuery({
    queryKey: [...key, params],
    queryFn: async () => {
      const res = await api.get<{ data: T[]; total: number }>(url, { params })
      return res.data
    },
  })
}

// 通用新增 Mutation
export function useCreateMutation(url: string, invalidateKeys: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post(url, data),
    onSuccess: () => {
      invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
      message.success('新增成功')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '新增失敗')
    },
  })
}

// 通用更新 Mutation
export function useUpdateMutation(url: string, invalidateKeys: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) =>
      api.put(`${url}/${id}`, data),
    onSuccess: () => {
      invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
      message.success('更新成功')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '更新失敗')
    },
  })
}
```

**Step 4: Commit**

```bash
git add frontend/src/main.tsx frontend/src/hooks/useApi.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: 設定 TanStack Query 與通用 API Hooks"
```

---

### Task 2: 應用程式外殼（Layout）

**Files:**
- Create: `frontend/src/components/AppLayout.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 建立 AppLayout 元件**

```typescript
// frontend/src/components/AppLayout.tsx
import { useState } from 'react'
import { Layout, Menu, Button, Typography, Dropdown, Avatar, theme } from 'antd'
import {
  DashboardOutlined,
  BankOutlined,
  TeamOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// 選單項目（依角色過濾在渲染時處理）
const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '儀表板' },
  { key: '/sites', icon: <BankOutlined />, label: '站點管理', roles: ['system_admin'] },
  { key: '/customers', icon: <TeamOutlined />, label: '客戶管理' },
  { key: '/item-prices', icon: <FileTextOutlined />, label: '品項管理' },
  {
    key: 'data',
    icon: <DatabaseOutlined />,
    label: '資料管理',
    children: [
      { key: '/data/import', label: '手動匯入' },
      { key: '/data/trips', label: '車趟記錄查詢' },
      { key: '/data/items', label: '品項收取查詢' },
    ],
  },
  { key: '/reports', icon: <BarChartOutlined />, label: '報表管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '系統設定', roles: ['system_admin'] },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { token: themeToken } = theme.useToken()

  // 依角色過濾選單
  const filteredItems = menuItems.filter(item => {
    if (!('roles' in item) || !item.roles) return true
    return item.roles.includes(user?.role || '')
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: `${user?.name}（${user?.role}）`, disabled: true },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '登出', danger: true },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Text strong style={{ fontSize: collapsed ? 14 : 16 }}>
            {collapsed ? '回收' : '回收業務管理'}
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['data']}
          items={filteredItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && handleLogout() }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} />
              <Text>{user?.name}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
```

**Step 2: 更新 App.tsx 使用 Layout + 嵌套路由**

```typescript
// frontend/src/App.tsx
import { ConfigProvider } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import zhTW from 'antd/locale/zh_TW'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <ConfigProvider locale={zhTW}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* 受保護的路由，使用 AppLayout 外殼 */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="sites" element={<div>站點管理（待實作）</div>} />
              <Route path="customers" element={<div>客戶管理（待實作）</div>} />
              <Route path="customers/:id/contracts" element={<div>合約管理（待實作）</div>} />
              <Route path="item-prices" element={<div>品項管理（待實作）</div>} />
              <Route path="data/import" element={<div>手動匯入（待實作）</div>} />
              <Route path="data/trips" element={<div>車趟查詢（待實作）</div>} />
              <Route path="data/items" element={<div>品項查詢（待實作）</div>} />
              <Route path="reports" element={<div>報表管理（待實作）</div>} />
              <Route path="settings" element={<div>系統設定（待實作）</div>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
```

**Step 3: 驗證 Layout 正常顯示**

啟動前後端，登入後應看到：左側 Sidebar 選單、頂部 Header、中間 Content 區域。

**Step 4: Commit**

```bash
git add frontend/src/components/AppLayout.tsx frontend/src/App.tsx
git commit -m "feat: 實作應用程式外殼 (Sidebar + Header + Content Layout)"
```

---

### Task 3: 儀表板頁面

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Step 1: 實作儀表板頁面**

```typescript
// frontend/src/pages/DashboardPage.tsx
import { Card, Col, Row, Statistic, Table, Tag, Typography, Space } from 'antd'
import {
  CarOutlined,
  InboxOutlined,
  AlertOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

interface DashboardStats {
  todayTrips: number
  todayItems: number
  monthTrips: number
  pendingStatements: number
  expiringContracts: {
    customerId: string
    customerName: string
    siteId: string
    itemName: string
    endDate: string
    daysLeft: number
  }[]
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    refetchInterval: 60 * 1000, // 每分鐘刷新
  })

  // 合約到期表格欄位
  const contractColumns = [
    { title: '客戶', dataIndex: 'customerName', key: 'customerName' },
    { title: '站點', dataIndex: 'siteId', key: 'siteId' },
    { title: '品項', dataIndex: 'itemName', key: 'itemName' },
    {
      title: '到期日',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '剩餘天數',
      dataIndex: 'daysLeft',
      key: 'daysLeft',
      render: (days: number) => {
        let color = 'green'
        if (days <= 7) color = 'red'
        else if (days <= 15) color = 'orange'
        else if (days <= 30) color = 'gold'
        return <Tag color={color}>{days} 天</Tag>
      },
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={4}>儀表板</Title>

      {/* 統計卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日匯入車趟"
              value={stats?.todayTrips || 0}
              prefix={<CarOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日匯入品項"
              value={stats?.todayItems || 0}
              prefix={<InboxOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月車趟總數"
              value={stats?.monthTrips || 0}
              prefix={<CarOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待發送明細"
              value={stats?.pendingStatements || 0}
              prefix={<FileTextOutlined />}
              loading={isLoading}
              valueStyle={stats?.pendingStatements ? { color: '#faad14' } : undefined}
            />
          </Card>
        </Col>
      </Row>

      {/* 即將到期合約 */}
      <Card title={
        <Space>
          <AlertOutlined style={{ color: '#ff4d4f' }} />
          即將到期合約（30 天內）
        </Space>
      }>
        <Table
          columns={contractColumns}
          dataSource={stats?.expiringContracts || []}
          rowKey={(r) => `${r.customerId}-${r.itemName}`}
          loading={isLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: '無即將到期的合約' }}
        />
      </Card>
    </Space>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: 實作儀表板頁面 (統計卡片 + 到期合約列表)"
```

---

### Task 4: 站點管理頁面

**Files:**
- Create: `frontend/src/pages/SitesPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 實作站點管理頁面**

```typescript
// frontend/src/pages/SitesPage.tsx
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Space, Typography, Tag } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const { Title } = Typography

interface Site {
  siteId: string
  siteName: string
  manager: string | null
  contactPhone: string | null
  contactEmail: string | null
  status: string
}

export default function SitesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<Site[]>('/sites').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/sites', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); setModalOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/sites/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); setModalOpen(false) },
  })

  const openCreate = () => {
    setEditingSite(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (site: Site) => {
    setEditingSite(site)
    form.setFieldsValue(site)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingSite) {
      updateMutation.mutate({ id: editingSite.siteId, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    { title: '站點編號', dataIndex: 'siteId', key: 'siteId' },
    { title: '站點名稱', dataIndex: 'siteName', key: 'siteName' },
    { title: '負責人', dataIndex: 'manager', key: 'manager' },
    { title: '聯絡電話', dataIndex: 'contactPhone', key: 'contactPhone' },
    { title: 'Email', dataIndex: 'contactEmail', key: 'contactEmail' },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === '啟用' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Site) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
          編輯
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>站點管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增站點</Button>
      </div>

      <Table
        columns={columns}
        dataSource={sites}
        rowKey="siteId"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editingSite ? '編輯站點' : '新增站點'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          {!editingSite && (
            <Form.Item name="siteId" label="站點編號" rules={[{ required: true }]}>
              <Input placeholder="例：S008" />
            </Form.Item>
          )}
          <Form.Item name="siteName" label="站點名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="manager" label="負責人">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="聯絡電話">
            <Input />
          </Form.Item>
          <Form.Item name="contactEmail" label="Email">
            <Input type="email" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
```

**Step 2: 在 App.tsx 替換佔位路由**

```typescript
import SitesPage from './pages/SitesPage'

// 替換 <Route path="sites" element={<div>...</div>} />
<Route path="sites" element={<SitesPage />} />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/SitesPage.tsx frontend/src/App.tsx
git commit -m "feat: 實作站點管理頁面 (Table + CRUD Modal)"
```

---

### Task 5: 客戶管理頁面

**Files:**
- Create: `frontend/src/pages/CustomersPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 實作客戶管理頁面**

```typescript
// frontend/src/pages/CustomersPage.tsx
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, Typography, Tag, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const { Title } = Typography

const BILLING_TYPES = [
  { value: 'A', label: 'A - 回收物 + 車趟費' },
  { value: 'B', label: 'B - 僅車趟費' },
  { value: 'C', label: 'C - 合約混合計價' },
  { value: 'D', label: 'D - 全牌價' },
]

const NOTIFICATION_METHODS = [
  { value: 'Email', label: 'Email' },
  { value: 'LINE', label: 'LINE' },
  { value: 'Both', label: 'Email + LINE' },
]

export default function CustomersPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 })
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => api.get('/customers', { params: filters }).then(r => r.data),
  })

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  })
  const sites = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/customers', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setModalOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: any }) => api.put(`/customers/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setModalOpen(false) },
  })

  const billingType = Form.useWatch('billingType', form)

  const columns = [
    { title: '客戶編號', dataIndex: 'customerId', key: 'customerId', width: 100 },
    { title: '客戶名稱', dataIndex: 'customerName', key: 'customerName' },
    { title: '站點', dataIndex: ['site', 'siteName'], key: 'site', width: 80 },
    {
      title: '計費類型',
      dataIndex: 'billingType',
      key: 'billingType',
      width: 80,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '車趟費',
      dataIndex: 'tripPrice',
      key: 'tripPrice',
      width: 80,
      render: (v: number) => v ? `$${v}` : '-',
    },
    { title: '通知方式', dataIndex: 'notificationMethod', key: 'notificationMethod', width: 100 },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 60,
      render: (s: string) => <Tag color={s === '啟用' ? 'green' : 'default'}>{s}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(record)
            form.setFieldsValue(record)
            setModalOpen(true)
          }}>編輯</Button>
          {record.billingType === 'C' && (
            <Button type="link" size="small" icon={<FileTextOutlined />}
              onClick={() => navigate(`/customers/${record.customerId}/contracts`)}>
              合約
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>客戶管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditing(null); form.resetFields(); setModalOpen(true)
        }}>新增客戶</Button>
      </div>

      {/* 篩選列 */}
      <Row gutter={16}>
        <Col span={6}>
          <Select placeholder="篩選站點" allowClear style={{ width: '100%' }}
            onChange={v => setFilters((f: any) => ({ ...f, siteId: v, page: 1 }))}>
            {sites.map((s: any) => (
              <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Select placeholder="篩選計費類型" allowClear style={{ width: '100%' }}
            onChange={v => setFilters((f: any) => ({ ...f, billingType: v, page: 1 }))}>
            {BILLING_TYPES.map(t => (
              <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Input.Search placeholder="搜尋客戶" allowClear
            onSearch={v => setFilters((f: any) => ({ ...f, search: v, page: 1 }))} />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={data?.data}
        rowKey="customerId"
        loading={isLoading}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total: data?.total,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })),
          showTotal: (total) => `共 ${total} 筆`,
        }}
        size="small"
      />

      <Modal
        title={editing ? '編輯客戶' : '新增客戶'}
        open={modalOpen}
        onOk={async () => {
          const values = await form.validateFields()
          if (editing) {
            updateMutation.mutate({ id: editing.customerId, data: values })
          } else {
            createMutation.mutate(values)
          }
        }}
        onCancel={() => setModalOpen(false)}
        width={600}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              {!editing && (
                <Form.Item name="customerId" label="客戶編號" rules={[{ required: true }]}>
                  <Input placeholder="例：C005" />
                </Form.Item>
              )}
              <Form.Item name="customerName" label="客戶名稱" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="siteId" label="所屬站點" rules={[{ required: true }]}>
                <Select>
                  {sites.map((s: any) => (
                    <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="billingType" label="計費類型" rules={[{ required: true }]}>
                <Select options={BILLING_TYPES} />
              </Form.Item>
              {(billingType === 'A' || billingType === 'B') && (
                <Form.Item name="tripPrice" label="單次車趟費">
                  <InputNumber min={0} style={{ width: '100%' }} addonAfter="元" />
                </Form.Item>
              )}
              <Form.Item name="notificationMethod" label="通知方式">
                <Select options={NOTIFICATION_METHODS} />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input type="email" />
              </Form.Item>
              <Form.Item name="lineId" label="LINE ID">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  )
}
```

**Step 2: 在 App.tsx 替換佔位路由**

```typescript
import CustomersPage from './pages/CustomersPage'
<Route path="customers" element={<CustomersPage />} />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/CustomersPage.tsx frontend/src/App.tsx
git commit -m "feat: 實作客戶管理頁面 (Table + CRUD + 篩選 + 分頁)"
```

---

### Task 6: 合約管理、品項管理、資料管理頁面

此 Task 包含多個頁面，每個頁面遵循與 Task 4/5 相同的 **Table + Modal Form** 設計模式。

**Files:**
- Create: `frontend/src/pages/ContractsPage.tsx`
- Create: `frontend/src/pages/ItemPricesPage.tsx`
- Create: `frontend/src/pages/DataImportPage.tsx`
- Create: `frontend/src/pages/TripQueryPage.tsx`
- Create: `frontend/src/pages/ItemQueryPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 合約管理頁面**

```typescript
// frontend/src/pages/ContractsPage.tsx
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Space, Typography, Tag } from 'antd'
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function ContractsPage() {
  const { id: customerId } = useParams<{ id: string }>()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => api.get(`/customers/${customerId}/contracts`).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post(`/customers/${customerId}/contracts`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts', customerId] }); setModalOpen(false) },
  })

  const columns = [
    { title: '品項名稱', dataIndex: 'itemName', key: 'itemName' },
    { title: '合約單價', dataIndex: 'contractPrice', key: 'contractPrice', render: (v: number) => `$${v}/kg` },
    { title: '起始日', dataIndex: 'startDate', key: 'startDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    {
      title: '結束日', dataIndex: 'endDate', key: 'endDate',
      render: (d: string) => {
        const end = dayjs(d)
        const isExpiring = end.diff(dayjs(), 'day') <= 30
        return <Text type={isExpiring ? 'danger' : undefined}>{end.format('YYYY-MM-DD')}</Text>
      },
    },
    {
      title: '狀態', key: 'status',
      render: (_: any, r: any) => {
        const daysLeft = dayjs(r.endDate).diff(dayjs(), 'day')
        if (daysLeft < 0) return <Tag color="red">已到期</Tag>
        if (daysLeft <= 7) return <Tag color="orange">{daysLeft} 天後到期</Tag>
        return <Tag color="green">有效</Tag>
      },
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>返回客戶列表</Button>
        <Title level={4} style={{ margin: 0 }}>合約管理 - {customerId}</Title>
      </Space>

      <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true) }}>
        新增合約品項
      </Button>

      <Table columns={columns} dataSource={contracts} rowKey="contractPriceId" loading={isLoading} pagination={false} />

      <Modal title="新增合約品項" open={modalOpen} onOk={async () => {
        const values = await form.validateFields()
        createMutation.mutate({
          ...values,
          startDate: values.startDate.format('YYYY-MM-DD'),
          endDate: values.endDate.format('YYYY-MM-DD'),
        })
      }} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="itemName" label="品項名稱" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contractPrice" label="合約單價" rules={[{ required: true }]}><InputNumber min={0} addonAfter="元/kg" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="startDate" label="起始日" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="endDate" label="結束日" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
```

**Step 2: 品項單價管理頁面**

```typescript
// frontend/src/pages/ItemPricesPage.tsx
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Space, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

export default function ItemPricesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [adjustModal, setAdjustModal] = useState<any>(null)
  const [form] = Form.useForm()
  const [adjustForm] = Form.useForm()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['item-prices'],
    queryFn: () => api.get('/item-prices').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/item-prices', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['item-prices'] }); setModalOpen(false) },
  })

  const adjustMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: any }) => api.put(`/item-prices/${id}/adjust`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['item-prices'] }); setAdjustModal(null) },
  })

  const columns = [
    { title: '品項名稱', dataIndex: 'itemName', key: 'itemName' },
    { title: '牌價（元/kg）', dataIndex: 'standardPrice', key: 'standardPrice', render: (v: number) => `$${v}` },
    { title: '生效日期', dataIndex: 'effectiveDate', key: 'effectiveDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => { setAdjustModal(record); adjustForm.resetFields() }}>調整單價</Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>品項單價管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true) }}>新增品項</Button>
      </div>

      <Table columns={columns} dataSource={data?.data} rowKey="itemPriceId" loading={isLoading} pagination={false} />

      {/* 新增品項 Modal */}
      <Modal title="新增品項" open={modalOpen} onOk={async () => {
        const values = await form.validateFields()
        createMutation.mutate({ ...values, effectiveDate: values.effectiveDate.format('YYYY-MM-DD') })
      }} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="itemName" label="品項名稱" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="standardPrice" label="牌價" rules={[{ required: true }]}><InputNumber min={0} addonAfter="元/kg" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effectiveDate" label="生效日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      {/* 調整單價 Modal */}
      <Modal title={`調整 ${adjustModal?.itemName} 單價`} open={!!adjustModal} onOk={async () => {
        const values = await adjustForm.validateFields()
        adjustMutation.mutate({ id: adjustModal.itemPriceId, data: { ...values, effectiveDate: values.effectiveDate.format('YYYY-MM-DD') } })
      }} onCancel={() => setAdjustModal(null)}>
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="newPrice" label="新單價" rules={[{ required: true }]}><InputNumber min={0} addonAfter="元/kg" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effectiveDate" label="生效日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
```

**Step 3: 手動匯入頁面**

```typescript
// frontend/src/pages/DataImportPage.tsx
import { useState } from 'react'
import { Card, Upload, Button, Select, Space, Typography, Alert, Table, message } from 'antd'
import { UploadOutlined, InboxOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const { Title } = Typography
const { Dragger } = Upload

export default function DataImportPage() {
  const [siteId, setSiteId] = useState<string>('')
  const [importResult, setImportResult] = useState<any>(null)

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  })
  const sites = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const uploadProps = (type: 'trips' | 'items') => ({
    name: 'file',
    action: `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/import/${type}`,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    data: { siteId },
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: () => {
      if (!siteId) {
        message.warning('請先選擇站點')
        return false
      }
      return true
    },
    onChange: (info: any) => {
      if (info.file.status === 'done') {
        setImportResult(info.file.response)
        message.success(`匯入完成：${info.file.response.imported}/${info.file.response.total} 筆成功`)
      } else if (info.file.status === 'error') {
        message.error('匯入失敗')
      }
    },
  })

  const errorColumns = [
    { title: '行號', dataIndex: 'row', key: 'row', width: 80 },
    { title: '錯誤訊息', dataIndex: 'messages', key: 'messages', render: (msgs: string[]) => msgs.join('; ') },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={4}>手動匯入</Title>

      <Select placeholder="選擇站點" style={{ width: 300 }} value={siteId || undefined} onChange={setSiteId}>
        {sites.map((s: any) => <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>)}
      </Select>

      <div style={{ display: 'flex', gap: 24 }}>
        <Card title="車趟資料匯入" style={{ flex: 1 }}>
          <Dragger {...uploadProps('trips')}>
            <p><InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} /></p>
            <p>點擊或拖曳車機 Excel 檔案</p>
            <p style={{ color: '#999' }}>支援 .xlsx / .xls 格式</p>
          </Dragger>
        </Card>

        <Card title="品項資料匯入" style={{ flex: 1 }}>
          <Dragger {...uploadProps('items')}>
            <p><InboxOutlined style={{ fontSize: 48, color: '#52c41a' }} /></p>
            <p>點擊或拖曳 ERP 品項 Excel 檔案</p>
            <p style={{ color: '#999' }}>支援 .xlsx / .xls 格式</p>
          </Dragger>
        </Card>
      </div>

      {importResult && (
        <Card title="匯入結果">
          <Alert
            type={importResult.errors?.length > 0 ? 'warning' : 'success'}
            message={`共 ${importResult.total} 筆，成功 ${importResult.imported} 筆，失敗 ${importResult.errors?.length || 0} 筆`}
            style={{ marginBottom: 16 }}
          />
          {importResult.errors?.length > 0 && (
            <Table columns={errorColumns} dataSource={importResult.errors} rowKey="row" size="small" pagination={false} />
          )}
        </Card>
      )}
    </Space>
  )
}
```

**Step 4: 車趟查詢與品項查詢頁面**

這兩個頁面結構幾乎相同：篩選列 + 資料表格 + 分頁。

```typescript
// frontend/src/pages/TripQueryPage.tsx
import { useState } from 'react'
import { Table, DatePicker, Select, Input, Space, Typography, Row, Col } from 'antd'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function TripQueryPage() {
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 })

  const { data: sitesData } = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/sites').then(r => r.data) })
  const sites = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const { data, isLoading } = useQuery({
    queryKey: ['data-trips', filters],
    queryFn: () => api.get('/data/trips', { params: filters }).then(r => r.data),
  })

  const columns = [
    { title: '日期', dataIndex: 'tripDate', key: 'tripDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    { title: '時間', dataIndex: 'tripTime', key: 'tripTime', render: (d: string) => dayjs(d).format('HH:mm') },
    { title: '客戶', dataIndex: ['customer', 'customerName'], key: 'customer' },
    { title: '客戶編號', dataIndex: 'customerId', key: 'customerId' },
    { title: '司機', dataIndex: 'driver', key: 'driver' },
    { title: '車牌', dataIndex: 'vehiclePlate', key: 'vehiclePlate' },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4}>車趟記錄查詢</Title>
      <Row gutter={16}>
        <Col span={6}>
          <RangePicker style={{ width: '100%' }} onChange={(dates) => {
            if (dates) {
              setFilters((f: any) => ({ ...f, startDate: dates[0]?.format('YYYY-MM-DD'), endDate: dates[1]?.format('YYYY-MM-DD'), page: 1 }))
            } else {
              setFilters((f: any) => { const { startDate, endDate, ...rest } = f; return { ...rest, page: 1 } })
            }
          }} />
        </Col>
        <Col span={4}>
          <Select placeholder="站點" allowClear style={{ width: '100%' }} onChange={v => setFilters((f: any) => ({ ...f, siteId: v, page: 1 }))}>
            {sites.map((s: any) => <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>)}
          </Select>
        </Col>
        <Col span={4}>
          <Input.Search placeholder="客戶編號" allowClear onSearch={v => setFilters((f: any) => ({ ...f, customerId: v, page: 1 }))} />
        </Col>
        <Col span={4}>
          <Input.Search placeholder="司機" allowClear onSearch={v => setFilters((f: any) => ({ ...f, driver: v, page: 1 }))} />
        </Col>
      </Row>
      <Table columns={columns} dataSource={data?.data} rowKey="tripId" loading={isLoading}
        pagination={{ current: filters.page, pageSize: filters.pageSize, total: data?.total,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })),
          showTotal: (total) => `共 ${total} 筆` }} size="small" />
    </Space>
  )
}
```

```typescript
// frontend/src/pages/ItemQueryPage.tsx
// 結構與 TripQueryPage 相同，差異在：
// - API: /data/items
// - 欄位：日期、客戶、品項名稱、重量(kg)
// - 篩選：日期區間、站點、客戶、品項
// - 底部顯示 stats.totalWeight 和 stats.avgWeight
// 請參照 TripQueryPage 的模式實作，替換欄位和 API 路徑即可
import { useState } from 'react'
import { Table, DatePicker, Select, Input, Space, Typography, Row, Col, Statistic, Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ItemQueryPage() {
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 })

  const { data: sitesData } = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/sites').then(r => r.data) })
  const sites = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const { data, isLoading } = useQuery({
    queryKey: ['data-items', filters],
    queryFn: () => api.get('/data/items', { params: filters }).then(r => r.data),
  })

  const columns = [
    { title: '日期', dataIndex: 'collectionDate', key: 'collectionDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    { title: '客戶', dataIndex: ['customer', 'customerName'], key: 'customer' },
    { title: '客戶編號', dataIndex: 'customerId', key: 'customerId' },
    { title: '品項', dataIndex: 'itemName', key: 'itemName' },
    { title: '重量(kg)', dataIndex: 'weightKg', key: 'weightKg', render: (v: number) => Number(v).toFixed(1) },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4}>品項收取查詢</Title>
      <Row gutter={16}>
        <Col span={6}>
          <RangePicker style={{ width: '100%' }} onChange={(dates) => {
            if (dates) {
              setFilters((f: any) => ({ ...f, startDate: dates[0]?.format('YYYY-MM-DD'), endDate: dates[1]?.format('YYYY-MM-DD'), page: 1 }))
            } else {
              setFilters((f: any) => { const { startDate, endDate, ...rest } = f; return { ...rest, page: 1 } })
            }
          }} />
        </Col>
        <Col span={4}>
          <Select placeholder="站點" allowClear style={{ width: '100%' }} onChange={v => setFilters((f: any) => ({ ...f, siteId: v, page: 1 }))}>
            {sites.map((s: any) => <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>)}
          </Select>
        </Col>
        <Col span={4}>
          <Input.Search placeholder="品項名稱" allowClear onSearch={v => setFilters((f: any) => ({ ...f, itemName: v, page: 1 }))} />
        </Col>
      </Row>

      {data?.stats && (
        <Row gutter={16}>
          <Col span={6}><Card><Statistic title="總重量" value={Number(data.stats.totalWeight).toFixed(1)} suffix="kg" /></Card></Col>
          <Col span={6}><Card><Statistic title="平均重量" value={Number(data.stats.avgWeight).toFixed(1)} suffix="kg" /></Card></Col>
        </Row>
      )}

      <Table columns={columns} dataSource={data?.data} rowKey="collectionId" loading={isLoading}
        pagination={{ current: filters.page, pageSize: filters.pageSize, total: data?.total,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })),
          showTotal: (total) => `共 ${total} 筆` }} size="small" />
    </Space>
  )
}
```

**Step 5: 更新 App.tsx 掛載所有頁面**

```typescript
// 在 App.tsx 匯入所有頁面
import ContractsPage from './pages/ContractsPage'
import ItemPricesPage from './pages/ItemPricesPage'
import DataImportPage from './pages/DataImportPage'
import TripQueryPage from './pages/TripQueryPage'
import ItemQueryPage from './pages/ItemQueryPage'

// 替換所有佔位路由
<Route path="customers/:id/contracts" element={<ContractsPage />} />
<Route path="item-prices" element={<ItemPricesPage />} />
<Route path="data/import" element={<DataImportPage />} />
<Route path="data/trips" element={<TripQueryPage />} />
<Route path="data/items" element={<ItemQueryPage />} />
```

**Step 6: Commit**

```bash
git add frontend/src/pages/ContractsPage.tsx frontend/src/pages/ItemPricesPage.tsx frontend/src/pages/DataImportPage.tsx frontend/src/pages/TripQueryPage.tsx frontend/src/pages/ItemQueryPage.tsx frontend/src/App.tsx
git commit -m "feat: 實作合約管理、品項管理、資料管理頁面"
```

---

### Task 7: 整合驗證

**Step 1: 啟動完整系統**

1. `docker compose ps` — 確認 PostgreSQL 運行中
2. `cd backend && npm run dev` — 啟動後端
3. `cd frontend && npm run dev -- --port 5173` — 啟動前端

**Step 2: 手動測試所有頁面**

- 登入（admin / admin123）
- 儀表板：統計卡片顯示數據、到期合約列表
- 站點管理：查看 7 站點、新增/編輯
- 客戶管理：篩選、搜尋、新增/編輯客戶、導航到合約
- 合約管理：C 類客戶合約品項列表、新增品項
- 品項管理：品項列表、新增品項、調整單價
- 手動匯入：選擇站點、上傳車趟/品項 Excel
- 車趟查詢：日期篩選、分頁
- 品項查詢：統計數據（總重量、平均重量）

**Step 3: 執行所有後端測試**

Run: `cd backend && npm test`
Expected: 所有測試通過

**Step 4: 最終 Commit**

```bash
git commit -m "chore: 階段二完成 - 匯入模組 + 計費引擎 + 管理介面"
```

---

## 階段二 完成標準

### 後端
- [x] Excel 解析（車機 + ERP）
- [x] 資料驗證（客戶、品項、重量）
- [x] 匯入 API + 檔案監控
- [x] 計費引擎（A/B/C/D 四種類型）
- [x] 月結明細計算
- [x] 金額異常偵測
- [x] 客戶 CRUD API
- [x] 合約管理 API
- [x] 品項單價 API
- [x] 資料查詢/修正 API
- [x] 儀表板統計 API

### 前端
- [x] AppLayout（Sidebar + Header）
- [x] 儀表板頁面
- [x] 站點管理頁面
- [x] 客戶管理頁面（含篩選、搜尋、分頁）
- [x] 合約管理頁面
- [x] 品項單價管理頁面
- [x] 手動匯入頁面
- [x] 車趟查詢頁面
- [x] 品項查詢頁面

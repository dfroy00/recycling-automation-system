// 系統設定頁面 - 排程設定、使用者管理、系統日誌
import { useState } from 'react'
import {
  Tabs, Table, Button, Space, Typography, Tag, Input, Select, Modal, Form,
  message, Row, Col, Card, Descriptions, Switch,
} from 'antd'
import {
  UserOutlined, ClockCircleOutlined, FileSearchOutlined,
  PlusOutlined, EditOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

// ===== 排程設定 Tab =====
function ScheduleTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['schedule-status'],
    queryFn: () => api.get('/schedule/status').then(r => r.data),
  })

  const scheduleLabels: Record<string, string> = {
    fileWatch: '檔案監控',
    dataIntegrity: '資料完整性檢查',
    contractScan: '合約到期掃描',
    monthlyBilling: '月結自動流程',
    invoice: '發票自動流程',
    retryNotification: '通知重試',
  }

  const scheduleCronDesc: Record<string, string> = {
    fileWatch: '每小時執行',
    dataIntegrity: '每日 23:00',
    contractScan: '每日 10:00',
    monthlyBilling: '每月 30 號 09:00',
    invoice: '每月 15 號 09:00',
    retryNotification: '每日 09:00',
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small">
        <Descriptions title="排程狀態" bordered column={1}>
          <Descriptions.Item label="排程引擎">
            {data?.schedulerEnabled
              ? <Tag color="green">已啟用</Tag>
              : <Tag color="red">已停用</Tag>
            }
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="排程任務" size="small" loading={isLoading}>
        <Table
          dataSource={data?.schedules ? Object.entries(data.schedules).map(([key, cron]) => ({
            key,
            name: scheduleLabels[key] || key,
            cron: cron as string,
            description: scheduleCronDesc[key] || '',
          })) : []}
          columns={[
            { title: '任務名稱', dataIndex: 'name', key: 'name' },
            { title: 'Cron 表達式', dataIndex: 'cron', key: 'cron', render: (v: string) => <code>{v}</code> },
            { title: '說明', dataIndex: 'description', key: 'description' },
          ]}
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="最近排程執行記錄" size="small">
        <Table
          dataSource={data?.recentLogs || []}
          columns={[
            {
              title: '時間', dataIndex: 'createdAt', key: 'time', width: 180,
              render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm:ss'),
            },
            { title: '內容', dataIndex: 'eventContent', key: 'content' },
          ]}
          rowKey="logId"
          pagination={false}
          size="small"
        />
      </Card>
    </Space>
  )
}

// ===== 使用者管理 Tab =====
function UsersTab() {
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => api.get('/users', { params: filters }).then(r => r.data),
  })

  // 取得站點清單（供下拉選擇）
  const { data: sites } = useQuery({
    queryKey: ['sites-list'],
    queryFn: () => api.get('/sites').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/users', values),
    onSuccess: () => {
      message.success('使用者已新增')
      setModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => message.error(err.response?.data?.message || '新增失敗'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...values }: any) => api.put(`/users/${id}`, values),
    onSuccess: () => {
      message.success('使用者已更新')
      setModalOpen(false)
      setEditingUser(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => message.error(err.response?.data?.message || '更新失敗'),
  })

  const openCreateModal = () => {
    setEditingUser(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEditModal = (user: any) => {
    setEditingUser(user)
    form.setFieldsValue({
      ...user,
      password: '', // 不顯示密碼
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingUser) {
      // 編輯模式：空密碼表示不修改
      if (!values.password) delete values.password
      updateMutation.mutate({ id: editingUser.userId, ...values })
    } else {
      createMutation.mutate(values)
    }
  }

  const roleColors: Record<string, string> = {
    system_admin: 'red',
    site_admin: 'blue',
    finance: 'green',
    sales: 'orange',
  }

  const roleLabels: Record<string, string> = {
    system_admin: '系統管理員',
    site_admin: '站點管理員',
    finance: '財務人員',
    sales: '業務人員',
  }

  const columns = [
    { title: '帳號', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    {
      title: '角色', dataIndex: 'role', key: 'role',
      render: (r: string) => <Tag color={roleColors[r] || 'default'}>{roleLabels[r] || r}</Tag>,
    },
    {
      title: '站點', key: 'site',
      render: (_: any, record: any) => record.site?.siteName || '-',
    },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v: string) => v || '-' },
    {
      title: '狀態', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={s === '啟用' ? 'green' : 'default'}>{s}</Tag>,
    },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
          編輯
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Row gutter={16}>
          <Col>
            <Select placeholder="角色" allowClear style={{ width: 150 }}
              onChange={v => setFilters((f: any) => ({ ...f, role: v, page: 1 }))}>
              <Select.Option value="system_admin">系統管理員</Select.Option>
              <Select.Option value="site_admin">站點管理員</Select.Option>
              <Select.Option value="finance">財務人員</Select.Option>
              <Select.Option value="sales">業務人員</Select.Option>
            </Select>
          </Col>
        </Row>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新增使用者</Button>
      </div>

      <Table
        columns={columns}
        dataSource={data?.data}
        rowKey="userId"
        loading={isLoading}
        pagination={{
          current: filters.page, pageSize: filters.pageSize, total: data?.total,
          showTotal: (total: number) => `共 ${total} 筆`,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })),
        }}
        size="small"
      />

      <Modal
        title={editingUser ? '編輯使用者' : '新增使用者'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingUser(null) }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="帳號"
            rules={[{ required: !editingUser, message: '請輸入帳號' }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="password" label={editingUser ? '新密碼（留空不修改）' : '密碼'}
            rules={editingUser ? [] : [{ required: true, message: '請輸入密碼' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '請輸入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '請選擇角色' }]}>
            <Select>
              <Select.Option value="system_admin">系統管理員</Select.Option>
              <Select.Option value="site_admin">站點管理員</Select.Option>
              <Select.Option value="finance">財務人員</Select.Option>
              <Select.Option value="sales">業務人員</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="siteId" label="所屬站點">
            <Select allowClear placeholder="選擇站點（系統管理員可不選）">
              {(Array.isArray(sites) ? sites : []).map((s: any) => (
                <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          {editingUser && (
            <Form.Item name="status" label="狀態" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="啟用">啟用</Select.Option>
                <Select.Option value="停用">停用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Space>
  )
}

// ===== 系統日誌 Tab =====
function SystemLogsTab() {
  const [filters, setFilters] = useState<any>({ eventType: '', page: 1, pageSize: 50 })

  const { data, isLoading } = useQuery({
    queryKey: ['system-logs', filters],
    queryFn: () => api.get('/schedule/logs', { params: filters }).then(r => r.data),
  })

  const columns = [
    {
      title: '時間', dataIndex: 'createdAt', key: 'time', width: 180,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '類型', dataIndex: 'eventType', key: 'type', width: 100,
      render: (t: string) => {
        const colors: Record<string, string> = {
          schedule: 'blue', import: 'green', send: 'purple', error: 'red',
        }
        return <Tag color={colors[t] || 'default'}>{t}</Tag>
      },
    },
    {
      title: '站點', dataIndex: 'siteId', key: 'site', width: 80,
      render: (v: string) => v || '-',
    },
    { title: '內容', dataIndex: 'eventContent', key: 'content' },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Select placeholder="事件類型" allowClear style={{ width: '100%' }}
            value={filters.eventType || undefined}
            onChange={v => setFilters((f: any) => ({ ...f, eventType: v || '', page: 1 }))}>
            <Select.Option value="schedule">排程</Select.Option>
            <Select.Option value="import">匯入</Select.Option>
            <Select.Option value="send">發送</Select.Option>
            <Select.Option value="error">錯誤</Select.Option>
          </Select>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={data?.data}
        rowKey="logId"
        loading={isLoading}
        pagination={{
          current: filters.page, pageSize: filters.pageSize, total: data?.total,
          showTotal: (total: number) => `共 ${total} 筆`,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })),
        }}
        size="small"
      />
    </Space>
  )
}

// ===== 主元件 =====
export default function SettingsPage() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>系統設定</Title>
      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: <span><UserOutlined /> 使用者管理</span>,
            children: <UsersTab />,
          },
          {
            key: 'schedule',
            label: <span><ClockCircleOutlined /> 排程設定</span>,
            children: <ScheduleTab />,
          },
          {
            key: 'logs',
            label: <span><FileSearchOutlined /> 系統日誌</span>,
            children: <SystemLogsTab />,
          },
        ]}
      />
    </Space>
  )
}

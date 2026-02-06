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

interface Customer {
  customerId: string
  customerName: string
  siteId: string
  billingType: string
  tripPrice: number | null
  notificationMethod: string | null
  email: string | null
  lineId: string | null
  status: string
  site?: { siteName: string }
}

interface SiteItem {
  siteId: string
  siteName: string
}

export default function CustomersPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [filters, setFilters] = useState<Record<string, unknown>>({ page: 1, pageSize: 20 })
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
  const sites: SiteItem[] = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const createMutation = useMutation({
    mutationFn: (d: Partial<Customer>) => api.post('/customers', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setModalOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Partial<Customer> }) => api.put(`/customers/${id}`, d),
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
      render: (_: unknown, record: Customer) => (
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
            onChange={(v: string) => setFilters(f => ({ ...f, siteId: v, page: 1 }))}>
            {sites.map(s => (
              <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Select placeholder="篩選計費類型" allowClear style={{ width: '100%' }}
            onChange={(v: string) => setFilters(f => ({ ...f, billingType: v, page: 1 }))}>
            {BILLING_TYPES.map(t => (
              <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Input.Search placeholder="搜尋客戶" allowClear
            onSearch={(v: string) => setFilters(f => ({ ...f, search: v, page: 1 }))} />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={(data as { data: Customer[]; total: number })?.data}
        rowKey="customerId"
        loading={isLoading}
        pagination={{
          current: filters.page as number,
          pageSize: filters.pageSize as number,
          total: (data as { data: Customer[]; total: number })?.total,
          onChange: (page, pageSize) => setFilters(f => ({ ...f, page, pageSize })),
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
                  {sites.map(s => (
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

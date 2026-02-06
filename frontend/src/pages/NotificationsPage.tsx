// frontend/src/pages/NotificationsPage.tsx
import { useState } from 'react'
import { Table, Button, Space, Typography, Tag, Input, Select, Modal, Form, message, Row, Col } from 'antd'
import { SendOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

export default function NotificationsPage() {
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 })
  const [previewModal, setPreviewModal] = useState(false)
  const [previewForm] = Form.useForm()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notification-logs', filters],
    queryFn: () => api.get('/notifications/logs', { params: filters }).then(r => r.data),
  })

  const sendMutation = useMutation({
    mutationFn: (yearMonth: string) => api.post('/notifications/send', { yearMonth }),
    onSuccess: (res) => {
      message.success(`發送完成：${res.data.success}/${res.data.total} 成功`)
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] })
    },
  })

  const retryMutation = useMutation({
    mutationFn: (statementId: number) => api.post(`/notifications/retry/${statementId}`),
    onSuccess: () => {
      message.success('重發成功')
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] })
    },
  })

  const previewMutation = useMutation({
    mutationFn: (data: any) => api.post('/notifications/preview', data),
    onSuccess: () => { message.success('預覽已發送到管理員信箱'); setPreviewModal(false) },
  })

  const statusColors: Record<string, string> = {
    success: 'green',
    failed: 'red',
    pending: 'orange',
    skipped: 'default',
  }

  const columns = [
    { title: '客戶', dataIndex: ['customer', 'customerName'], key: 'customer' },
    { title: '年月', dataIndex: 'yearMonth', key: 'yearMonth' },
    { title: '金額', dataIndex: 'totalAmount', key: 'totalAmount', render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: '通知方式', dataIndex: ['customer', 'notificationMethod'], key: 'method' },
    {
      title: '狀態', dataIndex: 'sendStatus', key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: '發送時間', dataIndex: 'sentAt', key: 'sentAt',
      render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        record.sendStatus === 'failed' && (
          <Button type="link" size="small" icon={<ReloadOutlined />}
            loading={retryMutation.isPending}
            onClick={() => retryMutation.mutate(record.statementId)}>
            重發
          </Button>
        )
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>通知管理</Title>
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewModal(true)}>發送預覽</Button>
          <Button type="primary" icon={<SendOutlined />}
            onClick={() => {
              const ym = filters.yearMonth || dayjs().format('YYYY-MM')
              Modal.confirm({
                title: '確認發送',
                content: `確定要發送 ${ym} 的所有待發送明細嗎？`,
                onOk: () => sendMutation.mutate(ym),
              })
            }}>
            批次發送
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Input placeholder="年月 (YYYY-MM)" onChange={e => setFilters((f: any) => ({ ...f, yearMonth: e.target.value, page: 1 }))} />
        </Col>
        <Col span={4}>
          <Select placeholder="狀態" allowClear style={{ width: '100%' }}
            onChange={v => setFilters((f: any) => ({ ...f, status: v, page: 1 }))}>
            <Select.Option value="pending">待發送</Select.Option>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失敗</Select.Option>
          </Select>
        </Col>
      </Row>

      <Table columns={columns} dataSource={data?.data} rowKey="statementId" loading={isLoading}
        pagination={{ current: filters.page, pageSize: filters.pageSize, total: data?.total,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })) }} size="small" />

      {/* 預覽 Modal */}
      <Modal title="發送預覽到管理員信箱" open={previewModal}
        onOk={async () => { const v = await previewForm.validateFields(); previewMutation.mutate(v) }}
        onCancel={() => setPreviewModal(false)}>
        <Form form={previewForm} layout="vertical">
          <Form.Item name="yearMonth" label="年月" rules={[{ required: true }]}>
            <Input placeholder="YYYY-MM" />
          </Form.Item>
          <Form.Item name="adminEmail" label="管理員 Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

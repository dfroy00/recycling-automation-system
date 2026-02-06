import { useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Space, Typography, Tag } from 'antd'
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface Contract {
  contractPriceId: number
  itemName: string
  contractPrice: number
  startDate: string
  endDate: string
}

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
    mutationFn: (d: Record<string, unknown>) => api.post(`/customers/${customerId}/contracts`, d),
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
      render: (_: unknown, r: Contract) => {
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

      <Table columns={columns} dataSource={contracts as Contract[]} rowKey="contractPriceId" loading={isLoading} pagination={false} />

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

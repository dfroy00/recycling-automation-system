import { useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Space, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

interface ItemPrice {
  itemPriceId: number
  itemName: string
  standardPrice: number
  effectiveDate: string
}

export default function ItemPricesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [adjustModal, setAdjustModal] = useState<ItemPrice | null>(null)
  const [form] = Form.useForm()
  const [adjustForm] = Form.useForm()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['item-prices'],
    queryFn: () => api.get('/item-prices').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/item-prices', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['item-prices'] }); setModalOpen(false) },
  })

  const adjustMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: Record<string, unknown> }) => api.put(`/item-prices/${id}/adjust`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['item-prices'] }); setAdjustModal(null) },
  })

  const columns = [
    { title: '品項名稱', dataIndex: 'itemName', key: 'itemName' },
    { title: '牌價（元/kg）', dataIndex: 'standardPrice', key: 'standardPrice', render: (v: number) => `$${v}` },
    { title: '生效日期', dataIndex: 'effectiveDate', key: 'effectiveDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: ItemPrice) => (
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

      <Table columns={columns} dataSource={(data as { data: ItemPrice[] })?.data} rowKey="itemPriceId" loading={isLoading} pagination={false} />

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
        adjustMutation.mutate({ id: adjustModal!.itemPriceId, data: { ...values, effectiveDate: values.effectiveDate.format('YYYY-MM-DD') } })
      }} onCancel={() => setAdjustModal(null)}>
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="newPrice" label="新單價" rules={[{ required: true }]}><InputNumber min={0} addonAfter="元/kg" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effectiveDate" label="生效日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

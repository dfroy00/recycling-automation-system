import { useState } from 'react'
import {
  Table, Button, Modal, Form, InputNumber, Select, Popconfirm, Typography, Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  useTripItems, useCreateTripItem, useDeleteTripItem, useItems,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { TripItem, TripItemFormData } from '../types'

const { Text } = Typography

// 計費方向標籤
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

/**
 * 車趟品項展開列元件
 * 顯示單一車趟的品項明細，含新增與刪除功能
 */
export default function TripItemsExpand({ tripId }: { tripId: number }) {
  const { isMobile } = useResponsive()
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemForm] = Form.useForm<TripItemFormData>()

  const { data: tripItems, isLoading } = useTripItems(tripId)
  const { data: itemsData } = useItems({ all: true })
  const createItem = useCreateTripItem(tripId)
  const deleteItem = useDeleteTripItem(tripId)

  const itemOptions = (itemsData?.data ?? []).map(i => ({
    value: i.id,
    label: `${i.name}（${i.unit}）`,
  }))

  const handleItemSubmit = async () => {
    const values = await itemForm.validateFields()
    await createItem.mutateAsync(values)
    setItemModalOpen(false)
    itemForm.resetFields()
  }

  const columns = [
    {
      title: '品項',
      key: 'item',
      render: (_: unknown, record: TripItem) => record.item?.name ?? `#${record.itemId}`,
    },
    {
      title: '數量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v: string, record: TripItem) => `${Number(v).toLocaleString()} ${record.unit}`,
    },
    {
      title: '單價',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '方向',
      dataIndex: 'billingDirection',
      key: 'billingDirection',
      render: (v: string) => (
        <Tag color={directionColorMap[v] ?? 'default'}>
          {directionLabelMap[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '金額',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: TripItem) => (
        <Popconfirm title="確定刪除？" onConfirm={() => deleteItem.mutate(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>品項明細</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => { itemForm.resetFields(); setItemModalOpen(true) }}>
          新增品項
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={tripItems ?? []}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={isMobile ? { x: 500 } : undefined}
      />
      <Modal
        title="新增車趟品項"
        open={itemModalOpen}
        onOk={handleItemSubmit}
        onCancel={() => { setItemModalOpen(false); itemForm.resetFields() }}
        confirmLoading={createItem.isPending}
        width={isMobile ? '95%' : 480}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="itemId" label="品項" rules={[{ required: true, message: '請選擇品項' }]}>
            <Select options={itemOptions} placeholder="請選擇品項" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="quantity" label="數量" rules={[{ required: true, message: '請輸入數量' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="數量" />
          </Form.Item>
          <Form.Item name="unitPrice" label="手動單價（臨時客戶或無合約品項時必填）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="留空則自動帶入合約價" />
          </Form.Item>
          <Form.Item name="billingDirection" label="手動方向（臨時客戶或無合約品項時必填）">
            <Select
              allowClear
              placeholder="留空則自動帶入合約方向"
              options={[
                { value: 'receivable', label: '應收' },
                { value: 'payable', label: '應付' },
                { value: 'free', label: '免費' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

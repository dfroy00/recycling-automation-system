import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, Select, Space,
  Popconfirm, Typography, List, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import { useItems, useCreateItem, useUpdateItem, useDeactivateItem, useDeleteItem, useReactivateItem } from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { Item, ItemFormData } from '../types'

const { Title } = Typography

// 品項分類固定選項（依 Spec Section 8.4）
const ITEM_CATEGORIES = ['紙類', '鐵類', '五金類', '塑膠類', '雜項'] as const
const CATEGORY_OPTIONS = ITEM_CATEGORIES.map((c) => ({ value: c, label: c }))

export default function ItemsPage() {
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [form] = Form.useForm<ItemFormData>()

  const { data, isLoading } = useItems({ page, pageSize: 20, category: categoryFilter, status: statusFilter || undefined })
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const deactivateItem = useDeactivateItem()
  const deleteItem = useDeleteItem()
  const reactivateItem = useReactivateItem()

  // 開啟新增/編輯 Modal
  const openModal = (item?: Item) => {
    if (item) {
      setEditingItem(item)
      form.setFieldsValue(item)
    } else {
      setEditingItem(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  // 送出表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...values })
    } else {
      await createItem.mutateAsync(values)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingItem(null)
  }

  // 表格欄位
  const columns = [
    { title: '編號', dataIndex: 'id', key: 'id', width: 80 },
    { title: '品項名稱', dataIndex: 'name', key: 'name' },
    { title: '分類', dataIndex: 'category', key: 'category', responsive: ['md' as const] },
    { title: '單位', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '啟用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: Item) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          {record.status === 'active' ? (
            <Popconfirm title="確定停用此品項？停用後可重新啟用。" onConfirm={() => deactivateItem.mutate(record.id)}>
              <Button type="link" size="small" icon={<StopOutlined style={{ color: '#faad14' }} />}>
                停用
              </Button>
            </Popconfirm>
          ) : (
            <Button type="link" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => reactivateItem.mutate(record.id)}>
              啟用
            </Button>
          )}
          <Popconfirm title="確定刪除此品項？此操作無法復原。" onConfirm={() => deleteItem.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>品項管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {!isMobile && '新增品項'}
        </Button>
      </div>

      {/* 篩選列 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Select
          allowClear
          placeholder="篩選分類"
          style={{ width: 200 }}
          value={categoryFilter}
          onChange={(val) => { setCategoryFilter(val); setPage(1) }}
          options={CATEGORY_OPTIONS}
        />
        <Select
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val); setPage(1) }}
          style={{ width: 120 }}
          options={[
            { value: 'active', label: '啟用中' },
            { value: 'inactive', label: '已停用' },
            { value: '', label: '全部' },
          ]}
        />
      </div>

      {/* 桌面：表格 / 手機：卡片 */}
      {isMobile ? (
        <List
          loading={isLoading}
          dataSource={data?.data ?? []}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.pagination?.total ?? 0,
            onChange: setPage,
          }}
          renderItem={(item: Item) => (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(item)} />
                  {item.status === 'active' ? (
                    <Popconfirm title="確定停用？" onConfirm={() => deactivateItem.mutate(item.id)}>
                      <Button type="link" size="small" icon={<StopOutlined style={{ color: '#faad14' }} />} />
                    </Popconfirm>
                  ) : (
                    <Button type="link" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => reactivateItem.mutate(item.id)} />
                  )}
                  <Popconfirm title="確定刪除？此操作無法復原。" onConfirm={() => deleteItem.mutate(item.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>#{item.id} {item.name}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                單位：{item.unit}
                {item.category && <span> | 分類：{item.category}</span>}
              </div>
              <Tag color={item.status === 'active' ? 'green' : 'default'} style={{ marginTop: 4 }}>
                {item.status === 'active' ? '啟用' : '停用'}
              </Tag>
            </Card>
          )}
        />
      ) : (
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
      )}

      {/* 新增/編輯 Modal */}
      <Modal
        title={editingItem ? '編輯品項' : '新增品項'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingItem(null); form.resetFields() }}
        confirmLoading={createItem.isPending || updateItem.isPending}
        width={isMobile ? '95%' : 520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="品項名稱" rules={[{ required: true, message: '請輸入品項名稱' }]}>
            <Input placeholder="請輸入品項名稱" />
          </Form.Item>
          <Form.Item name="category" label="分類">
            <Select
              allowClear
              placeholder="請選擇分類"
              options={CATEGORY_OPTIONS}
            />
          </Form.Item>
          <Form.Item name="unit" label="計量單位" rules={[{ required: true, message: '請輸入計量單位' }]}>
            <Input placeholder="請輸入單位（如：kg、件、袋）" />
          </Form.Item>
          <Form.Item name="status" label="狀態" initialValue="active">
            <Select
              options={[
                { value: 'active', label: '啟用' },
                { value: 'inactive', label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

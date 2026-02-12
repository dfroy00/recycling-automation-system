import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, InputNumber, Select, Space, DatePicker,
  Popconfirm, Typography, List, Tag, Divider,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useContracts, useCreateContract, useUpdateContract, useDeleteContract,
  useContractItems, useCreateContractItem, useUpdateContractItem, useDeleteContractItem,
  useCustomers, useItems,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { Contract, ContractFormData, ContractItem, ContractItemFormData } from '../types'

const { Title, Text } = Typography

// 合約狀態選項
const contractStatusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '生效中' },
  { value: 'expired', label: '已到期' },
  { value: 'terminated', label: '已終止' },
]

// 合約狀態顏色
const statusColorMap: Record<string, string> = {
  draft: 'default',
  active: 'green',
  expired: 'orange',
  terminated: 'red',
}

// 合約狀態標籤
const statusLabelMap: Record<string, string> = {
  draft: '草稿',
  active: '生效中',
  expired: '已到期',
  terminated: '已終止',
}

// 計費方向選項
const billingDirectionOptions = [
  { value: 'receivable', label: '應收' },
  { value: 'payable', label: '應付' },
  { value: 'free', label: '免費' },
]

// 計費方向顏色
const directionColorMap: Record<string, string> = {
  receivable: 'blue',
  payable: 'orange',
  free: 'default',
}

const directionLabelMap: Record<string, string> = {
  receivable: '應收',
  payable: '應付',
  free: '免費',
}

// ==================== 合約品項子元件 ====================
function ContractItemsSection({ contractId }: { contractId: number }) {
  const { isMobile } = useResponsive()
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ContractItem | null>(null)
  const [itemForm] = Form.useForm<ContractItemFormData>()

  const { data: contractItems, isLoading } = useContractItems(contractId)
  const { data: itemsData } = useItems({ all: true })
  const createItem = useCreateContractItem(contractId)
  const updateItem = useUpdateContractItem(contractId)
  const deleteItem = useDeleteContractItem(contractId)

  // 品項下拉選項
  const itemOptions = (itemsData?.data ?? []).map(i => ({
    value: i.id,
    label: `${i.name}（${i.unit}）`,
  }))

  // 開啟新增/編輯合約品項
  const openItemModal = (item?: ContractItem) => {
    if (item) {
      setEditingItem(item)
      itemForm.setFieldsValue({
        itemId: item.itemId,
        unitPrice: Number(item.unitPrice),
        billingDirection: item.billingDirection,
      })
    } else {
      setEditingItem(null)
      itemForm.resetFields()
    }
    setItemModalOpen(true)
  }

  // 送出合約品項
  const handleItemSubmit = async () => {
    const values = await itemForm.validateFields()
    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...values })
    } else {
      await createItem.mutateAsync(values)
    }
    setItemModalOpen(false)
    itemForm.resetFields()
    setEditingItem(null)
  }

  const itemColumns = [
    {
      title: '品項',
      key: 'item',
      render: (_: unknown, record: ContractItem) => record.item?.name ?? `品項 #${record.itemId}`,
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
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ContractItem) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openItemModal(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除此品項？" onConfirm={() => deleteItem.mutate(record.id)}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>合約品項</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => openItemModal()}>
          新增品項
        </Button>
      </div>

      <Table
        columns={itemColumns}
        dataSource={contractItems ?? []}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={isMobile ? { x: 400 } : undefined}
      />

      {/* 合約品項 Modal */}
      <Modal
        title={editingItem ? '編輯合約品項' : '新增合約品項'}
        open={itemModalOpen}
        onOk={handleItemSubmit}
        onCancel={() => { setItemModalOpen(false); setEditingItem(null); itemForm.resetFields() }}
        confirmLoading={createItem.isPending || updateItem.isPending}
        width={isMobile ? '95%' : 480}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="itemId" label="品項" rules={[{ required: true, message: '請選擇品項' }]}>
            <Select
              options={itemOptions}
              placeholder="請選擇品項"
              showSearch
              optionFilterProp="label"
              disabled={!!editingItem}
            />
          </Form.Item>
          <Form.Item name="unitPrice" label="合約單價" rules={[{ required: true, message: '請輸入單價' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="請輸入單價" />
          </Form.Item>
          <Form.Item name="billingDirection" label="計費方向" rules={[{ required: true, message: '請選擇方向' }]}>
            <Select options={billingDirectionOptions} placeholder="請選擇" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ==================== 合約管理主頁面 ====================
export default function ContractsPage() {
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [filterCustomerId, setFilterCustomerId] = useState<number | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useContracts({
    page,
    pageSize: 20,
    customerId: filterCustomerId,
    status: filterStatus,
  })
  const { data: customersData } = useCustomers({ pageSize: 999 })
  const createContract = useCreateContract()
  const updateContract = useUpdateContract()
  const deleteContract = useDeleteContract()

  // 客戶下拉選項
  const customerOptions = (customersData?.data ?? []).map(c => ({
    value: c.id,
    label: `${c.name}${c.site?.name ? ` (${c.site.name})` : ''}`,
  }))

  // 開啟新增/編輯 Modal
  const openModal = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract)
      form.setFieldsValue({
        customerId: contract.customerId,
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

  // 送出表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    const formData: ContractFormData = {
      customerId: values.customerId,
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

  // 表格欄位
  const columns = [
    {
      title: '合約編號',
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      render: (v: string, record: Contract) => (
        <Button type="link" onClick={() => openModal(record)} style={{ padding: 0 }}>
          {v}
        </Button>
      ),
    },
    {
      title: '客戶',
      key: 'customer',
      responsive: ['md' as const],
      render: (_: unknown, record: Contract) => record.customer?.name ?? '-',
    },
    {
      title: '起始日',
      dataIndex: 'startDate',
      key: 'startDate',
      responsive: ['lg' as const],
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '到期日',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusColorMap[v] ?? 'default'}>
          {statusLabelMap[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Contract) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除此合約？" onConfirm={() => deleteContract.mutate(record.id)}>
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
      {/* 標題列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>合約管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {!isMobile && '新增合約'}
        </Button>
      </div>

      {/* 篩選列 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="篩選客戶"
          style={{ width: isMobile ? '100%' : 220 }}
          options={customerOptions}
          onChange={v => { setFilterCustomerId(v); setPage(1) }}
          showSearch
          optionFilterProp="label"
        />
        <Select
          allowClear
          placeholder="篩選狀態"
          style={{ width: 130 }}
          options={contractStatusOptions}
          onChange={v => { setFilterStatus(v); setPage(1) }}
        />
      </Space>

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
          renderItem={(contract: Contract) => (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(contract)} />
                  <Popconfirm title="確定刪除？" onConfirm={() => deleteContract.mutate(contract.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {contract.contractNumber}
                <Tag
                  color={statusColorMap[contract.status] ?? 'default'}
                  style={{ marginLeft: 8 }}
                >
                  {statusLabelMap[contract.status] ?? contract.status}
                </Tag>
              </div>
              <div style={{ color: '#666', fontSize: 12 }}>
                客戶：{contract.customer?.name ?? '-'}
              </div>
              <div style={{ color: '#666', fontSize: 12 }}>
                期間：{dayjs(contract.startDate).format('YYYY-MM-DD')} ~ {dayjs(contract.endDate).format('YYYY-MM-DD')}
              </div>
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
          <Form.Item
            name="customerId"
            label="客戶"
            rules={[{ required: true, message: '請選擇客戶' }]}
          >
            <Select
              options={customerOptions}
              placeholder="請選擇客戶"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="contractNumber"
            label="合約編號"
            rules={[{ required: true, message: '請輸入合約編號' }]}
          >
            <Input placeholder="例：C-2026-001" />
          </Form.Item>
          <Space style={{ width: '100%' }} direction={isMobile ? 'vertical' : 'horizontal'} size="middle">
            <Form.Item
              name="startDate"
              label="起始日"
              rules={[{ required: true, message: '請選擇起始日' }]}
              style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="endDate"
              label="到期日"
              rules={[{ required: true, message: '請選擇到期日' }]}
              style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="status" label="狀態" initialValue="draft">
            <Select options={contractStatusOptions} />
          </Form.Item>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} placeholder="備註（選填）" />
          </Form.Item>

          {/* 合約品項區塊（僅編輯模式顯示） */}
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

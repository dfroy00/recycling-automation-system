import { useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Tag } from 'antd'
import { PlusOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useCustomerFees, useCreateCustomerFee, useUpdateCustomerFee, useDeleteCustomerFee, useReactivateCustomerFee } from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import type { CustomerFee, CustomerFeeFormData } from '../types'

interface Props {
  customerId: number
}

/**
 * 客戶附加費用 Tab
 * 從 CustomersPage Modal 的附加費用區塊獨立出來
 */
export default function CustomerFeesTab({ customerId }: Props) {
  const { canEdit } = useAuth()
  const { isMobile } = useResponsive()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<CustomerFee | null>(null)
  const [form] = Form.useForm<CustomerFeeFormData>()

  const { data: fees, isLoading } = useCustomerFees(customerId)
  const createFee = useCreateCustomerFee(customerId)
  const updateFee = useUpdateCustomerFee(customerId)
  const deleteFee = useDeleteCustomerFee(customerId)
  const reactivateFee = useReactivateCustomerFee(customerId)

  // 開啟新增/編輯 Modal
  const openFeeModal = (fee?: CustomerFee) => {
    if (fee) {
      setEditingFee(fee)
      form.setFieldsValue({ ...fee, amount: Number(fee.amount) })
    } else {
      setEditingFee(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  // 送出表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingFee) {
      await updateFee.mutateAsync({ id: editingFee.id, ...values })
    } else {
      await createFee.mutateAsync(values)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingFee(null)
  }

  // 表格欄位
  const columns = [
    { title: '費用名稱', dataIndex: 'name', key: 'name' },
    {
      title: '金額',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '方向',
      dataIndex: 'billingDirection',
      key: 'billingDirection',
      render: (v: string) => (
        <Tag color={v === 'receivable' ? 'green' : 'red'}>
          {v === 'receivable' ? '應收' : '應付'}
        </Tag>
      ),
    },
    {
      title: '頻率',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (v: string) => v === 'monthly' ? '按月' : '按趟',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => v === 'active' ? '啟用' : '停用',
    },
    ...(canEdit ? [{
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: CustomerFee) => (
        <Space>
          <Button type="link" size="small" onClick={() => openFeeModal(record)}>編輯</Button>
          {record.status === 'active' ? (
            <Popconfirm title="確定停用此附加費用？停用後可重新啟用。" onConfirm={() => deleteFee.mutate(record.id)}>
              <Button type="link" size="small" style={{ color: '#faad14' }}>停用</Button>
            </Popconfirm>
          ) : (
            <Button type="link" size="small" style={{ color: '#52c41a' }} onClick={() => reactivateFee.mutate(record.id)}>啟用</Button>
          )}
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openFeeModal()}>
            新增附加費用
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={fees ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      {/* 附加費用 Modal */}
      <Modal
        title={editingFee ? '編輯附加費用' : '新增附加費用'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingFee(null); form.resetFields() }}
        confirmLoading={createFee.isPending || updateFee.isPending}
        width={isMobile ? '95%' : 420}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="費用名稱" rules={[{ required: true, message: '請輸入費用名稱' }]}>
            <Input placeholder="如：處理費、環保補貼" />
          </Form.Item>
          <Form.Item name="amount" label="金額" rules={[{ required: true, message: '請輸入金額' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="固定金額" />
          </Form.Item>
          <Form.Item name="billingDirection" label="費用方向" rules={[{ required: true, message: '請選擇方向' }]}>
            <Select
              options={[
                { value: 'receivable', label: '應收（客戶付我方）' },
                { value: 'payable', label: '應付（我方付客戶）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="frequency" label="頻率" rules={[{ required: true, message: '請選擇頻率' }]}>
            <Select
              options={[
                { value: 'monthly', label: '按月' },
                { value: 'per_trip', label: '按趟' },
              ]}
            />
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

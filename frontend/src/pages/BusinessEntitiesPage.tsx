import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, Select, Space,
  Popconfirm, Typography, List, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  useBusinessEntities, useCreateBusinessEntity,
  useUpdateBusinessEntity, useDeactivateBusinessEntity, useDeleteBusinessEntity, useReactivateBusinessEntity,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { BusinessEntity, BusinessEntityFormData } from '../types'

const { Title } = Typography
const { TextArea } = Input

export default function BusinessEntitiesPage() {
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntity, setEditingEntity] = useState<BusinessEntity | null>(null)
  const [form] = Form.useForm<BusinessEntityFormData>()

  const { data, isLoading } = useBusinessEntities({ page, pageSize: 20, status: statusFilter || undefined })
  const createEntity = useCreateBusinessEntity()
  const updateEntity = useUpdateBusinessEntity()
  const deactivateEntity = useDeactivateBusinessEntity()
  const deleteEntity = useDeleteBusinessEntity()
  const reactivateEntity = useReactivateBusinessEntity()

  // 開啟新增/編輯 Modal
  const openModal = (entity?: BusinessEntity) => {
    if (entity) {
      setEditingEntity(entity)
      form.setFieldsValue(entity)
    } else {
      setEditingEntity(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  // 送出表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingEntity) {
      await updateEntity.mutateAsync({ id: editingEntity.id, ...values })
    } else {
      await createEntity.mutateAsync(values)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingEntity(null)
  }

  // 表格欄位
  const columns = [
    { title: '行號名稱', dataIndex: 'name', key: 'name', width: 180 },
    { title: '統一編號', dataIndex: 'taxId', key: 'taxId', width: 120 },
    { title: '營業項目', dataIndex: 'bizItems', key: 'bizItems', responsive: ['lg' as const], ellipsis: true },
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
      fixed: 'right' as const,
      render: (_: unknown, record: BusinessEntity) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          {record.status === 'active' ? (
            <Popconfirm
              title="確定停用此行號？停用後可重新啟用。"
              onConfirm={() => deactivateEntity.mutate(record.id)}
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
            >
              <Button type="link" size="small" icon={<StopOutlined style={{ color: '#faad14' }} />}>
                停用
              </Button>
            </Popconfirm>
          ) : (
            <Button type="link" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => reactivateEntity.mutate(record.id)}>
              啟用
            </Button>
          )}
          <Popconfirm
            title="確定刪除此行號？此操作無法復原。"
            onConfirm={() => deleteEntity.mutate(record.id)}
            getPopupContainer={(trigger) => trigger.parentElement || document.body}
          >
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
        <Title level={4} style={{ margin: 0 }}>行號管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {!isMobile && '新增行號'}
        </Button>
      </div>

      {/* 篩選列 */}
      <div style={{ marginBottom: 16 }}>
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

      {/* 桌面：表格模式 / 手機：卡片模式 */}
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
          renderItem={(entity: BusinessEntity) => (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(entity)} />
                  {entity.status === 'active' ? (
                    <Popconfirm title="確定停用？" onConfirm={() => deactivateEntity.mutate(entity.id)}>
                      <Button type="link" size="small" icon={<StopOutlined style={{ color: '#faad14' }} />} />
                    </Popconfirm>
                  ) : (
                    <Button type="link" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => reactivateEntity.mutate(entity.id)} />
                  )}
                  <Popconfirm title="確定刪除？此操作無法復原。" onConfirm={() => deleteEntity.mutate(entity.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{entity.name}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                <span>統編：{entity.taxId}</span>
                {entity.bizItems && <span> | {entity.bizItems}</span>}
              </div>
              <Tag color={entity.status === 'active' ? 'green' : 'default'} style={{ marginTop: 4 }}>
                {entity.status === 'active' ? '啟用' : '停用'}
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
          scroll={{ x: 800 }}
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
        title={editingEntity ? '編輯行號' : '新增行號'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingEntity(null); form.resetFields() }}
        confirmLoading={createEntity.isPending || updateEntity.isPending}
        width={isMobile ? '95%' : 520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="行號名稱" rules={[{ required: true, message: '請輸入行號名稱' }]}>
            <Input placeholder="請輸入行號名稱" />
          </Form.Item>
          <Form.Item
            name="taxId"
            label="統一編號"
            rules={[
              { required: true, message: '請輸入統一編號' },
              { max: 8, message: '統一編號最多 8 碼' },
            ]}
          >
            <Input placeholder="請輸入統一編號" maxLength={8} />
          </Form.Item>
          <Form.Item name="bizItems" label="營業項目">
            <TextArea rows={3} placeholder="請輸入營業項目說明" />
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

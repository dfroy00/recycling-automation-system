import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, Select, Space,
  Popconfirm, Typography, List, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSites, useCreateSite, useUpdateSite, useDeactivateSite, useDeleteSite, useReactivateSite } from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import type { Site, SiteFormData } from '../types'

const { Title } = Typography

export default function SitesPage() {
  const { canManageSystem } = useAuth()
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [form] = Form.useForm<SiteFormData>()

  const { data, isLoading } = useSites({ page, pageSize: 20, status: statusFilter || undefined })
  const createSite = useCreateSite()
  const updateSite = useUpdateSite()
  const deactivateSite = useDeactivateSite()
  const deleteSite = useDeleteSite()
  const reactivateSite = useReactivateSite()

  // 開啟新增/編輯 Modal
  const openModal = (site?: Site) => {
    if (site) {
      setEditingSite(site)
      form.setFieldsValue(site)
    } else {
      setEditingSite(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  // 送出表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingSite) {
      await updateSite.mutateAsync({ id: editingSite.id, ...values })
    } else {
      await createSite.mutateAsync(values)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingSite(null)
  }

  // 表格欄位
  const columns = [
    { title: '名稱', dataIndex: 'name', key: 'name' },
    { title: '地址', dataIndex: 'address', key: 'address', responsive: ['lg' as const] },
    { title: '電話', dataIndex: 'phone', key: 'phone', responsive: ['md' as const] },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '啟用' : '停用'}
        </Tag>
      ),
    },
    ...(canManageSystem ? [{
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: Site) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          {record.status === 'active' ? (
            <Popconfirm title="確定停用此站區？停用後可重新啟用。" onConfirm={() => deactivateSite.mutate(record.id)}>
              <Button type="link" size="small" style={{ color: '#faad14' }} icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          ) : (
            <Button type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => reactivateSite.mutate(record.id)}>
              啟用
            </Button>
          )}
          <Popconfirm title="確定刪除此站區？此操作無法復原。" onConfirm={() => deleteSite.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>站區管理</Title>
        {canManageSystem && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            {!isMobile && '新增站區'}
          </Button>
        )}
      </div>

      {/* 狀態篩選 */}
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
          renderItem={(site: Site) => (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              extra={canManageSystem ? (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(site)} />
                  {site.status === 'active' ? (
                    <Popconfirm title="確定停用？" onConfirm={() => deactivateSite.mutate(site.id)}>
                      <Button type="link" size="small" style={{ color: '#faad14' }} icon={<StopOutlined />} />
                    </Popconfirm>
                  ) : (
                    <Button type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => reactivateSite.mutate(site.id)} />
                  )}
                  <Popconfirm title="確定刪除？此操作無法復原。" onConfirm={() => deleteSite.mutate(site.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ) : undefined}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{site.name}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                {site.address && <span>{site.address}</span>}
                {site.phone && <span> | {site.phone}</span>}
              </div>
              <Tag color={site.status === 'active' ? 'green' : 'default'} style={{ marginTop: 4 }}>
                {site.status === 'active' ? '啟用' : '停用'}
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
        title={editingSite ? '編輯站區' : '新增站區'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingSite(null); form.resetFields() }}
        confirmLoading={createSite.isPending || updateSite.isPending}
        width={isMobile ? '95%' : 520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="站區名稱" rules={[{ required: true, message: '請輸入站區名稱' }]}>
            <Input placeholder="請輸入站區名稱" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="請輸入地址" />
          </Form.Item>
          <Form.Item name="phone" label="聯絡電話">
            <Input placeholder="請輸入電話" />
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

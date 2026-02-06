import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Space, Typography, Tag } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const { Title } = Typography

interface Site {
  siteId: string
  siteName: string
  manager: string | null
  contactPhone: string | null
  contactEmail: string | null
  status: string
}

export default function SitesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<Site[]>('/sites').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Site>) => api.post('/sites', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); setModalOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Site> }) => api.put(`/sites/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); setModalOpen(false) },
  })

  const openCreate = () => {
    setEditingSite(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (site: Site) => {
    setEditingSite(site)
    form.setFieldsValue(site)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingSite) {
      updateMutation.mutate({ id: editingSite.siteId, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    { title: '站點編號', dataIndex: 'siteId', key: 'siteId' },
    { title: '站點名稱', dataIndex: 'siteName', key: 'siteName' },
    { title: '負責人', dataIndex: 'manager', key: 'manager' },
    { title: '聯絡電話', dataIndex: 'contactPhone', key: 'contactPhone' },
    { title: 'Email', dataIndex: 'contactEmail', key: 'contactEmail' },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === '啟用' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Site) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
          編輯
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>站點管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增站點</Button>
      </div>

      <Table
        columns={columns}
        dataSource={sites}
        rowKey="siteId"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editingSite ? '編輯站點' : '新增站點'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          {!editingSite && (
            <Form.Item name="siteId" label="站點編號" rules={[{ required: true }]}>
              <Input placeholder="例：S008" />
            </Form.Item>
          )}
          <Form.Item name="siteName" label="站點名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="manager" label="負責人">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="聯絡電話">
            <Input />
          </Form.Item>
          <Form.Item name="contactEmail" label="Email">
            <Input type="email" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

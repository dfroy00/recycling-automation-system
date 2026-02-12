import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, Select, Space,
  Popconfirm, Typography, List, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { User, UserFormData } from '../types'

const { Title } = Typography

export default function UsersPage() {
  const { isMobile } = useResponsive()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm<UserFormData>()

  // 後端回傳純陣列，無分頁
  const { data, isLoading } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  // 開啟新增/編輯 Modal
  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      form.setFieldsValue({ ...user, password: undefined })
    } else {
      setEditingUser(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  // 送出表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    // 編輯時，密碼為空表示不修改
    if (editingUser && !values.password) {
      delete values.password
    }
    if (editingUser) {
      await updateUser.mutateAsync({ id: editingUser.id, ...values })
    } else {
      await createUser.mutateAsync(values)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingUser(null)
  }

  // 表格欄位
  const columns = [
    { title: '帳號', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email', responsive: ['lg' as const] },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 80,
      responsive: ['md' as const],
      render: (role: string) => role === 'admin' ? '管理員' : role,
    },
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
      width: 120,
      render: (_: unknown, record: User) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除此使用者？" onConfirm={() => deleteUser.mutate(record.id)}>
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
        <Title level={4} style={{ margin: 0 }}>使用者管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {!isMobile && '新增使用者'}
        </Button>
      </div>

      {/* 桌面：表格 / 手機：卡片 */}
      {isMobile ? (
        <List
          loading={isLoading}
          dataSource={data ?? []}
          pagination={{ pageSize: 20 }}
          renderItem={(user: User) => (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(user)} />
                  <Popconfirm title="確定刪除？" onConfirm={() => deleteUser.mutate(user.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{user.name}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                帳號：{user.username}
                {user.email && <span> | {user.email}</span>}
              </div>
              <Tag color={user.status === 'active' ? 'green' : 'default'} style={{ marginTop: 4 }}>
                {user.status === 'active' ? '啟用' : '停用'}
              </Tag>
            </Card>
          )}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={data ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
        />
      )}

      {/* 新增/編輯 Modal */}
      <Modal
        title={editingUser ? '編輯使用者' : '新增使用者'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingUser(null); form.resetFields() }}
        confirmLoading={createUser.isPending || updateUser.isPending}
        width={isMobile ? '95%' : 520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="帳號"
            rules={[{ required: true, message: '請輸入帳號' }]}
          >
            <Input placeholder="請輸入帳號" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? '密碼（留空表示不修改）' : '密碼'}
            rules={editingUser ? [] : [{ required: true, message: '請輸入密碼' }]}
          >
            <Input.Password placeholder={editingUser ? '留空表示不修改密碼' : '請輸入密碼'} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '請輸入姓名' }]}>
            <Input placeholder="請輸入姓名" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="請輸入 Email" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="admin">
            <Select
              options={[
                { value: 'admin', label: '管理員' },
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

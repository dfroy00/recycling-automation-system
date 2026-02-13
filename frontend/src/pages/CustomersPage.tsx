import { useState } from 'react'
import {
  Table, Card, Button, Select, Space, Popconfirm, Typography, List, Tag, Input,
} from 'antd'
import { PlusOutlined, StopOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useCustomers, useDeleteCustomer, useReactivateCustomer, useSites } from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import type { Customer } from '../types'

const { Title } = Typography

export default function CustomersPage() {
  const { isMobile } = useResponsive()
  const { canEdit } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState<number | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string>('active')

  const { data, isLoading } = useCustomers({ page, pageSize: 20, search, siteId: siteFilter, type: typeFilter, status: statusFilter || undefined })
  const { data: sitesData } = useSites({ all: true })
  const deleteCustomer = useDeleteCustomer()
  const reactivateCustomer = useReactivateCustomer()

  // 站區選項
  const siteOptions = (sitesData?.data ?? []).map((s) => ({ value: s.id, label: s.name }))

  // 類型標籤
  const typeLabel = (type: string) => type === 'contracted' ? '簽約' : '臨時'

  // 表格欄位
  const columns = [
    {
      title: '客戶名稱',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Customer) => (
        <Link to={`/customers/${record.id}`}>{name}</Link>
      ),
    },
    {
      title: '站區',
      key: 'site',
      responsive: ['md' as const],
      render: (_: unknown, record: Customer) => record.site?.name ?? '-',
    },
    {
      title: '類型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'contracted' ? 'blue' : 'orange'}>{typeLabel(type)}</Tag>
      ),
    },
    {
      title: '車趟費',
      key: 'tripFee',
      width: 80,
      responsive: ['lg' as const],
      render: (_: unknown, record: Customer) =>
        record.tripFeeEnabled
          ? record.tripFeeType === 'per_trip' ? '按次' : '按月'
          : '不收',
    },
    {
      title: '明細',
      dataIndex: 'statementType',
      key: 'statementType',
      width: 80,
      responsive: ['lg' as const],
      render: (v: string) => v === 'monthly' ? '月結' : '按趟',
    },
    {
      title: '付款',
      dataIndex: 'paymentType',
      key: 'paymentType',
      width: 80,
      responsive: ['lg' as const],
      render: (v: string) => v === 'lump_sum' ? '一次付' : '按趟付',
    },
    ...(canEdit ? [{
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Customer) => (
        record.status === 'active' ? (
          <Popconfirm title="確定停用此客戶？停用後可重新啟用。" onConfirm={() => deleteCustomer.mutate(record.id)}>
            <Button type="link" size="small" icon={<StopOutlined style={{ color: '#faad14' }} />} style={{ color: '#faad14' }}>
              停用
            </Button>
          </Popconfirm>
        ) : (
          <Button type="link" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} style={{ color: '#52c41a' }} onClick={() => reactivateCustomer.mutate(record.id)}>
            啟用
          </Button>
        )
      ),
    }] : []),
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>客戶管理</Title>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/customers/new')}>
            {!isMobile && '新增客戶'}
          </Button>
        )}
      </div>

      {/* 篩選列 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜尋客戶名稱"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          allowClear
          placeholder="站區"
          style={{ width: 120 }}
          value={siteFilter}
          onChange={(val) => { setSiteFilter(val); setPage(1) }}
          options={siteOptions}
        />
        <Select
          allowClear
          placeholder="類型"
          style={{ width: 100 }}
          value={typeFilter}
          onChange={(val) => { setTypeFilter(val); setPage(1) }}
          options={[
            { value: 'contracted', label: '簽約' },
            { value: 'temporary', label: '臨時' },
          ]}
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
          renderItem={(customer: Customer) => (
            <Card
              size="small"
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => navigate(`/customers/${customer.id}`)}
              extra={
                canEdit && (
                  customer.status === 'active' ? (
                    <Popconfirm
                      title="確定停用此客戶？停用後可重新啟用。"
                      onConfirm={(e) => { e?.stopPropagation(); deleteCustomer.mutate(customer.id) }}
                    >
                      <Button
                        type="link" size="small" icon={<StopOutlined style={{ color: '#faad14' }} />} style={{ color: '#faad14' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  ) : (
                    <Button
                      type="link" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} style={{ color: '#52c41a' }}
                      onClick={(e) => { e.stopPropagation(); reactivateCustomer.mutate(customer.id) }}
                    />
                  )
                )
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {customer.name}
                <Tag color={customer.type === 'contracted' ? 'blue' : 'orange'} style={{ marginLeft: 8 }}>
                  {typeLabel(customer.type)}
                </Tag>
              </div>
              <div style={{ color: '#666', fontSize: 12 }}>
                {customer.site?.name ?? '-'}
                {' | '}車趟費:{customer.tripFeeEnabled ? (customer.tripFeeType === 'per_trip' ? '按次' : '按月') : '不收'}
                {' | '}{customer.statementType === 'monthly' ? '月結' : '按趟'}
                {' | '}{customer.paymentType === 'lump_sum' ? '一次付' : '按趟付'}
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
    </div>
  )
}

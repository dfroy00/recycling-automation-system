import { useState } from 'react'
import { Table, DatePicker, Select, Input, Space, Typography, Row, Col, Statistic, Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

interface CollectedItem {
  collectionId: number
  collectionDate: string
  customerId: string
  itemName: string
  weightKg: number
  customer?: { customerName: string }
}

interface SiteItem {
  siteId: string
  siteName: string
}

interface QueryResult {
  data: CollectedItem[]
  total: number
  stats?: { totalWeight: number; avgWeight: number }
}

export default function ItemQueryPage() {
  const [filters, setFilters] = useState<Record<string, unknown>>({ page: 1, pageSize: 20 })

  const { data: sitesData } = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/sites').then(r => r.data) })
  const sites: SiteItem[] = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const { data, isLoading } = useQuery({
    queryKey: ['data-items', filters],
    queryFn: () => api.get('/data/items', { params: filters }).then(r => r.data),
  })

  const result = data as QueryResult | undefined

  const columns = [
    { title: '日期', dataIndex: 'collectionDate', key: 'collectionDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    { title: '客戶', dataIndex: ['customer', 'customerName'], key: 'customer' },
    { title: '客戶編號', dataIndex: 'customerId', key: 'customerId' },
    { title: '品項', dataIndex: 'itemName', key: 'itemName' },
    { title: '重量(kg)', dataIndex: 'weightKg', key: 'weightKg', render: (v: number) => Number(v).toFixed(1) },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4}>品項收取查詢</Title>
      <Row gutter={16}>
        <Col span={6}>
          <RangePicker style={{ width: '100%' }} onChange={(dates) => {
            if (dates) {
              setFilters(f => ({ ...f, startDate: dates[0]?.format('YYYY-MM-DD'), endDate: dates[1]?.format('YYYY-MM-DD'), page: 1 }))
            } else {
              setFilters(f => {
                const { startDate: _s, endDate: _e, ...rest } = f as Record<string, unknown>
                return { ...rest, page: 1 }
              })
            }
          }} />
        </Col>
        <Col span={4}>
          <Select placeholder="站點" allowClear style={{ width: '100%' }} onChange={(v: string) => setFilters(f => ({ ...f, siteId: v, page: 1 }))}>
            {sites.map(s => <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>)}
          </Select>
        </Col>
        <Col span={4}>
          <Input.Search placeholder="品項名稱" allowClear onSearch={(v: string) => setFilters(f => ({ ...f, itemName: v, page: 1 }))} />
        </Col>
      </Row>

      {result?.stats && (
        <Row gutter={16}>
          <Col span={6}><Card><Statistic title="總重量" value={Number(result.stats.totalWeight).toFixed(1)} suffix="kg" /></Card></Col>
          <Col span={6}><Card><Statistic title="平均重量" value={Number(result.stats.avgWeight).toFixed(1)} suffix="kg" /></Card></Col>
        </Row>
      )}

      <Table columns={columns} dataSource={result?.data} rowKey="collectionId" loading={isLoading}
        pagination={{ current: filters.page as number, pageSize: filters.pageSize as number, total: result?.total,
          onChange: (page, pageSize) => setFilters(f => ({ ...f, page, pageSize })),
          showTotal: (total) => `共 ${total} 筆` }} size="small" />
    </Space>
  )
}

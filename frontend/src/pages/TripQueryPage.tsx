import { useState } from 'react'
import { Table, DatePicker, Select, Input, Space, Typography, Row, Col } from 'antd'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

interface Trip {
  tripId: number
  tripDate: string
  tripTime: string
  customerId: string
  driver: string
  vehiclePlate: string
  customer?: { customerName: string }
}

interface SiteItem {
  siteId: string
  siteName: string
}

export default function TripQueryPage() {
  const [filters, setFilters] = useState<Record<string, unknown>>({ page: 1, pageSize: 20 })

  const { data: sitesData } = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/sites').then(r => r.data) })
  const sites: SiteItem[] = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const { data, isLoading } = useQuery({
    queryKey: ['data-trips', filters],
    queryFn: () => api.get('/data/trips', { params: filters }).then(r => r.data),
  })

  const columns = [
    { title: '日期', dataIndex: 'tripDate', key: 'tripDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    { title: '時間', dataIndex: 'tripTime', key: 'tripTime', render: (d: string) => dayjs(d).format('HH:mm') },
    { title: '客戶', dataIndex: ['customer', 'customerName'], key: 'customer' },
    { title: '客戶編號', dataIndex: 'customerId', key: 'customerId' },
    { title: '司機', dataIndex: 'driver', key: 'driver' },
    { title: '車牌', dataIndex: 'vehiclePlate', key: 'vehiclePlate' },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4}>車趟記錄查詢</Title>
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
          <Input.Search placeholder="客戶編號" allowClear onSearch={(v: string) => setFilters(f => ({ ...f, customerId: v, page: 1 }))} />
        </Col>
        <Col span={4}>
          <Input.Search placeholder="司機" allowClear onSearch={(v: string) => setFilters(f => ({ ...f, driver: v, page: 1 }))} />
        </Col>
      </Row>
      <Table columns={columns} dataSource={(data as { data: Trip[]; total: number })?.data} rowKey="tripId" loading={isLoading}
        pagination={{ current: filters.page as number, pageSize: filters.pageSize as number, total: (data as { data: Trip[]; total: number })?.total,
          onChange: (page, pageSize) => setFilters(f => ({ ...f, page, pageSize })),
          showTotal: (total) => `共 ${total} 筆` }} size="small" />
    </Space>
  )
}

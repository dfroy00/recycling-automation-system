import { useState } from 'react'
import { Table, Tag, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { useTrips } from '../api/hooks'

interface Props {
  customerId: number
}

// 車趟來源標籤
const sourceMap: Record<string, { color: string; label: string }> = {
  manual: { color: 'blue', label: '手動' },
  pos_sync: { color: 'green', label: 'POS' },
  vehicle_sync: { color: 'orange', label: '車機' },
}

/**
 * 客戶車趟紀錄 Tab（唯讀）
 * 查詢該客戶的車趟歷史，支援月份篩選
 */
export default function CustomerTripsTab({ customerId }: Props) {
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState<{ dateFrom?: string; dateTo?: string }>({})

  const { data, isLoading } = useTrips({
    page,
    pageSize: 20,
    customerId,
    ...dateRange,
  })

  // 月份篩選：轉換為 dateFrom / dateTo
  const handleMonthChange = (_: unknown, dateStr: string | string[]) => {
    const str = Array.isArray(dateStr) ? dateStr[0] : dateStr
    if (str) {
      const start = dayjs(str).startOf('month').format('YYYY-MM-DD')
      const end = dayjs(str).endOf('month').format('YYYY-MM-DD')
      setDateRange({ dateFrom: start, dateTo: end })
    } else {
      setDateRange({})
    }
    setPage(1)
  }

  const columns = [
    {
      title: '日期',
      dataIndex: 'tripDate',
      key: 'tripDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '時間',
      dataIndex: 'tripTime',
      key: 'tripTime',
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '站區',
      key: 'site',
      render: (_: unknown, record: any) => record.site?.name ?? '-',
    },
    {
      title: '司機',
      dataIndex: 'driver',
      key: 'driver',
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '車牌',
      dataIndex: 'vehiclePlate',
      key: 'vehiclePlate',
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '來源',
      dataIndex: 'source',
      key: 'source',
      render: (v: string) => (
        <Tag color={sourceMap[v]?.color}>{sourceMap[v]?.label ?? v}</Tag>
      ),
    },
    {
      title: '備註',
      dataIndex: 'notes',
      key: 'notes',
      responsive: ['lg' as const],
      render: (v: string | null) => v ?? '-',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <DatePicker
          picker="month"
          placeholder="篩選月份"
          onChange={handleMonthChange}
          allowClear
        />
      </div>
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
    </div>
  )
}

import { useState } from 'react'
import { Table, Tag, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { useStatements } from '../api/hooks'

interface Props {
  customerId: number
}

// 明細狀態對照
const statusMap: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  approved: { color: 'green', label: '已核准' },
  rejected: { color: 'red', label: '已退回' },
  invoiced: { color: 'blue', label: '已開票' },
  sent: { color: 'cyan', label: '已寄送' },
  voided: { color: 'default', label: '已作廢' },
}

/**
 * 客戶結算明細 Tab（唯讀）
 * 查詢該客戶的月結/按趟明細，支援月份篩選
 */
export default function CustomerStatementsTab({ customerId }: Props) {
  const [page, setPage] = useState(1)
  const [yearMonth, setYearMonth] = useState<string | undefined>()

  const { data, isLoading } = useStatements({
    page,
    pageSize: 20,
    customerId,
    yearMonth,
  })

  // 月份篩選
  const handleMonthChange = (_: unknown, dateStr: string | string[]) => {
    const str = Array.isArray(dateStr) ? dateStr[0] : dateStr
    setYearMonth(str || undefined)
    setPage(1)
  }

  const columns = [
    {
      title: '月份',
      dataIndex: 'yearMonth',
      key: 'yearMonth',
    },
    {
      title: '類型',
      dataIndex: 'statementType',
      key: 'statementType',
      render: (v: string) => v === 'monthly' ? '月結' : '按趟',
    },
    {
      title: '應收',
      dataIndex: 'totalReceivable',
      key: 'totalReceivable',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '應付',
      dataIndex: 'totalPayable',
      key: 'totalPayable',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '淨額',
      dataIndex: 'netAmount',
      key: 'netAmount',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusMap[v]?.color}>{statusMap[v]?.label ?? v}</Tag>
      ),
    },
    {
      title: '寄送日',
      dataIndex: 'sentAt',
      key: 'sentAt',
      responsive: ['lg' as const],
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
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

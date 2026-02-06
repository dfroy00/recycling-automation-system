import { Badge, Card, Col, Row, Statistic, Table, Tag, Typography, Space } from 'antd'
import {
  CarOutlined,
  InboxOutlined,
  AlertOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

interface DashboardStats {
  todayTrips: number
  todayItems: number
  monthTrips: number
  pendingStatements: number
  expiringContracts: {
    customerId: string
    customerName: string
    siteId: string
    itemName: string
    endDate: string
    daysLeft: number
  }[]
}

interface ContractExpiryDetail {
  contractPriceId: number
  customerId: string
  customerName: string
  siteName: string
  itemName: string
  endDate: string
  daysLeft: number
  urgency: '30day' | '15day' | '7day' | 'today'
}

interface ContractExpiryResult {
  expiring: number
  details: ContractExpiryDetail[]
  autoSwitched: number
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    refetchInterval: 60 * 1000, // 每分鐘刷新
  })

  // 從排程 API 取得更詳細的合約到期資料
  const { data: contractData } = useQuery({
    queryKey: ['expiring-contracts'],
    queryFn: () => api.get<ContractExpiryResult>('/schedule/contracts').then(r => r.data),
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘刷新
  })

  // 合約到期表格欄位
  const contractColumns = [
    { title: '客戶', dataIndex: 'customerName', key: 'customerName' },
    { title: '站點', dataIndex: 'siteName', key: 'siteName' },
    { title: '品項', dataIndex: 'itemName', key: 'itemName' },
    {
      title: '到期日',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '剩餘天數',
      dataIndex: 'daysLeft',
      key: 'daysLeft',
      render: (days: number) => {
        const color = days <= 7 ? 'red' : days <= 15 ? 'orange' : 'green'
        return <Tag color={color}>{days} 天</Tag>
      },
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={4}>儀表板</Title>

      {/* 統計卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日匯入車趟"
              value={stats?.todayTrips || 0}
              prefix={<CarOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日匯入品項"
              value={stats?.todayItems || 0}
              prefix={<InboxOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月車趟總數"
              value={stats?.monthTrips || 0}
              prefix={<CarOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待發送明細"
              value={stats?.pendingStatements || 0}
              prefix={<FileTextOutlined />}
              loading={isLoading}
              valueStyle={stats?.pendingStatements ? { color: '#faad14' } : undefined}
            />
          </Card>
        </Col>
      </Row>

      {/* 即將到期合約 */}
      <Card
        title={
          <Space>
            <AlertOutlined style={{ color: '#ff4d4f' }} />
            即將到期合約（30 天內）
          </Space>
        }
        extra={<Badge count={contractData?.expiring || stats?.expiringContracts?.length || 0} />}
      >
        <Table
          columns={contractColumns}
          dataSource={(
            contractData?.details
            || stats?.expiringContracts?.map(c => ({ ...c, siteName: c.siteId }))
            || []
          ) as any[]}
          rowKey={(r: any) => `${r.customerId}-${r.itemName}`}
          loading={isLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: '無即將到期的合約' }}
        />
      </Card>
    </Space>
  )
}

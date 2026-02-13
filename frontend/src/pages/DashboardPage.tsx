import { Row, Col, Card, Statistic, Table, List, Button, Spin, Typography } from 'antd'
import {
  CarOutlined,
  DollarOutlined,
  TeamOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'

const { Title } = Typography

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()
  const { isMobile } = useResponsive()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  // 統計卡片資料
  const statCards = [
    {
      title: '本月車趟',
      value: stats?.monthlyTrips ?? 0,
      icon: <CarOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      color: '#e6f7ff',
    },
    {
      title: '應收總額',
      value: stats?.totalReceivable ?? 0,
      prefix: '$',
      icon: <DollarOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      color: '#f6ffed',
    },
    {
      title: '應付總額',
      value: stats?.totalPayable ?? 0,
      prefix: '$',
      icon: <DollarOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      color: '#fffbe6',
    },
    {
      title: '客戶數',
      value: stats?.customerCount ?? 0,
      icon: <TeamOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
      color: '#f9f0ff',
    },
  ]

  // 合約到期提醒表格欄位
  const contractColumns = [
    { title: '客戶名稱', dataIndex: 'customerName', key: 'customerName' },
    { title: '合約編號', dataIndex: 'contractNumber', key: 'contractNumber' },
    { title: '到期日', dataIndex: 'endDate', key: 'endDate' },
    {
      title: '剩餘天數',
      dataIndex: 'daysRemaining',
      key: 'daysRemaining',
      render: (days: number) => (
        <span style={{ color: days <= 7 ? '#ff4d4f' : days <= 15 ? '#faad14' : '#52c41a' }}>
          {days} 天
        </span>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>儀表板</Title>

      {/* 統計卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <Col xs={12} sm={12} md={12} lg={6} key={card.title}>
            <Card
              style={{ background: card.color }}
              styles={{ body: { padding: isMobile ? 12 : 24 } }}
            >
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.prefix}
                valueStyle={{ fontSize: isMobile ? 20 : 28 }}
              />
              <div style={{ position: 'absolute', top: isMobile ? 12 : 24, right: isMobile ? 12 : 24 }}>
                {card.icon}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* 待處理事項 */}
        <Col xs={24} lg={12}>
          <Card title="待處理事項" style={{ marginBottom: 16 }}>
            <List
              dataSource={stats?.pendingItems ?? []}
              locale={{ emptyText: '目前沒有待處理事項' }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      icon={<ArrowRightOutlined />}
                      onClick={() => navigate(item.link)}
                    >
                      前往
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={item.label}
                    description={`${item.count} 筆`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 合約到期提醒 */}
        <Col xs={24} lg={12}>
          <Card title="合約到期提醒" style={{ marginBottom: 16 }}>
            {isMobile ? (
              <List
                dataSource={stats?.expiringContracts ?? []}
                locale={{ emptyText: '目前沒有即將到期的合約' }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.customerName}
                      description={`${item.contractNumber} | 到期日：${item.endDate}`}
                    />
                    <span
                      style={{
                        color: item.daysRemaining <= 7 ? '#ff4d4f' : item.daysRemaining <= 15 ? '#faad14' : '#52c41a',
                        fontWeight: 'bold',
                      }}
                    >
                      {item.daysRemaining} 天
                    </span>
                  </List.Item>
                )}
              />
            ) : (
              <Table
                columns={contractColumns}
                dataSource={stats?.expiringContracts ?? []}
                rowKey="contractNumber"
                pagination={false}
                size="small"
                locale={{ emptyText: '目前沒有即將到期的合約' }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

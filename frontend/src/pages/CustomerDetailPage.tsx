import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Tabs, Button, Space, Typography, Spin, Result } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useCustomer } from '../api/hooks'
import CustomerInfoTab from './CustomerInfoTab'
import CustomerContractsTab from './CustomerContractsTab'
import CustomerFeesTab from './CustomerFeesTab'
import CustomerTripsTab from './CustomerTripsTab'
import CustomerStatementsTab from './CustomerStatementsTab'

const { Title } = Typography

/**
 * 客戶詳情頁
 * 支援 /customers/:id（編輯）和 /customers/new（新增）
 * Tab 架構：基本資料、合約管理、附加費用、車趟紀錄、結算明細
 */
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isNew = id === 'new'
  const customerId = isNew ? null : Number(id)

  // 從 URL query 取得預設 tab（例如 ?tab=contracts）
  const defaultTab = searchParams.get('tab') ?? 'info'
  const [activeTab, setActiveTab] = useState(defaultTab)

  const { data: customer, isLoading } = useCustomer(customerId)

  // 新增模式：僅顯示基本資料 Tab
  if (isNew) {
    return (
      <div>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>
            返回列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>新增客戶</Title>
        </Space>
        <CustomerInfoTab
          customer={null}
          isNew
          onCreated={(newId) => navigate(`/customers/${newId}`)}
        />
      </div>
    )
  }

  // 載入中
  if (isLoading) {
    return <Spin tip="載入中..." style={{ display: 'block', margin: '100px auto' }} />
  }

  // 找不到客戶
  if (!customer) {
    return (
      <Result
        status="404"
        title="找不到此客戶"
        extra={
          <Button onClick={() => navigate('/customers')}>回客戶列表</Button>
        }
      />
    )
  }

  // Tab 懶載入：只有切換到該 Tab 才會渲染
  const tabItems = [
    {
      key: 'info',
      label: '基本資料',
      children: <CustomerInfoTab customer={customer} />,
    },
    {
      key: 'contracts',
      label: '合約管理',
      children: activeTab === 'contracts' ? <CustomerContractsTab customerId={customer.id} /> : null,
    },
    {
      key: 'fees',
      label: '附加費用',
      children: activeTab === 'fees' ? <CustomerFeesTab customerId={customer.id} /> : null,
    },
    {
      key: 'trips',
      label: '車趟紀錄',
      children: activeTab === 'trips' ? <CustomerTripsTab customerId={customer.id} /> : null,
    },
    {
      key: 'statements',
      label: '結算明細',
      children: activeTab === 'statements' ? <CustomerStatementsTab customerId={customer.id} /> : null,
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>
          返回列表
        </Button>
        <Title level={4} style={{ margin: 0 }}>{customer.name}</Title>
      </Space>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  )
}

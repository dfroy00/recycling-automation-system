import { Tabs, Typography, Spin } from 'antd'
import { useSites } from '../api/hooks'
import SiteTripsTab from './SiteTripsTab'

const { Title } = Typography

/**
 * 車趟管理主頁面
 * 以站區 Tabs 頁籤呈現，每個頁籤對應一個活躍站區的車趟列表
 */
export default function TripsPage() {
  const { data: sitesData, isLoading } = useSites({ all: true })

  // 僅顯示狀態為 active 的站區
  const activeSites = (sitesData?.data ?? []).filter(s => s.status === 'active')

  // 建立頁籤項目
  const tabItems = activeSites.map(site => ({
    key: String(site.id),
    label: site.name,
    children: <SiteTripsTab siteId={site.id} siteName={site.name} />,
  }))

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>車趟管理</Title>
      <Tabs
        type="card"
        items={tabItems}
        defaultActiveKey={activeSites[0] ? String(activeSites[0].id) : undefined}
      />
    </div>
  )
}

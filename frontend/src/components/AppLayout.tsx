import { useState } from 'react'
import { Layout, Menu, Drawer, Button, Dropdown, theme } from 'antd'
import {
  DashboardOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  TeamOutlined,
  FileTextOutlined,
  CarOutlined,
  SyncOutlined,
  AccountBookOutlined,
  BarChartOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  MenuOutlined,
  LogoutOutlined,
  BankOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'

const { Header, Sider, Content } = Layout

// 側邊選單項目
const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '儀表板',
  },
  {
    key: 'basic-data',
    icon: <AppstoreOutlined />,
    label: '基礎資料',
    children: [
      { key: '/sites', icon: <EnvironmentOutlined />, label: '站區管理' },
      { key: '/items', icon: <AppstoreOutlined />, label: '品項管理' },
      { key: '/customers', icon: <TeamOutlined />, label: '客戶管理' },
      { key: '/business-entities', icon: <BankOutlined />, label: '行號管理' },
      { key: '/contracts', icon: <FileTextOutlined />, label: '合約管理' },
    ],
  },
  {
    key: 'operations',
    icon: <CarOutlined />,
    label: '營運管理',
    children: [
      { key: '/trips', icon: <CarOutlined />, label: '車趟管理' },
      { key: '/sync', icon: <SyncOutlined />, label: '外部同步' },
    ],
  },
  {
    key: 'accounting',
    icon: <AccountBookOutlined />,
    label: '帳務管理',
    children: [
      { key: '/statements', icon: <AccountBookOutlined />, label: '月結管理' },
      { key: '/reports', icon: <BarChartOutlined />, label: '報表' },
    ],
  },
  {
    key: 'system',
    icon: <UserOutlined />,
    label: '系統',
    children: [
      { key: '/users', icon: <UserOutlined />, label: '使用者' },
      { key: '/holidays', icon: <CalendarOutlined />, label: '假日設定' },
      { key: '/schedule', icon: <ClockCircleOutlined />, label: '排程管理' },
    ],
  },
]

// 取得目前路徑對應的展開 SubMenu keys
function getOpenKeys(pathname: string): string[] {
  for (const item of menuItems) {
    if ('children' in item && item.children) {
      for (const child of item.children) {
        if (child.key === pathname) {
          return [item.key]
        }
      }
    }
  }
  return []
}

export default function AppLayout() {
  const { isMobile, isDesktop } = useResponsive()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { token: themeToken } = theme.useToken()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeys(location.pathname))

  // 選單點擊導航
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    if (isMobile) {
      setDrawerOpen(false)
    }
  }

  // SubMenu 展開控制
  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys)
  }

  // 使用者下拉選單
  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '登出',
      onClick: logout,
    },
  ]

  // 選單元件（共用於 Sider 和 Drawer）
  const menuContent = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      openKeys={openKeys}
      onOpenChange={handleOpenChange}
      onClick={handleMenuClick}
      items={menuItems}
      style={{ borderRight: 0 }}
    />
  )

  // 系統標題
  const logoContent = (
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        fontWeight: 'bold',
        fontSize: isDesktop ? 16 : 14,
        color: themeToken.colorPrimary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {isDesktop ? '回收業務自動化系統' : '回收系統'}
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 桌面 / 平板：固定側邊欄 */}
      {!isMobile && (
        <Sider
          collapsed={!isDesktop}
          collapsedWidth={80}
          width={240}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            background: themeToken.colorBgContainer,
            borderRight: `1px solid ${themeToken.colorBorderSecondary}`,
          }}
        >
          {logoContent}
          {menuContent}
        </Sider>
      )}

      {/* 手機：Drawer 抽屜式選單 */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={280}
          styles={{ body: { padding: 0 } }}
        >
          {logoContent}
          {menuContent}
        </Drawer>
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : isDesktop ? 240 : 80,
          transition: 'margin-left 0.2s',
        }}
      >
        {/* 頂部列 */}
        <Header
          style={{
            padding: '0 16px',
            background: themeToken.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 手機：漢堡選單按鈕 */}
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
                style={{ fontSize: 18 }}
              />
            )}
            {isMobile && (
              <span style={{ fontWeight: 'bold', fontSize: 16, color: themeToken.colorPrimary }}>
                回收業務自動化系統
              </span>
            )}
          </div>

          {/* 使用者資訊 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {!isMobile && (user?.name || user?.username || '使用者')}
            </Button>
          </Dropdown>
        </Header>

        {/* 主要內容區 */}
        <Content
          style={{
            padding: isMobile ? 12 : 24,
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

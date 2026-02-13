import { useState } from 'react'
import { Layout, Menu, Drawer, Button, Dropdown, Tag, theme } from 'antd'
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

// 依角色產生側邊選單項目
function getMenuItems(canManageSystem: boolean) {
  return [
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
        ...(canManageSystem ? [{ key: '/sites', icon: <EnvironmentOutlined />, label: '站區管理' }] : []),
        ...(canManageSystem ? [{ key: '/items', icon: <AppstoreOutlined />, label: '品項管理' }] : []),
        { key: '/customers', icon: <TeamOutlined />, label: '客戶管理' },
        ...(canManageSystem ? [{ key: '/business-entities', icon: <BankOutlined />, label: '行號管理' }] : []),
        ...(canManageSystem ? [{ key: '/contracts', icon: <FileTextOutlined />, label: '合約管理' }] : []),
      ],
    },
    {
      key: 'operations',
      icon: <CarOutlined />,
      label: '營運管理',
      children: [
        { key: '/trips', icon: <CarOutlined />, label: '車趟管理' },
        ...(canManageSystem ? [{ key: '/sync', icon: <SyncOutlined />, label: '外部同步' }] : []),
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
    ...(canManageSystem ? [{
      key: 'system',
      icon: <UserOutlined />,
      label: '系統',
      children: [
        { key: '/users', icon: <UserOutlined />, label: '使用者' },
        { key: '/holidays', icon: <CalendarOutlined />, label: '假日設定' },
        { key: '/schedule', icon: <ClockCircleOutlined />, label: '排程管理' },
      ],
    }] : []),
  ]
}

// 取得目前路徑對應的展開 SubMenu keys
function getOpenKeys(pathname: string, items: ReturnType<typeof getMenuItems>): string[] {
  for (const item of items) {
    if ('children' in item && item.children) {
      for (const child of item.children) {
        if (child.key === pathname || pathname.startsWith(child.key + '/')) {
          return [item.key]
        }
      }
    }
  }
  return []
}

export default function AppLayout() {
  const { isMobile, isDesktop } = useResponsive()
  const { user, logout, canManageSystem, isSuperAdmin, isSiteManager } = useAuth()

  // 角色標籤
  const roleLabels: Record<string, string> = {
    super_admin: '系統管理員',
    site_manager: '站區主管',
    site_staff: '站區人員',
  }
  const menuItems = getMenuItems(canManageSystem)
  const navigate = useNavigate()
  const location = useLocation()
  const { token: themeToken } = theme.useToken()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeys(location.pathname, menuItems))

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isMobile && user?.role && (
              <Tag color={isSuperAdmin ? 'red' : isSiteManager ? 'blue' : 'default'}>
                {roleLabels[user.role] ?? user.role}
              </Tag>
            )}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />}>
                {!isMobile && (user?.name || user?.username || '使用者')}
              </Button>
            </Dropdown>
          </div>
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

import { useState } from 'react'
import { Layout, Menu, Button, Typography, Dropdown, Avatar, theme } from 'antd'
import {
  DashboardOutlined,
  BankOutlined,
  TeamOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// 選單項目定義
interface MenuItem {
  key: string
  icon: React.ReactNode
  label: string
  roles?: string[]
  children?: { key: string; label: string }[]
}

const menuItems: MenuItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: '儀表板' },
  { key: '/sites', icon: <BankOutlined />, label: '站點管理', roles: ['system_admin'] },
  { key: '/customers', icon: <TeamOutlined />, label: '客戶管理' },
  { key: '/item-prices', icon: <FileTextOutlined />, label: '品項管理' },
  {
    key: 'data',
    icon: <DatabaseOutlined />,
    label: '資料管理',
    children: [
      { key: '/data/import', label: '手動匯入' },
      { key: '/data/trips', label: '車趟記錄查詢' },
      { key: '/data/items', label: '品項收取查詢' },
    ],
  },
  { key: '/reports', icon: <BarChartOutlined />, label: '報表管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '系統設定', roles: ['system_admin'] },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { token: themeToken } = theme.useToken()

  // 依角色過濾選單
  const filteredItems = menuItems.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(user?.role || '')
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: `${user?.name}（${user?.role}）`, disabled: true },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '登出', danger: true },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Text strong style={{ fontSize: collapsed ? 14 : 16 }}>
            {collapsed ? '回收' : '回收業務管理'}
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['data']}
          items={filteredItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && handleLogout() }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} />
              <Text>{user?.name}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

import { Button, Card, Typography } from 'antd'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={3}>儀表板</Title>
        <Text>歡迎，{user?.name}（{user?.role}）</Text>
        <br /><br />
        <Text type="secondary">系統功能開發中，請期待後續更新。</Text>
        <br /><br />
        <Button danger onClick={handleLogout}>登出</Button>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const { Title } = Typography

interface LoginForm {
  username: string
  password: string
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      message.success('登入成功')
      navigate('/dashboard', { replace: true })
    } catch (error: unknown) {
      // 顯示後端回傳的錯誤訊息
      const err = error as { response?: { data?: { message?: string } } }
      const errorMessage = err.response?.data?.message || '登入失敗，請檢查帳號密碼'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            回收業務自動化系統
          </Title>
          <Typography.Text type="secondary">請輸入帳號密碼登入</Typography.Text>
        </div>

        <Form<LoginForm>
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '請輸入帳號' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="帳號"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '請輸入密碼' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密碼"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登入
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

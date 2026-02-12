import { Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../contexts/AuthContext'

// 路由守衛：未認證導向登入頁
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  // 載入中顯示 loading
  if (isLoading) {
    return <Spin size="large" fullscreen />
  }

  // 未認證導向登入頁
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

import { ConfigProvider } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import zhTW from 'antd/locale/zh_TW'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <ConfigProvider locale={zhTW}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* 受保護的路由，使用 AppLayout 外殼 */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="sites" element={<div>站點管理（待實作）</div>} />
              <Route path="customers" element={<div>客戶管理（待實作）</div>} />
              <Route path="customers/:id/contracts" element={<div>合約管理（待實作）</div>} />
              <Route path="item-prices" element={<div>品項管理（待實作）</div>} />
              <Route path="data/import" element={<div>手動匯入（待實作）</div>} />
              <Route path="data/trips" element={<div>車趟查詢（待實作）</div>} />
              <Route path="data/items" element={<div>品項查詢（待實作）</div>} />
              <Route path="reports" element={<div>報表管理（待實作）</div>} />
              <Route path="settings" element={<div>系統設定（待實作）</div>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App

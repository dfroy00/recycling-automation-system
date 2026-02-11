import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhTW from 'antd/locale/zh_TW'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SitesPage from './pages/SitesPage'
import ItemsPage from './pages/ItemsPage'
import UsersPage from './pages/UsersPage'
import HolidaysPage from './pages/HolidaysPage'
import CustomersPage from './pages/CustomersPage'
import ContractsPage from './pages/ContractsPage'
import TripsPage from './pages/TripsPage'
import SyncPage from './pages/SyncPage'
import StatementsPage from './pages/StatementsPage'
import ReportsPage from './pages/ReportsPage'
import SchedulePage from './pages/SchedulePage'

// React Query 客戶端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <ConfigProvider locale={zhTW}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* 登入頁（不需認證） */}
              <Route path="/login" element={<LoginPage />} />

              {/* 需要認證的頁面 */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/sites" element={<SitesPage />} />
                <Route path="/items" element={<ItemsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/trips" element={<TripsPage />} />
                <Route path="/sync" element={<SyncPage />} />
                <Route path="/statements" element={<StatementsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/holidays" element={<HolidaysPage />} />
                <Route path="/schedule" element={<SchedulePage />} />
              </Route>

              {/* 根路徑導向儀表板 */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* 404 導向儀表板 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}

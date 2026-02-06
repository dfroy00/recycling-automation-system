import { ConfigProvider } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import zhTW from 'antd/locale/zh_TW'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SitesPage from './pages/SitesPage'
import CustomersPage from './pages/CustomersPage'
import ContractsPage from './pages/ContractsPage'
import ItemPricesPage from './pages/ItemPricesPage'
import DataImportPage from './pages/DataImportPage'
import TripQueryPage from './pages/TripQueryPage'
import ItemQueryPage from './pages/ItemQueryPage'
import NotificationsPage from './pages/NotificationsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

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
              <Route path="sites" element={<SitesPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id/contracts" element={<ContractsPage />} />
              <Route path="item-prices" element={<ItemPricesPage />} />
              <Route path="data/import" element={<DataImportPage />} />
              <Route path="data/trips" element={<TripQueryPage />} />
              <Route path="data/items" element={<ItemQueryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App

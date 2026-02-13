import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { message } from 'antd'
import apiClient from '../api/client'

// 使用者型別
interface User {
  id: number
  username: string
  name: string
  email: string | null
  role: string
  siteId: number | null
}

// 認證上下文型別
interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isSuperAdmin: boolean
  isSiteManager: boolean
  isSiteStaff: boolean
  canEdit: boolean            // super_admin 或 site_manager
  canManageSystem: boolean    // 僅 super_admin
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// 認證 Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  // 驗證現有 token
  const verifyToken = useCallback(async () => {
    const savedToken = localStorage.getItem('token')
    if (!savedToken) {
      setIsLoading(false)
      return
    }

    try {
      const response = await apiClient.get('/auth/me')
      setUser(response.data)
      setToken(savedToken)
    } catch {
      // token 無效，清除
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    verifyToken()
  }, [verifyToken])

  // 登入
  const login = async (username: string, password: string) => {
    const response = await apiClient.post('/auth/login', { username, password })
    const { token: newToken, user: userData } = response.data

    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(userData)
  }

  // 登出
  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    message.success('已登出')
  }

  // 角色判斷 helper
  const isSuperAdmin = user?.role === 'super_admin'
  const isSiteManager = user?.role === 'site_manager'
  const isSiteStaff = user?.role === 'site_staff'
  const canEdit = isSuperAdmin || isSiteManager
  const canManageSystem = isSuperAdmin

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        isSuperAdmin,
        isSiteManager,
        isSiteStaff,
        canEdit,
        canManageSystem,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// 使用認證上下文的 Hook
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必須在 AuthProvider 內使用')
  }
  return context
}

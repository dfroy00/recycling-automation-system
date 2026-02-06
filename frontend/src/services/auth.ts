import api from './api'

export interface LoginRequest {
  username: string
  password: string
}

export interface User {
  userId: number
  username: string
  name: string
  role: string
  siteId?: string | null
  email?: string | null
}

export interface LoginResponse {
  token: string
  user: User
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', data)
  return res.data
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await api.get('/health')
    return res.data.status === 'ok'
  } catch {
    return false
  }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { message } from 'antd'

// 通用分頁查詢 Hook
export function usePaginatedQuery<T>(
  key: string[],
  url: string,
  params?: Record<string, unknown>
) {
  return useQuery({
    queryKey: [...key, params],
    queryFn: async () => {
      const res = await api.get<{ data: T[]; total: number }>(url, { params })
      return res.data
    },
  })
}

// 通用新增 Mutation
export function useCreateMutation(url: string, invalidateKeys: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post(url, data),
    onSuccess: () => {
      invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
      message.success('新增成功')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message || '新增失敗')
    },
  })
}

// 通用更新 Mutation
export function useUpdateMutation(url: string, invalidateKeys: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: unknown }) =>
      api.put(`${url}/${id}`, data),
    onSuccess: () => {
      invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
      message.success('更新成功')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message || '更新失敗')
    },
  })
}

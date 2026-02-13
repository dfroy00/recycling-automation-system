import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import apiClient from './client'
import type {
  PaginatedResponse,
  Site, SiteFormData,
  Item, ItemFormData,
  User, UserFormData,
  Holiday, HolidayFormData,
  BusinessEntity, BusinessEntityFormData,
  Customer, CustomerFormData,
  CustomerFee, CustomerFeeFormData,
  Contract, ContractFormData,
  ContractItem, ContractItemFormData,
  DashboardStats,
  Trip, TripFormData,
  TripItem, TripItemFormData,
  Statement,
  SyncResult, SyncStatus,
  ScheduleJob,
} from '../types'

// 輔助：將後端 all=true 回傳的純陣列統一轉為 PaginatedResponse 格式
function normalizePaginatedResponse<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return {
      data,
      pagination: { page: 1, pageSize: data.length, total: data.length, totalPages: 1 },
    }
  }
  return data
}

// ==================== 儀表板 ====================

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/stats')
      return data
    },
    staleTime: 30 * 1000, // 30 秒快取
  })
}

// ==================== 站區 ====================

export function useSites(params?: { page?: number; pageSize?: number; all?: boolean; status?: string }) {
  return useQuery<PaginatedResponse<Site>>({
    queryKey: ['sites', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/sites', { params })
      return normalizePaginatedResponse<Site>(data)
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘快取（站區不常變動）
  })
}

export function useCreateSite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: SiteFormData) => {
      const { data } = await apiClient.post('/sites', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      message.success('站區新增成功')
    },
    onError: () => {
      message.error('站區新增失敗')
    },
  })
}

export function useUpdateSite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: SiteFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/sites/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      message.success('站區更新成功')
    },
    onError: () => {
      message.error('站區更新失敗')
    },
  })
}

export function useDeactivateSite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/sites/${id}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      message.success('站區已停用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '站區停用失敗')
    },
  })
}

export function useDeleteSite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/sites/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      message.success('站區已刪除')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '站區刪除失敗')
    },
  })
}

export function useReactivateSite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/sites/${id}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      message.success('站區已啟用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '站區啟用失敗')
    },
  })
}

// ==================== 品項 ====================

export function useItems(params?: { page?: number; pageSize?: number; category?: string; all?: boolean; status?: string }) {
  return useQuery<PaginatedResponse<Item>>({
    queryKey: ['items', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/items', { params })
      return normalizePaginatedResponse<Item>(data)
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘快取（品項不常變動）
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: ItemFormData) => {
      const { data } = await apiClient.post('/items', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      message.success('品項新增成功')
    },
    onError: () => {
      message.error('品項新增失敗')
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: ItemFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/items/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      message.success('品項更新成功')
    },
    onError: () => {
      message.error('品項更新失敗')
    },
  })
}

export function useDeactivateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/items/${id}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      message.success('品項已停用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '品項停用失敗')
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/items/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      message.success('品項已刪除')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '品項刪除失敗')
    },
  })
}

export function useReactivateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/items/${id}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      message.success('品項已啟用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '品項啟用失敗')
    },
  })
}

// ==================== 行號 ====================

export function useBusinessEntities(params?: { page?: number; pageSize?: number; all?: boolean; status?: string }) {
  return useQuery<PaginatedResponse<BusinessEntity>>({
    queryKey: ['businessEntities', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/business-entities', { params })
      return normalizePaginatedResponse<BusinessEntity>(data)
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘快取（行號不常變動）
  })
}

export function useCreateBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: BusinessEntityFormData) => {
      const { data } = await apiClient.post('/business-entities', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號新增成功')
    },
    onError: () => {
      message.error('行號新增失敗')
    },
  })
}

export function useUpdateBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: BusinessEntityFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/business-entities/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號更新成功')
    },
    onError: () => {
      message.error('行號更新失敗')
    },
  })
}

export function useDeactivateBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/business-entities/${id}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號已停用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '行號停用失敗')
    },
  })
}

export function useDeleteBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/business-entities/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號已刪除')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '行號刪除失敗')
    },
  })
}

export function useReactivateBusinessEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/business-entities/${id}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessEntities'] })
      message.success('行號已啟用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '行號啟用失敗')
    },
  })
}

// ==================== 使用者 ====================

// 後端 GET /users 回傳純陣列，不支援分頁
export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users')
      return data
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: UserFormData) => {
      const { data } = await apiClient.post('/users', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('使用者新增成功')
    },
    onError: () => {
      message.error('使用者新增失敗')
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: UserFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/users/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('使用者更新成功')
    },
    onError: () => {
      message.error('使用者更新失敗')
    },
  })
}

export function useDeactivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/users/${id}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('使用者已停用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '使用者停用失敗')
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('使用者已刪除')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '使用者刪除失敗')
    },
  })
}

export function useReactivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/users/${id}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('使用者已啟用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '使用者啟用失敗')
    },
  })
}

// ==================== 假日 ====================

// 後端 GET /holidays 回傳純陣列，不支援分頁
export function useHolidays(params?: { year?: number }) {
  return useQuery<Holiday[]>({
    queryKey: ['holidays', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/holidays', { params })
      return data
    },
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: HolidayFormData) => {
      const { data } = await apiClient.post('/holidays', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] })
      message.success('假日新增成功')
    },
    onError: () => {
      message.error('假日新增失敗')
    },
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/holidays/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] })
      message.success('假日刪除成功')
    },
    onError: () => {
      message.error('假日刪除失敗')
    },
  })
}

export function useImportHolidays() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (holidays: HolidayFormData[]) => {
      const { data } = await apiClient.post('/holidays/import', holidays)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] })
      message.success('假日批次匯入成功')
    },
    onError: () => {
      message.error('假日批次匯入失敗')
    },
  })
}

// ==================== 客戶 ====================

export function useCustomers(params?: { page?: number; pageSize?: number; siteId?: number; type?: string; search?: string; status?: string }) {
  return useQuery<PaginatedResponse<Customer>>({
    queryKey: ['customers', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/customers', { params })
      return normalizePaginatedResponse<Customer>(data)
    },
  })
}

export function useCustomer(id: number | null) {
  return useQuery<Customer>({
    queryKey: ['customers', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/customers/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: CustomerFormData) => {
      const { data } = await apiClient.post('/customers', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('客戶新增成功')
    },
    onError: () => {
      message.error('客戶新增失敗')
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: CustomerFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/customers/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('客戶更新成功')
    },
    onError: () => {
      message.error('客戶更新失敗')
    },
  })
}

export function useDeactivateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/customers/${id}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('客戶已停用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '客戶停用失敗')
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/customers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('客戶已刪除')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '客戶刪除失敗')
    },
  })
}

export function useReactivateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/customers/${id}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('客戶已啟用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '客戶啟用失敗')
    },
  })
}

// ==================== 客戶附加費用 ====================

export function useCustomerFees(customerId: number | null) {
  return useQuery<CustomerFee[]>({
    queryKey: ['customers', customerId, 'fees'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/customers/${customerId}/fees`)
      return data
    },
    enabled: !!customerId,
  })
}

export function useCreateCustomerFee(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: CustomerFeeFormData) => {
      const { data } = await apiClient.post(`/customers/${customerId}/fees`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'fees'] })
      message.success('附加費用新增成功')
    },
    onError: () => {
      message.error('附加費用新增失敗')
    },
  })
}

export function useUpdateCustomerFee(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: CustomerFeeFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/customers/${customerId}/fees/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'fees'] })
      message.success('附加費用更新成功')
    },
    onError: () => {
      message.error('附加費用更新失敗')
    },
  })
}

export function useDeactivateCustomerFee(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feeId: number) => {
      await apiClient.patch(`/customers/${customerId}/fees/${feeId}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'fees'] })
      message.success('附加費用已停用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '附加費用停用失敗')
    },
  })
}

export function useDeleteCustomerFee(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feeId: number) => {
      await apiClient.delete(`/customers/${customerId}/fees/${feeId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'fees'] })
      message.success('附加費用已刪除')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '附加費用刪除失敗')
    },
  })
}

export function useReactivateCustomerFee(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feeId: number) => {
      await apiClient.patch(`/customers/${customerId}/fees/${feeId}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'fees'] })
      message.success('附加費用已啟用')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '附加費用啟用失敗')
    },
  })
}

// ==================== 合約 ====================

export function useContracts(params?: { page?: number; pageSize?: number; customerId?: number; status?: string }) {
  return useQuery<PaginatedResponse<Contract>>({
    queryKey: ['contracts', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/contracts', { params })
      return normalizePaginatedResponse<Contract>(data)
    },
  })
}

export function useCreateContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: ContractFormData) => {
      const { data } = await apiClient.post('/contracts', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      // 合約與客戶類型聯動：新增合約可能更新客戶類型
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('合約新增成功')
    },
    onError: () => {
      message.error('合約新增失敗')
    },
  })
}

export function useUpdateContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: ContractFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/contracts/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      // 合約與客戶類型聯動：更新合約狀態可能影響客戶類型
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('合約更新成功')
    },
    onError: () => {
      message.error('合約更新失敗')
    },
  })
}

export function useDeleteContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/contracts/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      // 合約與客戶類型聯動：終止合約可能更新客戶類型
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      message.success('合約已終止')
    },
    onError: () => {
      message.error('合約終止失敗')
    },
  })
}

// ==================== 合約品項 ====================

export function useContractItems(contractId: number | null) {
  return useQuery<ContractItem[]>({
    queryKey: ['contracts', contractId, 'items'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/contracts/${contractId}/items`)
      return data
    },
    enabled: !!contractId,
  })
}

export function useCreateContractItem(contractId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: ContractItemFormData) => {
      const { data } = await apiClient.post(`/contracts/${contractId}/items`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', contractId, 'items'] })
      message.success('合約品項新增成功')
    },
    onError: () => {
      message.error('合約品項新增失敗')
    },
  })
}

export function useUpdateContractItem(contractId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: ContractItemFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/contracts/${contractId}/items/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', contractId, 'items'] })
      message.success('合約品項更新成功')
    },
    onError: () => {
      message.error('合約品項更新失敗')
    },
  })
}

export function useDeleteContractItem(contractId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: number) => {
      await apiClient.delete(`/contracts/${contractId}/items/${itemId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', contractId, 'items'] })
      message.success('合約品項刪除成功')
    },
    onError: () => {
      message.error('合約品項刪除失敗')
    },
  })
}

// ==================== 車趟 ====================

export function useTrips(params?: {
  page?: number; pageSize?: number;
  customerId?: number; siteId?: number;
  dateFrom?: string; dateTo?: string;
}) {
  return useQuery<PaginatedResponse<Trip>>({
    queryKey: ['trips', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/trips', { params })
      return normalizePaginatedResponse<Trip>(data)
    },
  })
}

export function useTrip(id: number | null) {
  return useQuery<Trip>({
    queryKey: ['trips', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/trips/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: TripFormData) => {
      const { data } = await apiClient.post('/trips', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      message.success('車趟新增成功')
    },
    onError: () => {
      message.error('車趟新增失敗')
    },
  })
}

export function useUpdateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...formData }: TripFormData & { id: number }) => {
      const { data } = await apiClient.patch(`/trips/${id}`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      message.success('車趟更新成功')
    },
    onError: () => {
      message.error('車趟更新失敗')
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/trips/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      message.success('車趟刪除成功')
    },
    onError: () => {
      message.error('車趟刪除失敗')
    },
  })
}

// ==================== 車趟品項 ====================

export function useTripItems(tripId: number | null) {
  return useQuery<TripItem[]>({
    queryKey: ['trips', tripId, 'items'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/trips/${tripId}/items`)
      return data
    },
    enabled: !!tripId,
  })
}

export function useCreateTripItem(tripId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: TripItemFormData) => {
      const { data } = await apiClient.post(`/trips/${tripId}/items`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'items'] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      message.success('品項新增成功')
    },
    onError: () => {
      message.error('品項新增失敗')
    },
  })
}

export function useDeleteTripItem(tripId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: number) => {
      await apiClient.delete(`/trips/${tripId}/items/${itemId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'items'] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      message.success('品項刪除成功')
    },
    onError: () => {
      message.error('品項刪除失敗')
    },
  })
}

// ==================== 月結明細 ====================

export function useStatements(params?: {
  page?: number; pageSize?: number;
  yearMonth?: string; status?: string;
  customerId?: number;
}) {
  return useQuery<PaginatedResponse<Statement>>({
    queryKey: ['statements', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/statements', { params })
      return data
    },
  })
}

export function useStatement(id: number | null) {
  return useQuery<Statement>({
    queryKey: ['statements', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/statements/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useGenerateStatements() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params?: { yearMonth?: string; customerId?: number }) => {
      const { data } = await apiClient.post('/statements/generate', params)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statements'] })
      message.success('月結產出已排入處理')
    },
    onError: () => {
      message.error('月結產出失敗')
    },
  })
}

export function useReviewStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'approve' | 'reject' }) => {
      const { data } = await apiClient.patch(`/statements/${id}/review`, { action })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statements'] })
      message.success('審核操作成功')
    },
    onError: () => {
      message.error('審核操作失敗')
    },
  })
}

export function useInvoiceStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.patch(`/statements/${id}/invoice`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statements'] })
      message.success('已標記開票')
    },
    onError: () => {
      message.error('標記開票失敗')
    },
  })
}

export function useSendStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post(`/statements/${id}/send`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statements'] })
      message.success('寄送成功')
    },
    onError: () => {
      message.error('寄送失敗')
    },
  })
}

export function useVoidStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const { data } = await apiClient.post(`/statements/${id}/void`, { reason })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statements'] })
      message.success('明細已作廢')
    },
    onError: () => {
      message.error('作廢失敗')
    },
  })
}

// ==================== 同步 ====================

export function useSyncStatus() {
  return useQuery<SyncStatus>({
    queryKey: ['sync', 'status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/sync/status')
      return data
    },
  })
}

export function useSyncPosPull() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { dateFrom: string; dateTo: string }) => {
      const { data } = await apiClient.post<SyncResult>('/sync/pos/pull', params)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      message.success(`POS 同步完成：新增 ${data.created ?? 0} 筆`)
    },
    onError: () => {
      message.error('POS 同步失敗')
    },
  })
}

export function useSyncVehiclePull() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { dateFrom: string; dateTo: string }) => {
      const { data } = await apiClient.post<SyncResult>('/sync/vehicle/pull', params)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      message.success(`車機同步完成：新增 ${data.created ?? 0} 筆`)
    },
    onError: () => {
      message.error('車機同步失敗')
    },
  })
}

export function useMockGenerate() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ message: string; posRecords: number; vehicleTrips: number }>('/sync/mock/generate')
      return data
    },
    onSuccess: (data) => {
      message.success(`Mock 資料產生成功：POS ${data.posRecords} 筆，車機 ${data.vehicleTrips} 筆`)
    },
    onError: () => {
      message.error('Mock 資料產生失敗')
    },
  })
}

// ==================== 排程 ====================

export function useScheduleJobs() {
  return useQuery<ScheduleJob[]>({
    queryKey: ['schedule'],
    queryFn: async () => {
      const { data } = await apiClient.get('/schedule')
      return data
    },
  })
}

export function useTriggerJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.post(`/schedule/${name}/trigger`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      message.success('排程已手動觸發')
    },
    onError: () => {
      message.error('排程觸發失敗')
    },
  })
}

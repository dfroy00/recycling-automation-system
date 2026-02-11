// ==================== 分頁回應 ====================
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// ==================== 站區 ====================
export interface Site {
  id: number
  name: string
  address: string | null
  phone: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface SiteFormData {
  name: string
  address?: string | null
  phone?: string | null
  status?: string
}

// ==================== 品項 ====================
export interface Item {
  id: number
  name: string
  category: string | null
  unit: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ItemFormData {
  name: string
  category?: string | null
  unit: string
  status?: string
}

// ==================== 使用者 ====================
export interface User {
  id: number
  username: string
  name: string
  email: string | null
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface UserFormData {
  username: string
  password?: string
  name: string
  email?: string | null
  role?: string
  status?: string
}

// ==================== 假日 ====================
export interface Holiday {
  id: number
  date: string
  name: string
  year: number
  createdAt: string
}

export interface HolidayFormData {
  date: string
  name: string
  year: number
}

// ==================== 客戶 ====================
export interface Customer {
  id: number
  siteId: number
  name: string
  contactPerson: string | null
  phone: string | null
  address: string | null
  type: string
  tripFeeEnabled: boolean
  tripFeeType: string | null
  tripFeeAmount: string | null
  statementType: string
  paymentType: string
  statementSendDay: number | null
  paymentDueDay: number | null
  invoiceRequired: boolean
  invoiceType: string | null
  notificationMethod: string
  notificationEmail: string | null
  notificationLineId: string | null
  paymentAccount: string | null
  status: string
  createdAt: string
  updatedAt: string
  site?: Site
}

export interface CustomerFormData {
  siteId: number
  name: string
  contactPerson?: string | null
  phone?: string | null
  address?: string | null
  type: string
  tripFeeEnabled?: boolean
  tripFeeType?: string | null
  tripFeeAmount?: number | null
  statementType?: string
  paymentType?: string
  statementSendDay?: number | null
  paymentDueDay?: number | null
  invoiceRequired?: boolean
  invoiceType?: string | null
  notificationMethod?: string
  notificationEmail?: string | null
  notificationLineId?: string | null
  paymentAccount?: string | null
  status?: string
}

// ==================== 客戶附加費用 ====================
export interface CustomerFee {
  id: number
  customerId: number
  name: string
  amount: string
  billingDirection: string
  frequency: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CustomerFeeFormData {
  name: string
  amount: number
  billingDirection: string
  frequency: string
  status?: string
}

// ==================== 合約 ====================
export interface Contract {
  id: number
  customerId: number
  contractNumber: string
  startDate: string
  endDate: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  customer?: Customer
}

// ==================== 合約品項 ====================
export interface ContractItem {
  id: number
  contractId: number
  itemId: number
  unitPrice: string
  billingDirection: string
  createdAt: string
  updatedAt: string
  item?: Item
}

export interface ContractFormData {
  customerId: number
  contractNumber: string
  startDate: string
  endDate: string
  status?: string
  notes?: string | null
}

export interface ContractItemFormData {
  itemId: number
  unitPrice: number
  billingDirection: string
}

// ==================== 車趟 ====================
export interface Trip {
  id: number
  customerId: number
  siteId: number
  tripDate: string
  tripTime: string | null
  driver: string | null
  vehiclePlate: string | null
  source: string
  externalId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  customer?: Customer
  site?: Site
  items?: TripItem[]
}

export interface TripFormData {
  customerId: number
  siteId: number
  tripDate: string
  tripTime?: string | null
  driver?: string | null
  vehiclePlate?: string | null
  notes?: string | null
}

export interface TripItem {
  id: number
  tripId: number
  itemId: number
  quantity: string
  unit: string
  unitPrice: string
  billingDirection: string
  amount: string
  createdAt: string
  item?: Item
}

export interface TripItemFormData {
  itemId: number
  quantity: number
  manualPrice?: number
  manualDirection?: string
}

// ==================== 月結明細 ====================
export interface Statement {
  id: number
  customerId: number
  statementType: string
  tripId: number | null
  yearMonth: string
  itemReceivable: string
  itemPayable: string
  tripFeeTotal: string
  additionalFeeReceivable: string
  additionalFeePayable: string
  totalReceivable: string
  totalPayable: string
  netAmount: string
  subtotal: string
  taxAmount: string
  totalAmount: string
  detailJson: unknown | null
  status: string
  reviewedBy: number | null
  reviewedAt: string | null
  sentAt: string | null
  sentMethod: string | null
  sendRetryCount: number
  sendError: string | null
  voidedAt: string | null
  voidedBy: number | null
  voidReason: string | null
  createdAt: string
  updatedAt: string
  customer?: Customer
}

// ==================== 同步 ====================
export interface SyncResult {
  success: boolean
  message: string
  created?: number
  skipped?: number
  matched?: number
  errors?: string[]
}

// 後端回傳格式：{ pos: { status, mode }, vehicle: { status, mode } }
export interface SyncStatus {
  pos: { status: string; mode: string }
  vehicle: { status: string; mode: string }
}

// ==================== 排程 ====================
export interface ScheduleJob {
  name: string
  description: string
  cron: string
  lastRun: string | null
  nextRun: string | null
  status: string
}

// ==================== 儀表板 ====================
export interface DashboardStats {
  monthlyTrips: number
  totalReceivable: number
  totalPayable: number
  customerCount: number
  pendingReviews: number
  expiringContracts: {
    customerId: number
    customerName: string
    contractNumber: string
    endDate: string
    daysRemaining: number
  }[]
  pendingItems: {
    type: string
    count: number
    label: string
    link: string
  }[]
}

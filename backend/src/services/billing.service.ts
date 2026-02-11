// backend/src/services/billing.service.ts
import prisma from '../lib/prisma'

export interface BillingResult {
  itemReceivable: number
  itemPayable: number
  tripFeeTotal: number
  additionalFeeReceivable: number
  additionalFeePayable: number
  totalReceivable: number
  totalPayable: number
  netAmount: number
  subtotal: number
  taxAmount: number
  totalAmount: number
  // 分開開票時有值
  receivableSubtotal?: number
  receivableTax?: number
  receivableTotal?: number
  payableSubtotal?: number
  payableTax?: number
  payableTotal?: number
  // 明細
  details: {
    items: TripItemDetail[]
    tripFee: { count: number; amount: number; type: string | null }
    fees: AdditionalFeeDetail[]
  }
}

export interface TripItemDetail {
  tripId: number
  tripDate: Date
  itemId: number
  itemName: string
  quantity: number
  unit: string
  unitPrice: number
  billingDirection: string
  amount: number
}

export interface AdditionalFeeDetail {
  name: string
  amount: number
  direction: string
  frequency: string
}

// 計算月結明細
export async function calculateMonthlyBilling(customerId: number, yearMonth: string): Promise<BillingResult> {
  const [yearStr, monthStr] = yearMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  // 查詢客戶
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { fees: { where: { status: 'active' } } },
  })
  if (!customer) throw new Error('客戶不存在')

  // 查詢本月車趟及品項
  const trips = await prisma.trip.findMany({
    where: {
      customerId,
      tripDate: { gte: monthStart, lte: monthEnd },
    },
    include: {
      items: {
        include: { item: { select: { id: true, name: true } } },
      },
    },
  })

  const tripCount = trips.length

  // 品項明細
  const itemDetails: TripItemDetail[] = []
  let itemReceivable = 0
  let itemPayable = 0

  for (const trip of trips) {
    for (const ti of trip.items) {
      const amount = Number(ti.amount)
      itemDetails.push({
        tripId: trip.id,
        tripDate: trip.tripDate,
        itemId: ti.itemId,
        itemName: ti.item.name,
        quantity: Number(ti.quantity),
        unit: ti.unit,
        unitPrice: Number(ti.unitPrice),
        billingDirection: ti.billingDirection,
        amount,
      })
      if (ti.billingDirection === 'receivable') {
        itemReceivable += amount
      } else if (ti.billingDirection === 'payable') {
        itemPayable += amount
      }
      // free 不計入
    }
  }

  // 車趟費
  let tripFeeTotal = 0
  let tripFeeType = customer.tripFeeType
  if (customer.tripFeeEnabled && customer.tripFeeAmount) {
    if (customer.tripFeeType === 'per_trip') {
      tripFeeTotal = tripCount * Number(customer.tripFeeAmount)
    } else if (customer.tripFeeType === 'per_month') {
      tripFeeTotal = Number(customer.tripFeeAmount)
    }
  }

  // 附加費用
  let additionalFeeReceivable = 0
  let additionalFeePayable = 0
  const feeDetails: AdditionalFeeDetail[] = []

  for (const fee of customer.fees) {
    let feeAmount = Number(fee.amount)
    if (fee.frequency === 'per_trip') {
      feeAmount = feeAmount * tripCount
    }
    // monthly 直接加

    feeDetails.push({
      name: fee.name,
      amount: feeAmount,
      direction: fee.billingDirection,
      frequency: fee.frequency,
    })

    if (fee.billingDirection === 'receivable') {
      additionalFeeReceivable += feeAmount
    } else {
      additionalFeePayable += feeAmount
    }
  }

  // 車趟費固定為應收
  const totalReceivable = itemReceivable + tripFeeTotal + additionalFeeReceivable
  const totalPayable = itemPayable + additionalFeePayable
  const netAmount = totalReceivable - totalPayable

  // 稅額計算
  let subtotal: number
  let taxAmount: number
  let totalAmount: number
  let receivableSubtotal: number | undefined
  let receivableTax: number | undefined
  let receivableTotal: number | undefined
  let payableSubtotal: number | undefined
  let payableTax: number | undefined
  let payableTotal: number | undefined

  if (customer.invoiceType === 'separate') {
    // 分開開票
    receivableSubtotal = totalReceivable
    receivableTax = Math.round(totalReceivable * 0.05)
    receivableTotal = receivableSubtotal + receivableTax
    payableSubtotal = totalPayable
    payableTax = Math.round(totalPayable * 0.05)
    payableTotal = payableSubtotal + payableTax
    subtotal = netAmount
    taxAmount = receivableTax - payableTax
    totalAmount = receivableTotal - payableTotal
  } else {
    // 淨額開票（預設）
    subtotal = netAmount
    taxAmount = Math.round(Math.abs(netAmount) * 0.05) * (netAmount >= 0 ? 1 : -1)
    totalAmount = subtotal + taxAmount
  }

  return {
    itemReceivable,
    itemPayable,
    tripFeeTotal,
    additionalFeeReceivable,
    additionalFeePayable,
    totalReceivable,
    totalPayable,
    netAmount,
    subtotal,
    taxAmount,
    totalAmount,
    receivableSubtotal,
    receivableTax,
    receivableTotal,
    payableSubtotal,
    payableTax,
    payableTotal,
    details: {
      items: itemDetails,
      tripFee: { count: tripCount, amount: tripFeeTotal, type: tripFeeType },
      fees: feeDetails,
    },
  }
}

// 計算按趟明細
export async function calculateTripBilling(tripId: number): Promise<BillingResult> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      customer: {
        include: { fees: { where: { status: 'active' } } },
      },
      items: {
        include: { item: { select: { id: true, name: true } } },
      },
    },
  })
  if (!trip) throw new Error('車趟不存在')

  const customer = trip.customer

  // 品項明細
  const itemDetails: TripItemDetail[] = []
  let itemReceivable = 0
  let itemPayable = 0

  for (const ti of trip.items) {
    const amount = Number(ti.amount)
    itemDetails.push({
      tripId: trip.id,
      tripDate: trip.tripDate,
      itemId: ti.itemId,
      itemName: ti.item.name,
      quantity: Number(ti.quantity),
      unit: ti.unit,
      unitPrice: Number(ti.unitPrice),
      billingDirection: ti.billingDirection,
      amount,
    })
    if (ti.billingDirection === 'receivable') {
      itemReceivable += amount
    } else if (ti.billingDirection === 'payable') {
      itemPayable += amount
    }
  }

  // 車趟費（按次）
  let tripFeeTotal = 0
  if (customer.tripFeeEnabled && customer.tripFeeAmount) {
    if (customer.tripFeeType === 'per_trip') {
      tripFeeTotal = Number(customer.tripFeeAmount)
    }
    // per_month 不在按趟明細中計算
  }

  // 按趟附加費用（只算 per_trip 頻率的）
  let additionalFeeReceivable = 0
  let additionalFeePayable = 0
  const feeDetails: AdditionalFeeDetail[] = []

  for (const fee of customer.fees) {
    if (fee.frequency !== 'per_trip') continue
    const feeAmount = Number(fee.amount)
    feeDetails.push({
      name: fee.name,
      amount: feeAmount,
      direction: fee.billingDirection,
      frequency: fee.frequency,
    })
    if (fee.billingDirection === 'receivable') {
      additionalFeeReceivable += feeAmount
    } else {
      additionalFeePayable += feeAmount
    }
  }

  const totalReceivable = itemReceivable + tripFeeTotal + additionalFeeReceivable
  const totalPayable = itemPayable + additionalFeePayable
  const netAmount = totalReceivable - totalPayable

  const subtotal = netAmount
  const taxAmount = Math.round(Math.abs(netAmount) * 0.05) * (netAmount >= 0 ? 1 : -1)
  const totalAmount = subtotal + taxAmount

  return {
    itemReceivable,
    itemPayable,
    tripFeeTotal,
    additionalFeeReceivable,
    additionalFeePayable,
    totalReceivable,
    totalPayable,
    netAmount,
    subtotal,
    taxAmount,
    totalAmount,
    details: {
      items: itemDetails,
      tripFee: { count: 1, amount: tripFeeTotal, type: customer.tripFeeType },
      fees: feeDetails,
    },
  }
}

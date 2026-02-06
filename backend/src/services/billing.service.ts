// backend/src/services/billing.service.ts
import { Decimal } from '@prisma/client'

// 車趟摘要（每日車趟次數）
export interface TripSummary {
  tripDate: Date
  tripCount: number
}

// 品項摘要（月度彙總）
export interface ItemSummary {
  itemName: string
  totalWeight: Decimal
  unitPrice: Decimal
  priceType: 'standard' | 'contract'
}

// 品項明細行
export interface ItemDetail {
  itemName: string
  totalWeight: Decimal
  unitPrice: Decimal
  subtotal: Decimal
  priceType: 'standard' | 'contract'
}

// 計費結果
export interface BillingResult {
  billingType: string
  tripCount: number
  tripFee: Decimal
  itemFee: Decimal
  totalAmount: Decimal
  tripDetails: TripSummary[]
  itemDetails: ItemDetail[]
  anomaly: boolean
}

// 計算品項明細
function buildItemDetails(items: ItemSummary[]): ItemDetail[] {
  return items.map(item => ({
    itemName: item.itemName,
    totalWeight: item.totalWeight,
    unitPrice: item.unitPrice,
    subtotal: item.totalWeight.mul(item.unitPrice),
    priceType: item.priceType,
  }))
}

// 計算總車趟數
function getTotalTripCount(trips: TripSummary[]): number {
  return trips.reduce((sum, t) => sum + t.tripCount, 0)
}

// A 類：回收物費用 + 車趟費
export function calculateTypeA(
  trips: TripSummary[],
  items: ItemSummary[],
  tripPrice: Decimal
): BillingResult {
  const tripCount = getTotalTripCount(trips)
  const tripFee = tripPrice.mul(tripCount)
  const itemDetails = buildItemDetails(items)
  const itemFee = itemDetails.reduce((sum, d) => sum.add(d.subtotal), new Decimal(0))
  const totalAmount = tripFee.add(itemFee)

  return {
    billingType: 'A',
    tripCount,
    tripFee,
    itemFee,
    totalAmount,
    tripDetails: trips,
    itemDetails,
    anomaly: false,
  }
}

// B 類：僅車趟費
export function calculateTypeB(
  trips: TripSummary[],
  tripPrice: Decimal
): BillingResult {
  const tripCount = getTotalTripCount(trips)
  const tripFee = tripPrice.mul(tripCount)

  return {
    billingType: 'B',
    tripCount,
    tripFee,
    itemFee: new Decimal(0),
    totalAmount: tripFee,
    tripDetails: trips,
    itemDetails: [],
    anomaly: false,
  }
}

// C 類：合約品項用合約價，其他用牌價，不收車趟費
export function calculateTypeC(
  trips: TripSummary[],
  items: ItemSummary[]
): BillingResult {
  const tripCount = getTotalTripCount(trips)
  const itemDetails = buildItemDetails(items)
  const itemFee = itemDetails.reduce((sum, d) => sum.add(d.subtotal), new Decimal(0))

  return {
    billingType: 'C',
    tripCount,
    tripFee: new Decimal(0), // C 類不收車趟費
    itemFee,
    totalAmount: itemFee,
    tripDetails: trips,
    itemDetails,
    anomaly: false,
  }
}

// D 類：全部按牌價，不收車趟費
export function calculateTypeD(
  trips: TripSummary[],
  items: ItemSummary[]
): BillingResult {
  const tripCount = getTotalTripCount(trips)
  const itemDetails = buildItemDetails(items)
  const itemFee = itemDetails.reduce((sum, d) => sum.add(d.subtotal), new Decimal(0))

  return {
    billingType: 'D',
    tripCount,
    tripFee: new Decimal(0), // D 類不收車趟費
    itemFee,
    totalAmount: itemFee,
    tripDetails: trips,
    itemDetails,
    anomaly: false,
  }
}

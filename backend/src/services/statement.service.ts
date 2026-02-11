// backend/src/services/statement.service.ts
import prisma from '../lib/prisma'
import { calculateMonthlyBilling, calculateTripBilling } from './billing.service'

interface GenerateResult {
  created: number
  skipped: number
  errors: { customerId: number; customerName: string; error: string }[]
}

// 產出所有月結客戶的明細
export async function generateMonthlyStatements(yearMonth: string): Promise<GenerateResult> {
  const customers = await prisma.customer.findMany({
    where: { statementType: 'monthly', status: 'active' },
  })

  let created = 0
  let skipped = 0
  const errors: GenerateResult['errors'] = []

  for (const customer of customers) {
    try {
      // 防重複：檢查是否已有非 voided/rejected 的明細
      const existing = await prisma.statement.findFirst({
        where: {
          customerId: customer.id,
          yearMonth,
          statementType: 'monthly',
          status: { notIn: ['voided', 'rejected'] },
        },
      })

      if (existing) {
        skipped++
        continue
      }

      // 刪除 rejected 的明細以重新產出
      await prisma.statement.deleteMany({
        where: {
          customerId: customer.id,
          yearMonth,
          statementType: 'monthly',
          status: 'rejected',
        },
      })

      await generateCustomerStatement(customer.id, yearMonth)
      created++
    } catch (e: any) {
      errors.push({
        customerId: customer.id,
        customerName: customer.name,
        error: e.message || '未知錯誤',
      })

      // 記錄錯誤到 system_logs
      await prisma.systemLog.create({
        data: {
          eventType: 'statement_generate_error',
          eventContent: `客戶 ${customer.name}(ID:${customer.id}) 月結明細產出失敗: ${e.message}`,
        },
      })
    }
  }

  return { created, skipped, errors }
}

// 產出單一客戶月結明細
export async function generateCustomerStatement(customerId: number, yearMonth: string) {
  const billing = await calculateMonthlyBilling(customerId, yearMonth)

  return prisma.statement.create({
    data: {
      customerId,
      statementType: 'monthly',
      yearMonth,
      itemReceivable: billing.itemReceivable,
      itemPayable: billing.itemPayable,
      tripFeeTotal: billing.tripFeeTotal,
      additionalFeeReceivable: billing.additionalFeeReceivable,
      additionalFeePayable: billing.additionalFeePayable,
      totalReceivable: billing.totalReceivable,
      totalPayable: billing.totalPayable,
      netAmount: billing.netAmount,
      subtotal: billing.subtotal,
      taxAmount: billing.taxAmount,
      totalAmount: billing.totalAmount,
      receivableSubtotal: billing.receivableSubtotal,
      receivableTax: billing.receivableTax,
      receivableTotal: billing.receivableTotal,
      payableSubtotal: billing.payableSubtotal,
      payableTax: billing.payableTax,
      payableTotal: billing.payableTotal,
      detailJson: billing.details as any,
      status: 'draft',
    },
  })
}

// 產出按趟明細
export async function generateTripStatement(tripId: number) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { customer: true },
  })
  if (!trip) throw new Error('車趟不存在')
  if (trip.customer.statementType !== 'per_trip') {
    throw new Error('此客戶非按趟結算')
  }

  const yearMonth = `${trip.tripDate.getFullYear()}-${String(trip.tripDate.getMonth() + 1).padStart(2, '0')}`

  // 防重複
  const existing = await prisma.statement.findFirst({
    where: {
      customerId: trip.customerId,
      tripId,
      statementType: 'per_trip',
      status: { notIn: ['voided', 'rejected'] },
    },
  })
  if (existing) throw new Error('此車趟已有明細')

  const billing = await calculateTripBilling(tripId)

  return prisma.statement.create({
    data: {
      customerId: trip.customerId,
      statementType: 'per_trip',
      tripId,
      yearMonth,
      itemReceivable: billing.itemReceivable,
      itemPayable: billing.itemPayable,
      tripFeeTotal: billing.tripFeeTotal,
      additionalFeeReceivable: billing.additionalFeeReceivable,
      additionalFeePayable: billing.additionalFeePayable,
      totalReceivable: billing.totalReceivable,
      totalPayable: billing.totalPayable,
      netAmount: billing.netAmount,
      subtotal: billing.subtotal,
      taxAmount: billing.taxAmount,
      totalAmount: billing.totalAmount,
      detailJson: billing.details as any,
      status: 'draft',
    },
  })
}

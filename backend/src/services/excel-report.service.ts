// backend/src/services/excel-report.service.ts
import ExcelJS from 'exceljs'
import prisma from '../lib/prisma'
import { calculateMonthlyBilling } from './billing.service'

// 產出站區彙總報表 Excel
export async function generateSiteReport(siteId: number, yearMonth: string): Promise<Buffer> {
  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) throw new Error('站區不存在')

  // 取得該站區所有活躍客戶
  const customers = await prisma.customer.findMany({
    where: { siteId, status: 'active' },
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '資源回收管理系統'
  workbook.created = new Date()

  // 工作表一：客戶總額
  const customerSheet = workbook.addWorksheet('客戶總額')
  customerSheet.columns = [
    { header: '客戶名稱', key: 'name', width: 20 },
    { header: '類型', key: 'type', width: 10 },
    { header: '應收', key: 'receivable', width: 15 },
    { header: '應付', key: 'payable', width: 15 },
    { header: '車趟費', key: 'tripFee', width: 15 },
    { header: '附加費用(收)', key: 'feeReceivable', width: 15 },
    { header: '附加費用(付)', key: 'feePayable', width: 15 },
    { header: '淨額', key: 'netAmount', width: 15 },
    { header: '稅額', key: 'taxAmount', width: 15 },
    { header: '總額', key: 'totalAmount', width: 15 },
  ]

  // 樣式：標題列
  const headerRow = customerSheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  // 品項彙總資料
  const itemSummary: Map<string, {
    itemId: number
    itemName: string
    unit: string
    totalQuantity: number
    receivableAmount: number
    payableAmount: number
  }> = new Map()

  for (const customer of customers) {
    try {
      const billing = await calculateMonthlyBilling(customer.id, yearMonth)

      customerSheet.addRow({
        name: customer.name,
        type: customer.type === 'contracted' ? '簽約' : '臨時',
        receivable: billing.itemReceivable,
        payable: billing.itemPayable,
        tripFee: billing.tripFeeTotal,
        feeReceivable: billing.additionalFeeReceivable,
        feePayable: billing.additionalFeePayable,
        netAmount: billing.netAmount,
        taxAmount: billing.taxAmount,
        totalAmount: billing.totalAmount,
      })

      // 累加品項彙總
      for (const item of billing.details.items) {
        const key = `${item.itemId}-${item.itemName}`
        const existing = itemSummary.get(key) || {
          itemId: item.itemId,
          itemName: item.itemName,
          unit: item.unit,
          totalQuantity: 0,
          receivableAmount: 0,
          payableAmount: 0,
        }
        existing.totalQuantity += item.quantity
        if (item.billingDirection === 'receivable') {
          existing.receivableAmount += item.amount
        } else if (item.billingDirection === 'payable') {
          existing.payableAmount += item.amount
        }
        itemSummary.set(key, existing)
      }
    } catch {
      // 單一客戶計算失敗不影響其他客戶
      customerSheet.addRow({
        name: customer.name,
        type: customer.type === 'contracted' ? '簽約' : '臨時',
        receivable: '計算錯誤',
      })
    }
  }

  // 工作表二：品項彙總
  const itemSheet = workbook.addWorksheet('品項彙總')
  itemSheet.columns = [
    { header: '品項', key: 'name', width: 20 },
    { header: '單位', key: 'unit', width: 10 },
    { header: '總數量', key: 'quantity', width: 15 },
    { header: '應收金額', key: 'receivable', width: 15 },
    { header: '應付金額', key: 'payable', width: 15 },
    { header: '淨額', key: 'net', width: 15 },
  ]

  const itemHeaderRow = itemSheet.getRow(1)
  itemHeaderRow.font = { bold: true }
  itemHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  for (const item of itemSummary.values()) {
    itemSheet.addRow({
      name: item.itemName,
      unit: item.unit,
      quantity: item.totalQuantity,
      receivable: item.receivableAmount,
      payable: item.payableAmount,
      net: item.receivableAmount - item.payableAmount,
    })
  }

  // 輸出為 Buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

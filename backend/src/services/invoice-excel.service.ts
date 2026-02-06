// backend/src/services/invoice-excel.service.ts
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'

export interface InvoiceData {
  customerId: string
  customerName: string
  siteName: string
  billingType: string
  totalAmount: number
  tripFee: number
  itemFee: number
}

// 產生發票明細彙總 Excel
export async function generateInvoiceExcel(
  yearMonth: string,
  data: InvoiceData[],
  outputDir: string
): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Recycling Automation System'

  // === 總表（依站點分組） ===
  const summarySheet = workbook.addWorksheet('發票彙總')

  // 標題
  summarySheet.mergeCells('A1:G1')
  summarySheet.getCell('A1').value = `${yearMonth} 發票明細彙總表`
  summarySheet.getCell('A1').font = { bold: true, size: 14 }
  summarySheet.getCell('A1').alignment = { horizontal: 'center' }

  // 表頭
  const headers = ['客戶編號', '客戶名稱', '站點', '計費類型', '車趟費', '品項費', '總金額']
  const headerRow = summarySheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
    cell.border = { bottom: { style: 'thin' } }
  })

  // 資料列
  let totalAll = 0
  for (const item of data) {
    summarySheet.addRow([
      item.customerId,
      item.customerName,
      item.siteName,
      item.billingType,
      item.tripFee,
      item.itemFee,
      item.totalAmount,
    ])
    totalAll += item.totalAmount
  }

  // 合計列
  const totalRow = summarySheet.addRow(['', '', '', '', '', '合計', totalAll])
  totalRow.font = { bold: true }

  // 格式化金額欄
  for (let col = 5; col <= 7; col++) {
    summarySheet.getColumn(col).numFmt = '#,##0'
    summarySheet.getColumn(col).width = 15
  }

  // 自動欄寬
  summarySheet.getColumn(1).width = 12
  summarySheet.getColumn(2).width = 25
  summarySheet.getColumn(3).width = 10
  summarySheet.getColumn(4).width = 10

  // 凍結首列
  summarySheet.views = [{ state: 'frozen', ySplit: 2 }]

  // === 每個客戶一個分頁 ===
  for (const item of data) {
    const sheetName = `${item.customerId}-${item.customerName}`.substring(0, 31) // Excel 分頁名稱上限 31 字
    const sheet = workbook.addWorksheet(sheetName)

    sheet.addRow([`${yearMonth} Invoice - ${item.customerName}`]).font = { bold: true, size: 12 }
    sheet.addRow([])
    sheet.addRow(['Customer ID', item.customerId])
    sheet.addRow(['Customer Name', item.customerName])
    sheet.addRow(['Site', item.siteName])
    sheet.addRow(['Billing Type', item.billingType])
    sheet.addRow([])
    sheet.addRow(['Trip Fee', item.tripFee]).getCell(2).numFmt = '#,##0'
    sheet.addRow(['Item Fee', item.itemFee]).getCell(2).numFmt = '#,##0'
    sheet.addRow(['Total', item.totalAmount]).font = { bold: true }
    sheet.getCell('B10').numFmt = '#,##0'

    sheet.getColumn(1).width = 18
    sheet.getColumn(2).width = 25
  }

  // 儲存
  const filename = `Invoice_${yearMonth}.xlsx`
  const filePath = path.join(outputDir, filename)
  await workbook.xlsx.writeFile(filePath)

  return filePath
}

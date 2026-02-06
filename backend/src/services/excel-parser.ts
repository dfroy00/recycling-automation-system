// backend/src/services/excel-parser.ts
import ExcelJS from 'exceljs'

// 車趟解析結果
export interface TripRow {
  tripDate: string
  tripTime: string
  customerId: string
  driver: string
  vehiclePlate: string
}

// 品項解析結果
export interface ItemRow {
  collectionDate: string
  customerId: string
  itemName: string
  weightKg: number
}

export interface ParseResult<T> {
  success: boolean
  data: T[]
  error?: string
  rowCount?: number
}

// 車機 Excel 必要欄位
const TRIP_HEADERS = ['日期', '時間', '客戶編號', '司機', '車牌']

// ERP 品項 Excel 必要欄位
const ITEM_HEADERS = ['日期', '客戶編號', '品項名稱', '重量(kg)']

// 格式化日期值（處理 Excel 日期物件和字串）
function formatDate(value: any): string {
  if (!value) return ''
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  return String(value).trim()
}

// 格式化時間值
function formatTime(value: any): string {
  if (!value) return ''
  if (value instanceof Date) {
    const h = String(value.getHours()).padStart(2, '0')
    const m = String(value.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  return String(value).trim()
}

// 驗證標頭列是否符合預期
function validateHeaders(row: ExcelJS.Row, expected: string[]): boolean {
  for (let i = 0; i < expected.length; i++) {
    const cell = String(row.getCell(i + 1).value || '').trim()
    if (cell !== expected[i]) return false
  }
  return true
}

// 解析車機 Excel
export async function parseTripExcel(filePath: string): Promise<ParseResult<TripRow>> {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const worksheet = workbook.worksheets[0]

    if (!worksheet || worksheet.rowCount < 2) {
      return { success: false, data: [], error: '檔案為空或無資料列' }
    }

    // 驗證標頭
    const headerRow = worksheet.getRow(1)
    if (!validateHeaders(headerRow, TRIP_HEADERS)) {
      return { success: false, data: [], error: `檔案格式錯誤，預期欄位：${TRIP_HEADERS.join(', ')}` }
    }

    const data: TripRow[] = []
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // 跳過標頭
      data.push({
        tripDate: formatDate(row.getCell(1).value),
        tripTime: formatTime(row.getCell(2).value),
        customerId: String(row.getCell(3).value || '').trim(),
        driver: String(row.getCell(4).value || '').trim(),
        vehiclePlate: String(row.getCell(5).value || '').trim(),
      })
    })

    return { success: true, data, rowCount: data.length }
  } catch (error: any) {
    return { success: false, data: [], error: `解析失敗：${error.message}` }
  }
}

// 解析 ERP 品項 Excel
export async function parseItemExcel(filePath: string): Promise<ParseResult<ItemRow>> {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const worksheet = workbook.worksheets[0]

    if (!worksheet || worksheet.rowCount < 2) {
      return { success: false, data: [], error: '檔案為空或無資料列' }
    }

    // 驗證標頭
    const headerRow = worksheet.getRow(1)
    if (!validateHeaders(headerRow, ITEM_HEADERS)) {
      return { success: false, data: [], error: `檔案格式錯誤，預期欄位：${ITEM_HEADERS.join(', ')}` }
    }

    const data: ItemRow[] = []
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      data.push({
        collectionDate: formatDate(row.getCell(1).value),
        customerId: String(row.getCell(2).value || '').trim(),
        itemName: String(row.getCell(3).value || '').trim(),
        weightKg: Number(row.getCell(4).value) || 0,
      })
    })

    return { success: true, data, rowCount: data.length }
  } catch (error: any) {
    return { success: false, data: [], error: `解析失敗：${error.message}` }
  }
}

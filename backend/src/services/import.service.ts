// backend/src/services/import.service.ts
import { prisma } from '../lib/prisma'
import { parseTripExcel, parseItemExcel } from './excel-parser'
import { validateTripRow, validateItemRow } from './import-validator'

export interface ImportResult {
  success: boolean
  total: number
  imported: number
  errors: { row: number; messages: string[] }[]
  warnings: { row: number; messages: string[] }[]
}

// 取得已知的客戶編號清單
async function getKnownCustomerIds(): Promise<string[]> {
  const customers = await prisma.customer.findMany({ select: { customerId: true } })
  return customers.map(c => c.customerId)
}

// 取得已知的品項名稱清單
async function getKnownItemNames(): Promise<string[]> {
  const items = await prisma.itemPrice.findMany({
    where: { expiryDate: null },
    select: { itemName: true },
    distinct: ['itemName'],
  })
  return items.map(i => i.itemName)
}

// 匯入車趟資料
export async function importTrips(filePath: string, siteId: string): Promise<ImportResult> {
  const parseResult = await parseTripExcel(filePath)
  if (!parseResult.success) {
    return { success: false, total: 0, imported: 0, errors: [{ row: 0, messages: [parseResult.error!] }], warnings: [] }
  }

  const knownCustomerIds = await getKnownCustomerIds()
  const errors: ImportResult['errors'] = []
  const warnings: ImportResult['warnings'] = []
  let imported = 0

  for (let i = 0; i < parseResult.data.length; i++) {
    const row = parseResult.data[i]
    const validation = validateTripRow(row, knownCustomerIds)

    if (validation.warnings.length > 0) {
      warnings.push({ row: i + 2, messages: validation.warnings })
    }

    if (!validation.valid) {
      errors.push({ row: i + 2, messages: validation.errors })
      continue
    }

    // 寫入資料庫
    await prisma.trip.create({
      data: {
        siteId,
        customerId: row.customerId,
        tripDate: new Date(row.tripDate),
        tripTime: new Date(`1970-01-01T${row.tripTime}:00`),
        driver: row.driver,
        vehiclePlate: row.vehiclePlate,
        sourceFile: filePath,
      },
    })
    imported++
  }

  // 寫入系統日誌
  await prisma.systemLog.create({
    data: {
      siteId,
      eventType: 'import',
      eventContent: `匯入車趟資料：共 ${parseResult.data.length} 筆，成功 ${imported} 筆，失敗 ${errors.length} 筆`,
    },
  })

  return { success: true, total: parseResult.data.length, imported, errors, warnings }
}

// 匯入品項收取資料
export async function importItems(filePath: string, siteId: string): Promise<ImportResult> {
  const parseResult = await parseItemExcel(filePath)
  if (!parseResult.success) {
    return { success: false, total: 0, imported: 0, errors: [{ row: 0, messages: [parseResult.error!] }], warnings: [] }
  }

  const knownCustomerIds = await getKnownCustomerIds()
  const knownItemNames = await getKnownItemNames()
  const errors: ImportResult['errors'] = []
  const warnings: ImportResult['warnings'] = []
  let imported = 0

  for (let i = 0; i < parseResult.data.length; i++) {
    const row = parseResult.data[i]
    const validation = validateItemRow(row, knownCustomerIds, knownItemNames)

    if (validation.warnings.length > 0) {
      warnings.push({ row: i + 2, messages: validation.warnings })
    }

    if (!validation.valid) {
      errors.push({ row: i + 2, messages: validation.errors })
      continue
    }

    await prisma.itemCollected.create({
      data: {
        siteId,
        customerId: row.customerId,
        collectionDate: new Date(row.collectionDate),
        itemName: row.itemName,
        weightKg: row.weightKg,
        sourceFile: filePath,
      },
    })
    imported++
  }

  await prisma.systemLog.create({
    data: {
      siteId,
      eventType: 'import',
      eventContent: `匯入品項資料：共 ${parseResult.data.length} 筆，成功 ${imported} 筆，失敗 ${errors.length} 筆`,
    },
  })

  return { success: true, total: parseResult.data.length, imported, errors, warnings }
}

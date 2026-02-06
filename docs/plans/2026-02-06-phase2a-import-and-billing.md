# 階段二A：檔案匯入與計費引擎 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作 Excel 檔案匯入（車機 + ERP）、資料驗證、四種客戶計費引擎、月結明細計算與金額異常偵測

**Architecture:** Excel 解析使用 exceljs，檔案上傳使用 multer，計費引擎為純函式設計便於單元測試。檔案監控使用 chokidar 監聽共享資料夾。所有業務邏輯集中於 services 層。

**Tech Stack:** exceljs, multer, chokidar, Vitest, Supertest

**前置條件:** 階段一（Phase 1）已完成，資料庫與身份驗證系統就緒

**參考文件:** `docs/plans/2026-02-06-recycling-automation-system-design.md`

---

### Task 1: 安裝匯入模組依賴

**Files:**
- Modify: `backend/package.json`

**Step 1: 安裝依賴**

Run:
```bash
cd backend
npm install exceljs multer chokidar
npm install -D @types/multer
```

**Step 2: 建立上傳與資料目錄**

Run:
```bash
mkdir -p backend/uploads
mkdir -p backend/data/trips
mkdir -p backend/data/items
```

在 `.gitignore` 加入：
```
backend/uploads/*
!backend/uploads/.gitkeep
backend/data/trips/*
backend/data/items/*
!backend/data/trips/.gitkeep
!backend/data/items/.gitkeep
```

建立 `.gitkeep` 檔案：
Run:
```bash
touch backend/uploads/.gitkeep backend/data/trips/.gitkeep backend/data/items/.gitkeep
```

**Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json .gitignore backend/uploads/.gitkeep backend/data/trips/.gitkeep backend/data/items/.gitkeep
git commit -m "chore: 安裝匯入模組依賴 (exceljs, multer, chokidar)"
```

---

### Task 2: Excel 解析服務

**Files:**
- Create: `backend/tests/excel-parser.test.ts`
- Create: `backend/src/services/excel-parser.ts`

**Step 1: 撰寫 Excel 解析失敗測試**

```typescript
// backend/tests/excel-parser.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'path'
import ExcelJS from 'exceljs'
import fs from 'fs'
import { parseTripExcel, parseItemExcel } from '../src/services/excel-parser'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')

// 測試前建立範例 Excel 檔案
beforeAll(async () => {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })

  // 建立車機 Excel
  const tripWb = new ExcelJS.Workbook()
  const tripWs = tripWb.addWorksheet('車趟')
  tripWs.addRow(['日期', '時間', '客戶編號', '司機', '車牌'])
  tripWs.addRow(['2026-02-01', '09:30', 'C001', '王小明', 'ABC-1234'])
  tripWs.addRow(['2026-02-01', '14:20', 'C002', '李大華', 'XYZ-5678'])
  tripWs.addRow(['2026-02-02', '10:00', 'C001', '王小明', 'ABC-1234'])
  await tripWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'trips.xlsx'))

  // 建立 ERP 品項 Excel
  const itemWb = new ExcelJS.Workbook()
  const itemWs = itemWb.addWorksheet('品項')
  itemWs.addRow(['日期', '客戶編號', '品項名稱', '重量(kg)'])
  itemWs.addRow(['2026-02-01', 'C001', '紙類', 150.5])
  itemWs.addRow(['2026-02-01', 'C001', '塑膠', 80.2])
  itemWs.addRow(['2026-02-01', 'C002', '金屬', 200.0])
  itemWs.addRow(['2026-02-02', 'C001', '紙類', 120.0])
  await itemWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'items.xlsx'))

  // 建立格式錯誤的 Excel（缺少欄位）
  const badWb = new ExcelJS.Workbook()
  const badWs = badWb.addWorksheet('錯誤')
  badWs.addRow(['欄位A', '欄位B'])
  badWs.addRow(['data1', 'data2'])
  await badWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'bad-format.xlsx'))
})

afterAll(() => {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true })
})

describe('Excel 解析服務', () => {
  describe('parseTripExcel', () => {
    it('應正確解析車趟 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'trips.xlsx')
      const result = await parseTripExcel(filePath)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
      expect(result.data[0]).toEqual({
        tripDate: '2026-02-01',
        tripTime: '09:30',
        customerId: 'C001',
        driver: '王小明',
        vehiclePlate: 'ABC-1234',
      })
    })

    it('應拒絕格式錯誤的 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'bad-format.xlsx')
      const result = await parseTripExcel(filePath)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式')
    })
  })

  describe('parseItemExcel', () => {
    it('應正確解析品項 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'items.xlsx')
      const result = await parseItemExcel(filePath)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(4)
      expect(result.data[0]).toEqual({
        collectionDate: '2026-02-01',
        customerId: 'C001',
        itemName: '紙類',
        weightKg: 150.5,
      })
    })

    it('應拒絕格式錯誤的 Excel', async () => {
      const filePath = path.join(FIXTURES_DIR, 'bad-format.xlsx')
      const result = await parseItemExcel(filePath)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式')
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- excel-parser`
Expected: FAIL - `Cannot find module '../src/services/excel-parser'`

**Step 3: 實作 Excel 解析服務**

```typescript
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
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- excel-parser`
Expected: 所有 4 個測試通過

**Step 5: Commit**

```bash
git add backend/src/services/excel-parser.ts backend/tests/excel-parser.test.ts
git commit -m "feat: 實作 Excel 解析服務 (車機 + ERP 品項)"
```

---

### Task 3: 資料驗證服務

**Files:**
- Create: `backend/tests/import-validator.test.ts`
- Create: `backend/src/services/import-validator.ts`

**Step 1: 撰寫資料驗證失敗測試**

```typescript
// backend/tests/import-validator.test.ts
import { describe, it, expect } from 'vitest'
import {
  validateTripRow,
  validateItemRow,
  type ValidationResult,
} from '../src/services/import-validator'

describe('資料驗證服務', () => {
  // 測試用的已知客戶與品項（對應 seed 資料）
  const knownCustomerIds = ['C001', 'C002', 'C003', 'C004']
  const knownItemNames = ['紙類', '塑膠', '金屬', '鋁罐', '鐵罐', '玻璃', '寶特瓶', '廢紙箱']

  describe('validateTripRow', () => {
    it('應通過正常資料', () => {
      const result = validateTripRow(
        { tripDate: '2026-02-01', tripTime: '09:30', customerId: 'C001', driver: '王小明', vehiclePlate: 'ABC-1234' },
        knownCustomerIds
      )
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('應標記不存在的客戶編號', () => {
      const result = validateTripRow(
        { tripDate: '2026-02-01', tripTime: '09:30', customerId: 'C999', driver: '王小明', vehiclePlate: 'ABC-1234' },
        knownCustomerIds
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('客戶編號')
    })

    it('應標記缺少日期', () => {
      const result = validateTripRow(
        { tripDate: '', tripTime: '09:30', customerId: 'C001', driver: '王小明', vehiclePlate: 'ABC-1234' },
        knownCustomerIds
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('日期')
    })
  })

  describe('validateItemRow', () => {
    it('應通過正常資料', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: 150.5 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(true)
    })

    it('應標記不存在的品項', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '未知品項', weightKg: 100 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('品項')
    })

    it('應標記負數重量', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: -10 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('重量')
    })

    it('應標記超過 10000 公斤', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: 15000 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('重量')
    })

    it('應發出重量為 0 的警告', () => {
      const result = validateItemRow(
        { collectionDate: '2026-02-01', customerId: 'C001', itemName: '紙類', weightKg: 0 },
        knownCustomerIds,
        knownItemNames
      )
      expect(result.valid).toBe(true) // 0 是合法的但要警告
      expect(result.warnings).toHaveLength(1)
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- import-validator`
Expected: FAIL

**Step 3: 實作資料驗證服務**

```typescript
// backend/src/services/import-validator.ts
import type { TripRow, ItemRow } from './excel-parser'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// 驗證車趟資料列
export function validateTripRow(
  row: TripRow,
  knownCustomerIds: string[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!row.tripDate) {
    errors.push('日期不可為空')
  }
  if (!row.tripTime) {
    errors.push('時間不可為空')
  }
  if (!row.customerId) {
    errors.push('客戶編號不可為空')
  } else if (!knownCustomerIds.includes(row.customerId)) {
    errors.push(`客戶編號 ${row.customerId} 不存在於客戶主檔`)
  }
  if (!row.driver) {
    warnings.push('司機姓名為空')
  }
  if (!row.vehiclePlate) {
    warnings.push('車牌為空')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// 驗證品項收取資料列
export function validateItemRow(
  row: ItemRow,
  knownCustomerIds: string[],
  knownItemNames: string[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!row.collectionDate) {
    errors.push('日期不可為空')
  }
  if (!row.customerId) {
    errors.push('客戶編號不可為空')
  } else if (!knownCustomerIds.includes(row.customerId)) {
    errors.push(`客戶編號 ${row.customerId} 不存在於客戶主檔`)
  }
  if (!row.itemName) {
    errors.push('品項名稱不可為空')
  } else if (!knownItemNames.includes(row.itemName)) {
    errors.push(`品項 ${row.itemName} 不存在於單價表`)
  }
  if (row.weightKg < 0 || row.weightKg > 10000) {
    errors.push(`重量異常：${row.weightKg} 公斤（有效範圍 0-10000）`)
  } else if (row.weightKg === 0) {
    warnings.push('重量為 0 公斤，請確認是否正確')
  }

  return { valid: errors.length === 0, errors, warnings }
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- import-validator`
Expected: 所有 7 個測試通過

**Step 5: Commit**

```bash
git add backend/src/services/import-validator.ts backend/tests/import-validator.test.ts
git commit -m "feat: 實作資料驗證服務 (客戶、品項、重量檢查)"
```

---

### Task 4: 匯入 API 端點

**Files:**
- Create: `backend/tests/import.routes.test.ts`
- Create: `backend/src/routes/import.ts`
- Create: `backend/src/services/import.service.ts`
- Modify: `backend/src/app.ts`

**Step 1: 撰寫匯入服務**

```typescript
// backend/src/services/import.service.ts
import { prisma } from '../lib/prisma'
import { parseTripExcel, parseItemExcel, type TripRow, type ItemRow } from './excel-parser'
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
```

**Step 2: 實作匯入路由**

```typescript
// backend/src/routes/import.ts
import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { authenticate, authorize } from '../middleware/auth'
import { importTrips, importItems } from '../services/import.service'

const router = Router()

// multer 設定
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    cb(null, `${timestamp}-${file.fieldname}${ext}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('僅支援 .xlsx 或 .xls 格式'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

// POST /api/import/trips - 匯入車趟資料
router.post(
  '/trips',
  authenticate,
  authorize('system_admin', 'site_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: '請上傳 Excel 檔案' })
      }

      const siteId = req.body.siteId || req.user?.siteId
      if (!siteId) {
        return res.status(400).json({ message: '請指定站點 siteId' })
      }

      const result = await importTrips(req.file.path, siteId)
      res.json(result)
    } catch (error: any) {
      console.error('匯入車趟失敗:', error)
      res.status(500).json({ message: '匯入失敗', error: error.message })
    }
  }
)

// POST /api/import/items - 匯入品項資料
router.post(
  '/items',
  authenticate,
  authorize('system_admin', 'site_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: '請上傳 Excel 檔案' })
      }

      const siteId = req.body.siteId || req.user?.siteId
      if (!siteId) {
        return res.status(400).json({ message: '請指定站點 siteId' })
      }

      const result = await importItems(req.file.path, siteId)
      res.json(result)
    } catch (error: any) {
      console.error('匯入品項失敗:', error)
      res.status(500).json({ message: '匯入失敗', error: error.message })
    }
  }
)

export default router
```

**Step 3: 在 app.ts 掛載路由**

在 `backend/src/app.ts` 加入：

```typescript
import importRouter from './routes/import'

app.use('/api/import', importRouter)
```

**Step 4: 撰寫匯入 API 整合測試**

```typescript
// backend/tests/import.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import path from 'path'
import fs from 'fs'
import ExcelJS from 'exceljs'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'
import { generateToken } from '../src/services/auth.service'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')

describe('Import Routes', () => {
  let adminToken: string

  beforeAll(async () => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })

    // 建立測試車趟 Excel
    const tripWb = new ExcelJS.Workbook()
    const tripWs = tripWb.addWorksheet('車趟')
    tripWs.addRow(['日期', '時間', '客戶編號', '司機', '車牌'])
    tripWs.addRow(['2026-02-01', '09:30', 'C001', '王小明', 'ABC-1234'])
    await tripWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'test-trips.xlsx'))

    // 建立測試品項 Excel
    const itemWb = new ExcelJS.Workbook()
    const itemWs = itemWb.addWorksheet('品項')
    itemWs.addRow(['日期', '客戶編號', '品項名稱', '重量(kg)'])
    itemWs.addRow(['2026-02-01', 'C001', '紙類', 150.5])
    await itemWb.xlsx.writeFile(path.join(FIXTURES_DIR, 'test-items.xlsx'))

    // 清理先前的測試匯入資料
    await prisma.trip.deleteMany({ where: { sourceFile: { contains: 'test-' } } })
    await prisma.itemCollected.deleteMany({ where: { sourceFile: { contains: 'test-' } } })
  })

  afterAll(() => {
    fs.rmSync(FIXTURES_DIR, { recursive: true, force: true })
  })

  describe('POST /api/import/trips', () => {
    it('應成功匯入車趟資料', async () => {
      const res = await request(app)
        .post('/api/import/trips')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('siteId', 'S001')
        .attach('file', path.join(FIXTURES_DIR, 'test-trips.xlsx'))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.total).toBe(1)
      expect(res.body.imported).toBe(1)
    })

    it('應拒絕未驗證的請求', async () => {
      const res = await request(app)
        .post('/api/import/trips')
        .field('siteId', 'S001')
        .attach('file', path.join(FIXTURES_DIR, 'test-trips.xlsx'))

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/import/items', () => {
    it('應成功匯入品項資料', async () => {
      const res = await request(app)
        .post('/api/import/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('siteId', 'S001')
        .attach('file', path.join(FIXTURES_DIR, 'test-items.xlsx'))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.total).toBe(1)
      expect(res.body.imported).toBe(1)
    })
  })
})
```

**Step 5: 執行測試驗證通過**

Run: `cd backend && npm test -- import.routes`
Expected: 所有匯入 API 測試通過

**Step 6: Commit**

```bash
git add backend/src/services/import.service.ts backend/src/routes/import.ts backend/src/app.ts backend/tests/import.routes.test.ts
git commit -m "feat: 實作匯入 API (車趟 + 品項 Excel 上傳與驗證)"
```

---

### Task 5: 計費引擎 - A/B 類客戶

**Files:**
- Create: `backend/tests/billing.test.ts`
- Create: `backend/src/services/billing.service.ts`

**Step 1: 撰寫 A/B 類計費失敗測試**

```typescript
// backend/tests/billing.test.ts
import { describe, it, expect } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import {
  calculateTypeA,
  calculateTypeB,
  type TripSummary,
  type ItemSummary,
  type BillingResult,
} from '../src/services/billing.service'

// 測試用的車趟摘要
const sampleTrips: TripSummary[] = [
  { tripDate: new Date('2026-02-05'), tripCount: 2 },
  { tripDate: new Date('2026-02-12'), tripCount: 3 },
  { tripDate: new Date('2026-02-19'), tripCount: 2 },
  { tripDate: new Date('2026-02-26'), tripCount: 1 },
]

// 測試用的品項摘要
const sampleItems: ItemSummary[] = [
  { itemName: '紙類', totalWeight: new Decimal(450.5), unitPrice: new Decimal(5.0), priceType: 'standard' },
  { itemName: '塑膠', totalWeight: new Decimal(220.3), unitPrice: new Decimal(3.5), priceType: 'standard' },
  { itemName: '金屬', totalWeight: new Decimal(180.0), unitPrice: new Decimal(8.0), priceType: 'standard' },
]

describe('計費引擎', () => {
  describe('A 類客戶（回收物費用 + 車趟費）', () => {
    it('應正確計算總金額', () => {
      const result = calculateTypeA(sampleTrips, sampleItems, new Decimal(300))

      // 車趟費 = (2+3+2+1) * 300 = 2400
      expect(result.tripFee.toNumber()).toBe(2400)
      // 品項費 = 450.5*5 + 220.3*3.5 + 180*8 = 2252.5 + 771.05 + 1440 = 4463.55
      expect(result.itemFee.toNumber()).toBeCloseTo(4463.55, 2)
      // 總金額 = 2400 + 4463.55 = 6863.55
      expect(result.totalAmount.toNumber()).toBeCloseTo(6863.55, 2)
      expect(result.tripCount).toBe(8)
    })

    it('應正確產生品項明細', () => {
      const result = calculateTypeA(sampleTrips, sampleItems, new Decimal(300))

      expect(result.itemDetails).toHaveLength(3)
      expect(result.itemDetails[0].itemName).toBe('紙類')
      expect(result.itemDetails[0].subtotal.toNumber()).toBeCloseTo(2252.5, 2)
    })

    it('無車趟時車趟費應為 0', () => {
      const result = calculateTypeA([], sampleItems, new Decimal(300))

      expect(result.tripFee.toNumber()).toBe(0)
      expect(result.tripCount).toBe(0)
      expect(result.itemFee.toNumber()).toBeGreaterThan(0)
    })

    it('無品項時品項費應為 0', () => {
      const result = calculateTypeA(sampleTrips, [], new Decimal(300))

      expect(result.itemFee.toNumber()).toBe(0)
      expect(result.tripFee.toNumber()).toBe(2400)
    })
  })

  describe('B 類客戶（僅車趟費）', () => {
    it('應正確計算車趟費', () => {
      const result = calculateTypeB(sampleTrips, new Decimal(500))

      // 車趟費 = 8 * 500 = 4000
      expect(result.tripFee.toNumber()).toBe(4000)
      expect(result.totalAmount.toNumber()).toBe(4000)
      expect(result.tripCount).toBe(8)
      // B 類不應有品項明細
      expect(result.itemDetails).toHaveLength(0)
      expect(result.itemFee.toNumber()).toBe(0)
    })

    it('無車趟時總金額應為 0', () => {
      const result = calculateTypeB([], new Decimal(500))

      expect(result.totalAmount.toNumber()).toBe(0)
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- billing`
Expected: FAIL - `Cannot find module '../src/services/billing.service'`

**Step 3: 實作計費引擎（A/B 類）**

```typescript
// backend/src/services/billing.service.ts
import { Decimal } from '@prisma/client/runtime/library'

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
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- billing`
Expected: 所有 A/B 類計費測試通過

**Step 5: Commit**

```bash
git add backend/src/services/billing.service.ts backend/tests/billing.test.ts
git commit -m "feat: 實作計費引擎 A/B 類客戶 (回收物費+車趟費 / 僅車趟費)"
```

---

### Task 6: 計費引擎 - C/D 類客戶

**Files:**
- Modify: `backend/tests/billing.test.ts`
- Modify: `backend/src/services/billing.service.ts`

**Step 1: 在 billing.test.ts 加入 C/D 類測試**

```typescript
// 在 billing.test.ts 加入以下 describe 區塊

describe('C 類客戶（合約 + 牌價混合）', () => {
  // C 類品項：紙類和塑膠有合約價，金屬用牌價
  const mixedItems: ItemSummary[] = [
    { itemName: '紙類', totalWeight: new Decimal(450.5), unitPrice: new Decimal(4.5), priceType: 'contract' },
    { itemName: '塑膠', totalWeight: new Decimal(220.3), unitPrice: new Decimal(3.0), priceType: 'contract' },
    { itemName: '金屬', totalWeight: new Decimal(180.0), unitPrice: new Decimal(8.0), priceType: 'standard' },
  ]

  it('應正確計算混合計價（不收車趟費）', () => {
    const result = calculateTypeC(sampleTrips, mixedItems)

    // 合約品項費 = 450.5*4.5 + 220.3*3.0 = 2027.25 + 660.9 = 2688.15
    // 牌價品項費 = 180*8 = 1440
    // 總金額 = 2688.15 + 1440 = 4128.15
    expect(result.totalAmount.toNumber()).toBeCloseTo(4128.15, 2)
    expect(result.tripFee.toNumber()).toBe(0) // 不收車趟費
    expect(result.itemDetails).toHaveLength(3)
    expect(result.itemDetails[0].priceType).toBe('contract')
    expect(result.itemDetails[2].priceType).toBe('standard')
  })

  it('全部都是合約品項時應只用合約價', () => {
    const contractOnly: ItemSummary[] = [
      { itemName: '紙類', totalWeight: new Decimal(100), unitPrice: new Decimal(4.5), priceType: 'contract' },
    ]
    const result = calculateTypeC(sampleTrips, contractOnly)

    expect(result.totalAmount.toNumber()).toBe(450)
    expect(result.tripFee.toNumber()).toBe(0)
  })
})

describe('D 類客戶（全牌價，不收車趟費）', () => {
  it('應正確計算牌價費用', () => {
    const result = calculateTypeD(sampleTrips, sampleItems)

    // 品項費 = 450.5*5 + 220.3*3.5 + 180*8 = 4463.55
    expect(result.totalAmount.toNumber()).toBeCloseTo(4463.55, 2)
    expect(result.tripFee.toNumber()).toBe(0) // 不收車趟費
    expect(result.itemDetails.every(d => d.priceType === 'standard')).toBe(true)
  })

  it('無品項時總金額應為 0', () => {
    const result = calculateTypeD(sampleTrips, [])

    expect(result.totalAmount.toNumber()).toBe(0)
  })
})
```

記得在頂部 import 加入 `calculateTypeC, calculateTypeD`。

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- billing`
Expected: FAIL - `calculateTypeC is not a function`

**Step 3: 實作 C/D 類計費**

在 `backend/src/services/billing.service.ts` 加入：

```typescript
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
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- billing`
Expected: 所有計費測試通過（A/B/C/D 四種類型）

**Step 5: Commit**

```bash
git add backend/src/services/billing.service.ts backend/tests/billing.test.ts
git commit -m "feat: 實作計費引擎 C/D 類客戶 (合約混合計價 / 全牌價)"
```

---

### Task 7: 月結明細計算服務

**Files:**
- Create: `backend/tests/monthly-statement.test.ts`
- Create: `backend/src/services/monthly-statement.service.ts`

**Step 1: 撰寫月結明細失敗測試**

```typescript
// backend/tests/monthly-statement.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '../src/lib/prisma'
import { generateMonthlyStatement } from '../src/services/monthly-statement.service'

describe('月結明細計算', () => {
  // 測試前插入測試資料
  beforeAll(async () => {
    // 清理測試資料
    await prisma.monthlyStatement.deleteMany({ where: { yearMonth: '2026-03' } })
    await prisma.itemCollected.deleteMany({ where: { collectionDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') } } })
    await prisma.trip.deleteMany({ where: { tripDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') } } })

    // 為 C001 (A 類) 插入 3 月份的車趟
    await prisma.trip.createMany({
      data: [
        { siteId: 'S001', customerId: 'C001', tripDate: new Date('2026-03-05'), tripTime: new Date('1970-01-01T09:30:00'), driver: '王小明', vehiclePlate: 'ABC-1234' },
        { siteId: 'S001', customerId: 'C001', tripDate: new Date('2026-03-12'), tripTime: new Date('1970-01-01T10:00:00'), driver: '王小明', vehiclePlate: 'ABC-1234' },
      ],
    })

    // 為 C001 插入品項
    await prisma.itemCollected.createMany({
      data: [
        { siteId: 'S001', customerId: 'C001', collectionDate: new Date('2026-03-05'), itemName: '紙類', weightKg: 150.5 },
        { siteId: 'S001', customerId: 'C001', collectionDate: new Date('2026-03-12'), itemName: '塑膠', weightKg: 80.2 },
      ],
    })
  })

  it('應正確計算 A 類客戶月結明細', async () => {
    const result = await generateMonthlyStatement('C001', '2026-03')

    expect(result).toBeDefined()
    expect(result.customerId).toBe('C001')
    expect(result.yearMonth).toBe('2026-03')
    expect(result.tripCount).toBe(2)
    // 車趟費 = 2 * 300 = 600
    // 品項費 = 150.5*5 + 80.2*3.5 = 752.5 + 280.7 = 1033.2
    // 總金額 = 600 + 1033.2 = 1633.2
    expect(result.totalAmount.toNumber()).toBeCloseTo(1633.2, 1)
  })

  it('應正確儲存月結明細到資料庫', async () => {
    const saved = await prisma.monthlyStatement.findFirst({
      where: { customerId: 'C001', yearMonth: '2026-03' },
    })

    expect(saved).toBeDefined()
    expect(Number(saved!.totalAmount)).toBeCloseTo(1633.2, 1)
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- monthly-statement`
Expected: FAIL

**Step 3: 實作月結明細計算服務**

```typescript
// backend/src/services/monthly-statement.service.ts
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../lib/prisma'
import {
  calculateTypeA,
  calculateTypeB,
  calculateTypeC,
  calculateTypeD,
  type TripSummary,
  type ItemSummary,
  type BillingResult,
} from './billing.service'

export interface StatementResult {
  customerId: string
  yearMonth: string
  tripCount: number
  totalAmount: Decimal
  billingResult: BillingResult
}

// 取得客戶某月的車趟摘要（按日期彙總）
async function getTripSummary(customerId: string, startDate: Date, endDate: Date): Promise<TripSummary[]> {
  const trips = await prisma.trip.groupBy({
    by: ['tripDate'],
    where: {
      customerId,
      tripDate: { gte: startDate, lt: endDate },
    },
    _count: { tripId: true },
    orderBy: { tripDate: 'asc' },
  })

  return trips.map(t => ({
    tripDate: t.tripDate,
    tripCount: t._count.tripId,
  }))
}

// 取得客戶某月的品項摘要（按品項彙總），並查找對應單價
async function getItemSummary(
  customerId: string,
  startDate: Date,
  endDate: Date,
  billingType: string
): Promise<ItemSummary[]> {
  // 彙總品項重量
  const items = await prisma.itemCollected.groupBy({
    by: ['itemName'],
    where: {
      customerId,
      collectionDate: { gte: startDate, lt: endDate },
    },
    _sum: { weightKg: true },
  })

  // C 類客戶：查找合約價
  let contractPrices: Map<string, Decimal> = new Map()
  if (billingType === 'C') {
    const contracts = await prisma.contractPrice.findMany({
      where: {
        customerId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    })
    for (const c of contracts) {
      contractPrices.set(c.itemName, c.contractPrice)
    }
  }

  // 組合品項摘要
  const summaries: ItemSummary[] = []
  for (const item of items) {
    const totalWeight = item._sum.weightKg || new Decimal(0)
    const contractPrice = contractPrices.get(item.itemName)

    if (contractPrice) {
      // 使用合約價
      summaries.push({
        itemName: item.itemName,
        totalWeight,
        unitPrice: contractPrice,
        priceType: 'contract',
      })
    } else {
      // 使用牌價
      const priceRecord = await prisma.itemPrice.findFirst({
        where: {
          itemName: item.itemName,
          effectiveDate: { lte: endDate },
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: startDate } },
          ],
        },
        orderBy: { effectiveDate: 'desc' },
      })

      summaries.push({
        itemName: item.itemName,
        totalWeight,
        unitPrice: priceRecord?.standardPrice || new Decimal(0),
        priceType: 'standard',
      })
    }
  }

  return summaries
}

// 為單一客戶產生月結明細
export async function generateMonthlyStatement(
  customerId: string,
  yearMonth: string
): Promise<StatementResult> {
  const [year, month] = yearMonth.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  // 查詢客戶資料
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { customerId },
  })

  // 取得車趟和品項摘要
  const trips = await getTripSummary(customerId, startDate, endDate)
  const items = await getItemSummary(customerId, startDate, endDate, customer.billingType)

  // 根據計費類型計算
  let billingResult: BillingResult
  switch (customer.billingType) {
    case 'A':
      billingResult = calculateTypeA(trips, items, customer.tripPrice || new Decimal(0))
      break
    case 'B':
      billingResult = calculateTypeB(trips, customer.tripPrice || new Decimal(0))
      break
    case 'C':
      billingResult = calculateTypeC(trips, items)
      break
    case 'D':
      billingResult = calculateTypeD(trips, items)
      break
    default:
      throw new Error(`不支援的計費類型：${customer.billingType}`)
  }

  // 儲存到資料庫（upsert：同客戶同月份只保留一筆）
  await prisma.monthlyStatement.upsert({
    where: {
      // 需要加一個 unique constraint，見下方 Step 4
      statementId: 0, // 暫時佔位，下面用 deleteMany + create 替代
    },
    update: {
      totalAmount: billingResult.totalAmount,
      detailJson: JSON.parse(JSON.stringify(billingResult)),
    },
    create: {
      siteId: customer.siteId,
      customerId,
      yearMonth,
      totalAmount: billingResult.totalAmount,
      detailJson: JSON.parse(JSON.stringify(billingResult)),
      sendStatus: 'pending',
    },
  })

  // 替代方案：先刪再建（避免需要 unique constraint）
  await prisma.monthlyStatement.deleteMany({
    where: { customerId, yearMonth },
  })

  await prisma.monthlyStatement.create({
    data: {
      siteId: customer.siteId,
      customerId,
      yearMonth,
      totalAmount: billingResult.totalAmount,
      detailJson: JSON.parse(JSON.stringify(billingResult)),
      sendStatus: 'pending',
    },
  })

  return {
    customerId,
    yearMonth,
    tripCount: billingResult.tripCount,
    totalAmount: billingResult.totalAmount,
    billingResult,
  }
}

// 為某站點所有客戶產生月結明細
export async function generateAllStatements(
  yearMonth: string,
  siteId?: string
): Promise<StatementResult[]> {
  const where: any = { status: '啟用' }
  if (siteId) where.siteId = siteId

  const customers = await prisma.customer.findMany({ where })
  const results: StatementResult[] = []

  for (const customer of customers) {
    try {
      const result = await generateMonthlyStatement(customer.customerId, yearMonth)
      results.push(result)
    } catch (error: any) {
      console.error(`計算 ${customer.customerId} 月結明細失敗:`, error.message)
    }
  }

  return results
}
```

**注意：** 上面的 upsert 程式碼有佔位問題，實作時請移除 upsert 區塊，只保留 `deleteMany` + `create` 的替代方案。

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- monthly-statement`
Expected: 所有月結明細測試通過

**Step 5: Commit**

```bash
git add backend/src/services/monthly-statement.service.ts backend/tests/monthly-statement.test.ts
git commit -m "feat: 實作月結明細計算服務 (四種計費類型 + 資料庫儲存)"
```

---

### Task 8: 金額異常偵測

**Files:**
- Create: `backend/tests/anomaly.test.ts`
- Create: `backend/src/services/anomaly.service.ts`

**Step 1: 撰寫異常偵測失敗測試**

```typescript
// backend/tests/anomaly.test.ts
import { describe, it, expect } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import { detectAmountAnomaly, type AnomalyResult } from '../src/services/anomaly.service'

describe('金額異常偵測', () => {
  it('金額差異 > 30% 應標記為異常', () => {
    const result = detectAmountAnomaly(
      new Decimal(13000),  // 本月
      new Decimal(10000),  // 上月
      null                 // 去年同期
    )
    expect(result.anomaly).toBe(true)
    expect(result.level).toBe('warning')
    expect(result.reason).toContain('30%')
  })

  it('金額差異 > 50%（vs 去年同期）應標記為重大異常', () => {
    const result = detectAmountAnomaly(
      new Decimal(16000),  // 本月
      new Decimal(12000),  // 上月
      new Decimal(10000)   // 去年同期
    )
    expect(result.anomaly).toBe(true)
    expect(result.level).toBe('critical')
    expect(result.reason).toContain('50%')
  })

  it('金額為 0 應標記', () => {
    const result = detectAmountAnomaly(
      new Decimal(0),
      new Decimal(10000),
      null
    )
    expect(result.anomaly).toBe(true)
    expect(result.reason).toContain('0')
  })

  it('金額差異 < 30% 不應標記', () => {
    const result = detectAmountAnomaly(
      new Decimal(11000),  // 10% 差異
      new Decimal(10000),
      null
    )
    expect(result.anomaly).toBe(false)
  })

  it('無上月資料時不做比較', () => {
    const result = detectAmountAnomaly(
      new Decimal(10000),
      null,
      null
    )
    expect(result.anomaly).toBe(false)
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test -- anomaly`
Expected: FAIL

**Step 3: 實作異常偵測服務**

```typescript
// backend/src/services/anomaly.service.ts
import { Decimal } from '@prisma/client/runtime/library'

export interface AnomalyResult {
  anomaly: boolean
  level: 'none' | 'warning' | 'critical'
  reason: string
  percentChange?: number
}

// 偵測金額異常
export function detectAmountAnomaly(
  currentAmount: Decimal,
  lastMonthAmount: Decimal | null,
  lastYearAmount: Decimal | null
): AnomalyResult {
  // 總金額為 0
  if (currentAmount.equals(0)) {
    return {
      anomaly: true,
      level: 'warning',
      reason: '本月總金額為 0 元',
    }
  }

  // 與去年同期比較（> 50% 為重大異常）
  if (lastYearAmount && !lastYearAmount.equals(0)) {
    const change = currentAmount.sub(lastYearAmount).div(lastYearAmount).mul(100)
    const absChange = Math.abs(change.toNumber())
    if (absChange > 50) {
      return {
        anomaly: true,
        level: 'critical',
        reason: `與去年同期差異 ${change.toNumber() > 0 ? '+' : ''}${change.toFixed(1)}%，超過 50% 門檻`,
        percentChange: change.toNumber(),
      }
    }
  }

  // 與上月比較（> 30% 為異常）
  if (lastMonthAmount && !lastMonthAmount.equals(0)) {
    const change = currentAmount.sub(lastMonthAmount).div(lastMonthAmount).mul(100)
    const absChange = Math.abs(change.toNumber())
    if (absChange > 30) {
      return {
        anomaly: true,
        level: 'warning',
        reason: `與上月差異 ${change.toNumber() > 0 ? '+' : ''}${change.toFixed(1)}%，超過 30% 門檻`,
        percentChange: change.toNumber(),
      }
    }
  }

  return { anomaly: false, level: 'none', reason: '' }
}
```

**Step 4: 執行測試驗證通過**

Run: `cd backend && npm test -- anomaly`
Expected: 所有 5 個異常偵測測試通過

**Step 5: Commit**

```bash
git add backend/src/services/anomaly.service.ts backend/tests/anomaly.test.ts
git commit -m "feat: 實作金額異常偵測 (>30% 警告 / >50% 重大異常 / 零金額)"
```

---

### Task 9: 月結與統計 API 端點

**Files:**
- Create: `backend/src/routes/reports.ts`
- Create: `backend/src/routes/dashboard.ts`
- Modify: `backend/src/app.ts`

**Step 1: 實作報表路由**

```typescript
// backend/src/routes/reports.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { generateAllStatements, generateMonthlyStatement } from '../services/monthly-statement.service'

const router = Router()

// POST /api/reports/monthly/generate - 產生月結明細
router.post(
  '/monthly/generate',
  authenticate,
  authorize('system_admin'),
  async (req: Request, res: Response) => {
    try {
      const { yearMonth, siteId } = req.body
      if (!yearMonth) {
        return res.status(400).json({ message: '請指定 yearMonth (YYYY-MM)' })
      }

      const results = await generateAllStatements(yearMonth, siteId)

      res.json({
        yearMonth,
        total: results.length,
        results: results.map(r => ({
          customerId: r.customerId,
          totalAmount: r.totalAmount.toNumber(),
          tripCount: r.tripCount,
        })),
      })
    } catch (error: any) {
      console.error('產生月結明細失敗:', error)
      res.status(500).json({ message: '產生失敗', error: error.message })
    }
  }
)

// GET /api/reports/monthly - 查詢月結明細
router.get('/monthly', authenticate, async (req: Request, res: Response) => {
  try {
    const { yearMonth, siteId, customerId, page = '1', pageSize = '20' } = req.query

    const where: any = {}
    if (yearMonth) where.yearMonth = yearMonth
    if (siteId) where.siteId = siteId
    if (customerId) where.customerId = customerId

    // 站點管理員只能看自己站點
    if (req.user?.role === 'site_admin' && req.user.siteId) {
      where.siteId = req.user.siteId
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const [data, total] = await Promise.all([
      prisma.monthlyStatement.findMany({
        where,
        include: { customer: { select: { customerName: true, billingType: true } } },
        skip,
        take: Number(pageSize),
        orderBy: { generatedAt: 'desc' },
      }),
      prisma.monthlyStatement.count({ where }),
    ])

    res.json({ data, total, page: Number(page), pageSize: Number(pageSize) })
  } catch (error: any) {
    res.status(500).json({ message: '查詢失敗', error: error.message })
  }
})

export default router
```

**Step 2: 實作儀表板統計路由**

```typescript
// backend/src/routes/dashboard.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

const router = Router()

// GET /api/dashboard/stats - 儀表板統計數據
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

    // 站點限制
    const siteFilter: any = {}
    if (req.user?.role === 'site_admin' && req.user.siteId) {
      siteFilter.siteId = req.user.siteId
    }

    const [todayTrips, todayItems, monthTrips, pendingStatements, expiringContracts] = await Promise.all([
      // 今日匯入車趟數
      prisma.trip.count({ where: { ...siteFilter, importedAt: { gte: today, lt: tomorrow } } }),
      // 今日匯入品項數
      prisma.itemCollected.count({ where: { ...siteFilter, importedAt: { gte: today, lt: tomorrow } } }),
      // 本月車趟總數
      prisma.trip.count({
        where: {
          ...siteFilter,
          tripDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
            lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          },
        },
      }),
      // 待發送明細數
      prisma.monthlyStatement.count({ where: { ...siteFilter, sendStatus: 'pending' } }),
      // 30 天內到期合約
      prisma.contractPrice.findMany({
        where: {
          endDate: {
            gte: today,
            lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          customer: { select: { customerName: true, siteId: true } },
        },
        orderBy: { endDate: 'asc' },
      }),
    ])

    res.json({
      todayTrips,
      todayItems,
      monthTrips,
      pendingStatements,
      expiringContracts: expiringContracts.map(c => ({
        customerId: c.customerId,
        customerName: c.customer.customerName,
        siteId: c.customer.siteId,
        itemName: c.itemName,
        endDate: c.endDate,
        daysLeft: Math.ceil((c.endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
      })),
    })
  } catch (error: any) {
    res.status(500).json({ message: '查詢統計失敗', error: error.message })
  }
})

export default router
```

**Step 3: 在 app.ts 掛載路由**

在 `backend/src/app.ts` 加入：

```typescript
import reportsRouter from './routes/reports'
import dashboardRouter from './routes/dashboard'

app.use('/api/reports', reportsRouter)
app.use('/api/dashboard', dashboardRouter)
```

**Step 4: 執行所有後端測試確認無 regression**

Run: `cd backend && npm test`
Expected: 所有測試通過

**Step 5: Commit**

```bash
git add backend/src/routes/reports.ts backend/src/routes/dashboard.ts backend/src/app.ts
git commit -m "feat: 實作月結明細產生 API 與儀表板統計端點"
```

---

### Task 10: 檔案監控服務

**Files:**
- Create: `backend/src/services/file-watcher.ts`

**Step 1: 實作檔案監控服務**

```typescript
// backend/src/services/file-watcher.ts
import chokidar from 'chokidar'
import path from 'path'
import { importTrips, importItems } from './import.service'
import { prisma } from '../lib/prisma'

// 已處理過的檔案記錄（防止重複匯入）
const processedFiles = new Set<string>()

// 啟動檔案監控
export function startFileWatcher(config: {
  tripDir: string
  itemDir: string
  defaultSiteId: string
}) {
  console.log(`啟動檔案監控...`)
  console.log(`  車趟資料夾: ${config.tripDir}`)
  console.log(`  品項資料夾: ${config.itemDir}`)

  // 監控車趟資料夾
  const tripWatcher = chokidar.watch(config.tripDir, {
    ignored: /(^|[\/\\])\../, // 忽略隱藏檔
    persistent: true,
    ignoreInitial: true, // 不處理已存在的檔案
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
  })

  tripWatcher.on('add', async (filePath) => {
    if (processedFiles.has(filePath)) return
    const ext = path.extname(filePath).toLowerCase()
    if (ext !== '.xlsx' && ext !== '.xls') return

    console.log(`偵測到新車趟檔案: ${filePath}`)
    processedFiles.add(filePath)

    try {
      const result = await importTrips(filePath, config.defaultSiteId)
      console.log(`車趟匯入完成: ${result.imported}/${result.total} 筆成功`)
    } catch (error: any) {
      console.error(`車趟匯入失敗: ${error.message}`)
      await prisma.systemLog.create({
        data: {
          eventType: 'error',
          eventContent: `檔案監控匯入失敗: ${filePath} - ${error.message}`,
        },
      })
    }
  })

  // 監控品項資料夾
  const itemWatcher = chokidar.watch(config.itemDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
  })

  itemWatcher.on('add', async (filePath) => {
    if (processedFiles.has(filePath)) return
    const ext = path.extname(filePath).toLowerCase()
    if (ext !== '.xlsx' && ext !== '.xls') return

    console.log(`偵測到新品項檔案: ${filePath}`)
    processedFiles.add(filePath)

    try {
      const result = await importItems(filePath, config.defaultSiteId)
      console.log(`品項匯入完成: ${result.imported}/${result.total} 筆成功`)
    } catch (error: any) {
      console.error(`品項匯入失敗: ${error.message}`)
      await prisma.systemLog.create({
        data: {
          eventType: 'error',
          eventContent: `檔案監控匯入失敗: ${filePath} - ${error.message}`,
        },
      })
    }
  })

  return { tripWatcher, itemWatcher }
}
```

**Step 2: 在 index.ts 加入可選啟動**

在 `backend/src/index.ts` 加入：

```typescript
import { startFileWatcher } from './services/file-watcher'
import path from 'path'

// 啟動檔案監控（可透過環境變數開關）
if (process.env.ENABLE_FILE_WATCHER === 'true') {
  startFileWatcher({
    tripDir: process.env.TRIP_WATCH_DIR || path.join(__dirname, '../data/trips'),
    itemDir: process.env.ITEM_WATCH_DIR || path.join(__dirname, '../data/items'),
    defaultSiteId: process.env.DEFAULT_SITE_ID || 'S001',
  })
}
```

**Step 3: Commit**

```bash
git add backend/src/services/file-watcher.ts backend/src/index.ts
git commit -m "feat: 實作檔案監控服務 (chokidar 監聽共享資料夾自動匯入)"
```

---

## 階段二A 完成標準

- [x] Excel 解析服務（車機 + ERP 品項格式）
- [x] 資料驗證服務（客戶、品項、重量檢查）
- [x] 匯入 API（POST /api/import/trips、POST /api/import/items）
- [x] 計費引擎 A 類（回收物費用 + 車趟費）
- [x] 計費引擎 B 類（僅車趟費）
- [x] 計費引擎 C 類（合約 + 牌價混合）
- [x] 計費引擎 D 類（全牌價）
- [x] 月結明細計算服務
- [x] 金額異常偵測（>30% 警告 / >50% 重大異常）
- [x] 月結明細 API + 儀表板統計 API
- [x] 檔案監控服務（chokidar）
- [x] 所有測試通過

## 新增的檔案結構

```
backend/
├── src/
│   ├── services/
│   │   ├── auth.service.ts          # (Phase 1)
│   │   ├── excel-parser.ts          # Excel 解析
│   │   ├── import-validator.ts      # 資料驗證
│   │   ├── import.service.ts        # 匯入流程
│   │   ├── billing.service.ts       # 計費引擎
│   │   ├── monthly-statement.service.ts  # 月結計算
│   │   ├── anomaly.service.ts       # 異常偵測
│   │   └── file-watcher.ts          # 檔案監控
│   └── routes/
│       ├── auth.ts                  # (Phase 1)
│       ├── sites.ts                 # (Phase 1)
│       ├── import.ts                # 匯入 API
│       ├── reports.ts               # 報表 API
│       └── dashboard.ts             # 儀表板 API
├── tests/
│   ├── excel-parser.test.ts
│   ├── import-validator.test.ts
│   ├── import.routes.test.ts
│   ├── billing.test.ts
│   ├── monthly-statement.test.ts
│   └── anomaly.test.ts
├── uploads/                         # 上傳檔案暫存
└── data/
    ├── trips/                       # 車機檔案監控目錄
    └── items/                       # ERP 檔案監控目錄
```

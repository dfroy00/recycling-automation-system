# 回收業務自動化系統 — MVP 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 從零建立回收業務自動化系統 MVP，包含客戶/合約/車趟管理、計費引擎、月結明細、報表產出、外部系統 Adapter 整合。

**Architecture:** Express.js REST API 後端 + React SPA 前端，Prisma ORM 存取 PostgreSQL。外部系統（POS/車機）透過 Adapter 抽象層整合，MVP 使用 Mock DB。計費引擎支援品項層級方向（應收/應付/免費）、車趟費、附加費用。

**Tech Stack:** React 18 + TypeScript + Ant Design 5 + React Query | Express.js + TypeScript + Prisma + PostgreSQL 16 | Jest + Supertest

**設計文件：** `docs/plans/2026-02-10-mvp-full-rewrite-design.md`

---

## Phase 1: 專案初始化與資料庫

### Task 1: 後端專案初始化

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `backend/src/app.ts`

**Step 1: 初始化後端專案**

```bash
cd backend
npm init -y
npm install express cors dotenv @prisma/client bcrypt jsonwebtoken node-cron nodemailer exceljs pdfkit
npm install -D typescript @types/express @types/cors @types/node @types/bcrypt @types/jsonwebtoken @types/nodemailer ts-node tsx prisma jest ts-jest @types/jest supertest @types/supertest
npx tsc --init
```

**Step 2: 建立 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: 建立 app.ts（Express 設定）**

```typescript
// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

// 健康檢查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
```

**Step 4: 建立 index.ts（入口點）**

```typescript
// backend/src/index.ts
import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`)
})
```

**Step 5: 設定 package.json scripts**

在 `package.json` 加入：
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --passWithNoTests",
    "test:watch": "jest --watch"
  }
}
```

**Step 6: 設定 Jest**

建立 `backend/jest.config.ts`：
```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
}

export default config
```

**Step 7: 驗證**

```bash
cd backend
npm run test
# Expected: Tests passed (no tests yet, passWithNoTests)
npm run dev
# Expected: 伺服器啟動於 http://localhost:3000
# 瀏覽器打開 http://localhost:3000/api/health → {"status":"ok",...}
# Ctrl+C 停止
```

**Step 8: Commit**

```bash
git add backend/
git commit -m "feat: 初始化後端專案（Express + TypeScript + Jest）"
```

---

### Task 2: Prisma Schema — 核心資料表

**Files:**
- Create: `backend/prisma/schema.prisma`

**Step 1: 初始化 Prisma**

```bash
cd backend
npx prisma init
```

**Step 2: 寫 schema.prisma**

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 站區主檔 ====================
model Site {
  id        Int      @id @default(autoincrement()) /// 自動遞增
  name      String   @unique /// 站區名稱
  address   String?  /// 地址
  phone     String?  /// 聯絡電話
  status    String   @default("active") /// 狀態：active / inactive
  createdAt DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt DateTime @updatedAt @map("updated_at") /// 更新時間

  customers Customer[] /// 站區下的客戶
  trips     Trip[]     /// 站區的車趟

  @@map("sites")
}

// ==================== 品項主檔 ====================
model Item {
  id        Int      @id @default(autoincrement()) /// 自動遞增，同時作為品項編號
  name      String   @unique /// 品項名稱（全公司統一）
  category  String?  /// 分類
  unit      String   /// 計量單位（kg、件、袋等）
  status    String   @default("active") /// 狀態：active / inactive
  createdAt DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt DateTime @updatedAt @map("updated_at") /// 更新時間

  contractItems ContractItem[] /// 被合約引用
  tripItems     TripItem[]     /// 被車趟品項引用

  @@map("items")
}

// ==================== 客戶主檔 ====================
model Customer {
  id                 Int      @id @default(autoincrement()) /// 自動遞增
  siteId             Int      @map("site_id") /// 所屬站區
  name               String   /// 客戶名稱
  contactPerson      String?  @map("contact_person") /// 聯絡人
  phone              String?  /// 電話
  address            String?  /// 地址
  type               String   /// contracted（簽約）/ temporary（臨時）
  tripFeeEnabled     Boolean  @default(false) @map("trip_fee_enabled") /// 是否收車趟費
  tripFeeType        String?  @map("trip_fee_type") /// per_trip（按次）/ per_month（按月）
  tripFeeAmount      Decimal? @map("trip_fee_amount") @db.Decimal(10, 2) /// 車趟費金額
  statementType      String   @default("monthly") @map("statement_type") /// monthly / per_trip
  paymentType        String   @default("lump_sum") @map("payment_type") /// lump_sum / per_trip
  statementSendDay   Int?     @default(15) @map("statement_send_day") /// 明細寄送日（每月幾號）
  paymentDueDay      Int?     @default(15) @map("payment_due_day") /// 付款到期日（每月幾號）
  invoiceRequired    Boolean  @default(false) @map("invoice_required") /// 是否需要開立發票
  invoiceType        String?  @default("net") @map("invoice_type") /// net / separate
  notificationMethod String   @default("email") @map("notification_method") /// email / line / both
  notificationEmail  String?  @map("notification_email") /// 通知 Email
  notificationLineId String?  @map("notification_line_id") /// LINE ID
  paymentAccount     String?  @map("payment_account") /// 匯款帳戶資訊
  status             String   @default("active") /// 狀態：active / inactive
  createdAt          DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt          DateTime @updatedAt @map("updated_at") /// 更新時間

  site       Site           @relation(fields: [siteId], references: [id])
  contracts  Contract[]     /// 客戶的合約
  fees       CustomerFee[]  /// 客戶附加費用
  trips      Trip[]         /// 客戶的車趟
  statements Statement[]    /// 客戶的結算明細

  @@map("customers")
}

// ==================== 客戶附加費用 ====================
model CustomerFee {
  id               Int      @id @default(autoincrement()) /// 自動遞增
  customerId       Int      @map("customer_id") /// 所屬客戶
  name             String   /// 費用名稱（自由輸入）
  amount           Decimal  @db.Decimal(10, 2) /// 固定金額
  billingDirection String   @map("billing_direction") /// receivable / payable
  frequency        String   /// monthly / per_trip
  status           String   @default("active") /// 狀態：active / inactive
  createdAt        DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt        DateTime @updatedAt @map("updated_at") /// 更新時間

  customer Customer @relation(fields: [customerId], references: [id])

  @@map("customer_fees")
}

// ==================== 合約 ====================
model Contract {
  id             Int      @id @default(autoincrement()) /// 自動遞增
  customerId     Int      @map("customer_id") /// 所屬客戶
  contractNumber String   @unique @map("contract_number") /// 合約編號
  startDate      DateTime @map("start_date") @db.Date /// 合約起始日
  endDate        DateTime @map("end_date") @db.Date /// 合約到期日
  status         String   @default("draft") /// draft / active / expired / terminated
  notes          String?  /// 備註
  createdAt      DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt      DateTime @updatedAt @map("updated_at") /// 更新時間

  customer Customer       @relation(fields: [customerId], references: [id])
  items    ContractItem[] /// 合約品項

  @@map("contracts")
}

// ==================== 合約品項（計費核心） ====================
model ContractItem {
  id               Int      @id @default(autoincrement()) /// 自動遞增
  contractId       Int      @map("contract_id") /// 所屬合約
  itemId           Int      @map("item_id") /// 品項
  unitPrice        Decimal  @map("unit_price") @db.Decimal(10, 2) /// 合約單價
  billingDirection String   @map("billing_direction") /// receivable / payable / free
  createdAt        DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt        DateTime @updatedAt @map("updated_at") /// 更新時間

  contract Contract @relation(fields: [contractId], references: [id])
  item     Item     @relation(fields: [itemId], references: [id])

  @@map("contract_items")
}

// ==================== 車趟紀錄 ====================
model Trip {
  id           Int      @id @default(autoincrement()) /// 自動遞增
  customerId   Int      @map("customer_id") /// 客戶
  siteId       Int      @map("site_id") /// 站區
  tripDate     DateTime @map("trip_date") @db.Date /// 收運日期
  tripTime     String?  @map("trip_time") /// 收運時間（如 08:30，用於同步去重比對，手動建立可為 null）
  driver       String?  /// 司機
  vehiclePlate String?  @map("vehicle_plate") /// 車牌
  source       String   @default("manual") /// 資料來源：manual / pos_sync / vehicle_sync
  externalId   String?  @map("external_id") /// 外部系統原始 ID
  notes        String?  /// 備註
  createdAt    DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt    DateTime @updatedAt @map("updated_at") /// 更新時間

  customer   Customer   @relation(fields: [customerId], references: [id])
  site       Site       @relation(fields: [siteId], references: [id])
  items      TripItem[] /// 趟次品項明細
  statements Statement[] @relation("TripStatement") /// 按趟明細

  @@map("trips")
}

// ==================== 趟次品項明細 ====================
model TripItem {
  id               Int      @id @default(autoincrement()) /// 自動遞增
  tripId           Int      @map("trip_id") /// 所屬車趟
  itemId           Int      @map("item_id") /// 品項
  quantity         Decimal  @db.Decimal(10, 2) /// 數量
  unit             String   /// 快照：收運當時的計量單位
  unitPrice        Decimal  @map("unit_price") @db.Decimal(10, 2) /// 快照：收運當時的單價
  billingDirection String   @map("billing_direction") /// 快照：收運當時的方向
  amount           Decimal  @db.Decimal(10, 2) /// 計算金額（unitPrice × quantity）
  createdAt        DateTime @default(now()) @map("created_at") /// 建立時間

  trip Trip @relation(fields: [tripId], references: [id])
  item Item @relation(fields: [itemId], references: [id])

  @@map("trip_items")
}

// ==================== 結算明細（月結 + 按趟） ====================
model Statement {
  id                    Int       @id @default(autoincrement()) /// 自動遞增
  customerId            Int       @map("customer_id") /// 客戶
  statementType         String    @map("statement_type") /// monthly / per_trip
  tripId                Int?      @map("trip_id") /// 關聯車趟（僅 per_trip 使用）
  yearMonth             String    @map("year_month") /// 結算月份（如 2026-01）
  itemReceivable        Decimal   @default(0) @map("item_receivable") @db.Decimal(12, 2) /// 品項應收小計
  itemPayable           Decimal   @default(0) @map("item_payable") @db.Decimal(12, 2) /// 品項應付小計
  tripFeeTotal          Decimal   @default(0) @map("trip_fee_total") @db.Decimal(12, 2) /// 車趟費合計
  additionalFeeReceivable Decimal @default(0) @map("additional_fee_receivable") @db.Decimal(12, 2) /// 應收附加費用合計
  additionalFeePayable  Decimal   @default(0) @map("additional_fee_payable") @db.Decimal(12, 2) /// 應付附加費用合計
  totalReceivable       Decimal   @default(0) @map("total_receivable") @db.Decimal(12, 2) /// 應收合計
  totalPayable          Decimal   @default(0) @map("total_payable") @db.Decimal(12, 2) /// 應付合計
  netAmount             Decimal   @default(0) @map("net_amount") @db.Decimal(12, 2) /// 淨額
  subtotal              Decimal   @default(0) @db.Decimal(12, 2) /// 小計
  taxAmount             Decimal   @default(0) @map("tax_amount") @db.Decimal(12, 2) /// 稅額（5%）
  totalAmount           Decimal   @default(0) @map("total_amount") @db.Decimal(12, 2) /// 總額
  receivableSubtotal    Decimal?  @map("receivable_subtotal") @db.Decimal(12, 2) /// 分開開票：應收小計
  receivableTax         Decimal?  @map("receivable_tax") @db.Decimal(12, 2) /// 分開開票：應收稅額
  receivableTotal       Decimal?  @map("receivable_total") @db.Decimal(12, 2) /// 分開開票：應收總額
  payableSubtotal       Decimal?  @map("payable_subtotal") @db.Decimal(12, 2) /// 分開開票：應付小計
  payableTax            Decimal?  @map("payable_tax") @db.Decimal(12, 2) /// 分開開票：應付稅額
  payableTotal          Decimal?  @map("payable_total") @db.Decimal(12, 2) /// 分開開票：應付總額
  detailJson            Json?     @map("detail_json") /// 完整明細 JSON
  status                String    @default("draft") /// draft / approved / rejected / invoiced / sent
  reviewedBy            Int?      @map("reviewed_by") /// 審核人
  reviewedAt            DateTime? @map("reviewed_at") /// 審核時間
  sentAt                DateTime? @map("sent_at") /// 寄送時間
  sentMethod            String?   @map("sent_method") /// email / line
  createdAt             DateTime  @default(now()) @map("created_at") /// 建立時間
  updatedAt             DateTime  @updatedAt @map("updated_at") /// 更新時間

  customer Customer @relation(fields: [customerId], references: [id])
  trip     Trip?    @relation("TripStatement", fields: [tripId], references: [id])
  reviewer User?    @relation(fields: [reviewedBy], references: [id])

  @@map("statements")
}

// ==================== 假日主檔 ====================
model Holiday {
  id        Int      @id @default(autoincrement()) /// 自動遞增
  date      DateTime @unique @db.Date /// 假日日期
  name      String   /// 假日名稱
  year      Int      /// 年份
  createdAt DateTime @default(now()) @map("created_at") /// 建立時間

  @@map("holidays")
}

// ==================== 使用者 ====================
model User {
  id           Int      @id @default(autoincrement()) /// 自動遞增
  username     String   @unique /// 帳號
  passwordHash String   @map("password_hash") /// 密碼雜湊
  name         String   /// 姓名
  email        String?  /// Email
  role         String   @default("admin") /// 角色（MVP 統一為 admin）
  status       String   @default("active") /// 狀態：active / inactive
  createdAt    DateTime @default(now()) @map("created_at") /// 建立時間
  updatedAt    DateTime @updatedAt @map("updated_at") /// 更新時間

  statements  Statement[] /// 審核過的明細
  systemLogs  SystemLog[] /// 操作日誌

  @@map("users")
}

// ==================== 系統日誌 ====================
model SystemLog {
  id           Int      @id @default(autoincrement()) /// 自動遞增
  eventType    String   @map("event_type") /// 事件類型
  eventContent String   @map("event_content") /// 事件內容
  userId       Int?     @map("user_id") /// 操作使用者
  createdAt    DateTime @default(now()) @map("created_at") /// 建立時間

  user User? @relation(fields: [userId], references: [id])

  @@map("system_logs")
}

// ==================== Mock DB：模擬 POS 收運紀錄 ====================
model MockPosCollection {
  id             Int      @id @default(autoincrement()) /// 自動遞增
  externalId     String   @unique @map("external_id") /// 模擬外部系統 ID
  siteName       String   @map("site_name") /// 站區名稱
  customerName   String   @map("customer_name") /// 客戶名稱
  collectionDate DateTime @map("collection_date") @db.Date /// 收運日期
  itemName       String   @map("item_name") /// 品項名稱
  quantity       Decimal  @db.Decimal(10, 2) /// 數量
  unit           String   /// 計量單位
  unitPrice      Decimal  @map("unit_price") @db.Decimal(10, 2) /// 單價
  imported       Boolean  @default(false) /// 是否已匯入本系統
  createdAt      DateTime @default(now()) @map("created_at") /// 建立時間

  @@map("mock_pos_collections")
}

// ==================== Mock DB：模擬車機車趟紀錄 ====================
model MockVehicleTrip {
  id           Int      @id @default(autoincrement()) /// 自動遞增
  externalId   String   @unique @map("external_id") /// 模擬外部系統 ID
  siteName     String   @map("site_name") /// 站區名稱
  customerName String   @map("customer_name") /// 客戶名稱
  tripDate     DateTime @map("trip_date") @db.Date /// 車趟日期
  tripTime     String?  @map("trip_time") /// 出車時間
  driver       String   /// 司機姓名
  vehiclePlate String   @map("vehicle_plate") /// 車牌號碼
  status       String   @default("completed") /// pending / in_progress / completed
  imported     Boolean  @default(false) /// 是否已匯入本系統
  createdAt    DateTime @default(now()) @map("created_at") /// 建立時間

  @@map("mock_vehicle_trips")
}
```

**Step 3: 執行 migration**

```bash
cd backend
npx prisma migrate dev --name init
```

Expected: Migration 成功，資料庫建立所有資料表。

**Step 4: 建立 Prisma client 工具**

建立 `backend/src/lib/prisma.ts`：
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default prisma
```

**Step 5: 驗證**

```bash
npx prisma studio
# Expected: 瀏覽器開啟 Prisma Studio，可看到所有資料表
```

**Step 6: Commit**

```bash
git add backend/prisma/ backend/src/lib/
git commit -m "feat: 建立 Prisma Schema（全部資料表含 Mock DB）"
```

---

### Task 3: 種子資料

**Files:**
- Create: `backend/prisma/seed.ts`

**Step 1: 寫種子資料**

```typescript
// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // 1. 使用者
  const passwordHash = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      name: '系統管理員',
      email: 'admin@example.com',
      role: 'admin',
    },
  })

  // 2. 站區（7 個）
  const siteNames = ['新竹站', '草屯站', '金馬站', '員林站', '斗六站', '和美站', '神岡站']
  for (const name of siteNames) {
    await prisma.site.upsert({
      where: { name },
      update: {},
      create: { name, status: 'active' },
    })
  }

  // 3. 品項（5 大分類，共 46 項）
  const items = [
    // 紙類
    { name: '總紙', unit: 'kg', category: '紙類' },
    { name: '報紙', unit: 'kg', category: '紙類' },
    { name: '雜誌', unit: 'kg', category: '紙類' },
    { name: '廣告紙', unit: 'kg', category: '紙類' },
    { name: '紙袋', unit: 'kg', category: '紙類' },
    // 鐵類
    { name: '沖床鐵THS', unit: 'kg', category: '鐵類' },
    { name: '特工鐵THF', unit: 'kg', category: '鐵類' },
    { name: '鍛造鐵', unit: 'kg', category: '鐵類' },
    { name: '西工鐵', unit: 'kg', category: '鐵類' },
    { name: '總鐵', unit: 'kg', category: '鐵類' },
    { name: '古物鐵', unit: 'kg', category: '鐵類' },
    { name: '大鐵桶', unit: 'kg', category: '鐵類' },
    { name: '鐵罐', unit: 'kg', category: '鐵類' },
    { name: '鐵粉', unit: 'kg', category: '鐵類' },
    { name: '中厚版', unit: 'kg', category: '鐵類' },
    { name: '中古料', unit: 'kg', category: '鐵類' },
    { name: '封閉式容器', unit: 'kg', category: '鐵類' },
    // 五金類
    { name: '青銅', unit: 'kg', category: '五金類' },
    { name: '馬達', unit: 'kg', category: '五金類' },
    { name: '熱水器', unit: 'kg', category: '五金類' },
    { name: '紅銅燒', unit: 'kg', category: '五金類' },
    { name: '紅銅割', unit: 'kg', category: '五金類' },
    { name: '白鐵', unit: 'kg', category: '五金類' },
    { name: '軟鋁(家庭仔)', unit: 'kg', category: '五金類' },
    { name: '軟鋁(厚料)', unit: 'kg', category: '五金類' },
    { name: '硬鋁', unit: 'kg', category: '五金類' },
    { name: '電線', unit: 'kg', category: '五金類' },
    { name: '鋁罐', unit: 'kg', category: '五金類' },
    { name: '銅排', unit: 'kg', category: '五金類' },
    { name: '鉛', unit: 'kg', category: '五金類' },
    { name: '鋅', unit: 'kg', category: '五金類' },
    // 塑膠類
    { name: 'PET', unit: 'kg', category: '塑膠類' },
    { name: 'HDPE', unit: 'kg', category: '塑膠類' },
    { name: 'PVC', unit: 'kg', category: '塑膠類' },
    { name: 'LDPE', unit: 'kg', category: '塑膠類' },
    { name: 'PP', unit: 'kg', category: '塑膠類' },
    { name: 'PS', unit: 'kg', category: '塑膠類' },
    { name: '其他塑膠', unit: 'kg', category: '塑膠類' },
    // 雜項
    { name: '壓克力', unit: 'kg', category: '雜項' },
    { name: '日光燈管', unit: 'kg', category: '雜項' },
    { name: '電瓶', unit: 'kg', category: '雜項' },
    { name: '乾電池', unit: 'kg', category: '雜項' },
    { name: 'CD片', unit: 'kg', category: '雜項' },
    { name: 'PP打包帶', unit: 'kg', category: '雜項' },
    { name: '大青桶', unit: 'kg', category: '雜項' },
    { name: '蘆筍籃', unit: 'kg', category: '雜項' },
  ]
  for (const item of items) {
    await prisma.item.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    })
  }

  // 4. 假日（2026 年台灣國定假日）
  const holidays2026 = [
    { date: '2026-01-01', name: '元旦' },
    { date: '2026-01-29', name: '除夕' },
    { date: '2026-01-30', name: '春節' },
    { date: '2026-01-31', name: '春節' },
    { date: '2026-02-01', name: '春節' },
    { date: '2026-02-02', name: '春節' },
    { date: '2026-02-28', name: '和平紀念日' },
    { date: '2026-04-04', name: '兒童節' },
    { date: '2026-04-05', name: '清明節' },
    { date: '2026-05-01', name: '勞動節' },
    { date: '2026-06-19', name: '端午節' },
    { date: '2026-09-25', name: '中秋節' },
    { date: '2026-10-10', name: '國慶日' },
  ]
  for (const h of holidays2026) {
    await prisma.holiday.upsert({
      where: { date: new Date(h.date) },
      update: {},
      create: { date: new Date(h.date), name: h.name, year: 2026 },
    })
  }

  // 5. 測試客戶（簽約 + 臨時）
  const hsinchu = await prisma.site.findUnique({ where: { name: '新竹站' } })
  const caotun = await prisma.site.findUnique({ where: { name: '草屯站' } })

  const customer1 = await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      siteId: hsinchu!.id,
      name: '大明企業',
      contactPerson: '陳大明',
      phone: '03-1234567',
      address: '新竹市東區光復路100號',
      type: 'contracted',
      tripFeeEnabled: true,
      tripFeeType: 'per_trip',
      tripFeeAmount: 500,
      statementType: 'monthly',
      paymentType: 'lump_sum',
      invoiceRequired: true,
      invoiceType: 'net',
      notificationMethod: 'email',
      notificationEmail: 'daming@example.com',
    },
  })

  const customer2 = await prisma.customer.upsert({
    where: { id: 2 },
    update: {},
    create: {
      siteId: hsinchu!.id,
      name: '小華工廠',
      contactPerson: '林小華',
      phone: '03-7654321',
      address: '新竹市香山區中華路200號',
      type: 'contracted',
      tripFeeEnabled: true,
      tripFeeType: 'per_month',
      tripFeeAmount: 3000,
      statementType: 'monthly',
      paymentType: 'lump_sum',
      invoiceRequired: false,
      notificationMethod: 'email',
      notificationEmail: 'xiaohua@example.com',
    },
  })

  const customer3 = await prisma.customer.upsert({
    where: { id: 3 },
    update: {},
    create: {
      siteId: caotun!.id,
      name: '王先生',
      phone: '0912-345678',
      type: 'temporary',
      tripFeeEnabled: false,
      statementType: 'per_trip',
      paymentType: 'lump_sum',
      invoiceRequired: false,
      notificationMethod: 'email',
    },
  })

  // 6. 測試合約 + 合約品項
  const zongzhi = await prisma.item.findUnique({ where: { name: '總紙' } })
  const zongtie = await prisma.item.findUnique({ where: { name: '總鐵' } })
  const pet = await prisma.item.findUnique({ where: { name: 'PET' } })
  const hongtongsao = await prisma.item.findUnique({ where: { name: '紅銅燒' } })

  const contract1 = await prisma.contract.upsert({
    where: { contractNumber: 'C-2026-001' },
    update: {},
    create: {
      customerId: customer1.id,
      contractNumber: 'C-2026-001',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
    },
  })

  // 大明企業合約品項：總紙(應付)、總鐵(應付)、PET(應收)
  const contractItems1 = [
    { contractId: contract1.id, itemId: zongzhi!.id, unitPrice: 3.5, billingDirection: 'payable' },
    { contractId: contract1.id, itemId: zongtie!.id, unitPrice: 8.0, billingDirection: 'payable' },
    { contractId: contract1.id, itemId: pet!.id, unitPrice: 2.0, billingDirection: 'receivable' },
  ]
  for (const ci of contractItems1) {
    await prisma.contractItem.create({ data: ci })
  }

  const contract2 = await prisma.contract.upsert({
    where: { contractNumber: 'C-2026-002' },
    update: {},
    create: {
      customerId: customer2.id,
      contractNumber: 'C-2026-002',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
    },
  })

  // 小華工廠合約品項：總鐵(應付)、紅銅燒(應付)
  const contractItems2 = [
    { contractId: contract2.id, itemId: zongtie!.id, unitPrice: 7.5, billingDirection: 'payable' },
    { contractId: contract2.id, itemId: hongtongsao!.id, unitPrice: 150.0, billingDirection: 'payable' },
  ]
  for (const ci of contractItems2) {
    await prisma.contractItem.create({ data: ci })
  }

  // 7. 測試附加費用
  await prisma.customerFee.create({
    data: {
      customerId: customer1.id,
      name: '處理費',
      amount: 1000,
      billingDirection: 'receivable',
      frequency: 'monthly',
    },
  })

  console.log('種子資料建立完成')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
```

**Step 2: 在 package.json 加入 seed 指令**

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Step 3: 執行 seed**

```bash
cd backend
npx prisma db seed
```

Expected: 「種子資料建立完成」

**Step 4: Commit**

```bash
git add backend/prisma/seed.ts backend/package.json
git commit -m "feat: 新增種子資料（使用者、站區、品項、假日）"
```

---

## Phase 2: 認證與基礎 CRUD

### Task 4: JWT 認證

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/__tests__/auth.test.ts`

**Step 1: 寫認證中介層**

```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: number
  userName?: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '未提供認證 Token' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
      userId: number
      userName: string
    }
    req.userId = decoded.userId
    req.userName = decoded.userName
    next()
  } catch {
    return res.status(401).json({ error: 'Token 無效或已過期' })
  }
}
```

**Step 2: 寫認證路由**

```typescript
// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /api/auth/login — 登入
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '請輸入帳號和密碼' })
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: '帳號或密碼錯誤' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: '帳號或密碼錯誤' })
  }

  const token = jwt.sign(
    { userId: user.id, userName: user.name },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  })
})

// GET /api/auth/me — 取得當前使用者
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, name: true, email: true, role: true },
  })
  if (!user) {
    return res.status(404).json({ error: '使用者不存在' })
  }
  res.json(user)
})

export default router
```

**Step 3: 在 app.ts 掛載路由**

```typescript
// 在 app.ts 加入
import authRoutes from './routes/auth'
app.use('/api/auth', authRoutes)
```

**Step 4: 寫測試**

```typescript
// backend/src/__tests__/auth.test.ts
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'

beforeAll(async () => {
  // 建立測試使用者
  const hash = await bcrypt.hash('test123', 10)
  await prisma.user.upsert({
    where: { username: 'testuser' },
    update: { passwordHash: hash },
    create: { username: 'testuser', passwordHash: hash, name: '測試使用者' },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: 'testuser' } })
  await prisma.$disconnect()
})

describe('POST /api/auth/login', () => {
  it('正確帳密應回傳 token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.username).toBe('testuser')
  })

  it('錯誤密碼應回傳 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('有效 token 應回傳使用者資訊', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' })
    const token = loginRes.body.token

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.username).toBe('testuser')
  })

  it('無 token 應回傳 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
```

**Step 5: 執行測試**

```bash
cd backend && npm test
```

Expected: 4 tests passed

**Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat: 實作 JWT 認證（login + me + 中介層 + 測試）"
```

---

### Task 5: 站區 CRUD

**Files:**
- Create: `backend/src/routes/sites.ts`
- Create: `backend/src/__tests__/sites.test.ts`

**Step 1: 寫站區路由**

```typescript
// backend/src/routes/sites.ts
import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

// GET /api/sites — 列表
router.get('/', async (_req: Request, res: Response) => {
  const sites = await prisma.site.findMany({ orderBy: { id: 'asc' } })
  res.json(sites)
})

// GET /api/sites/:id — 詳情
router.get('/:id', async (req: Request, res: Response) => {
  const site = await prisma.site.findUnique({ where: { id: Number(req.params.id) } })
  if (!site) return res.status(404).json({ error: '站區不存在' })
  res.json(site)
})

// POST /api/sites — 新增
router.post('/', async (req: Request, res: Response) => {
  const { name, address, phone } = req.body
  if (!name) return res.status(400).json({ error: '站區名稱為必填' })

  try {
    const site = await prisma.site.create({ data: { name, address, phone } })
    res.status(201).json(site)
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: '站區名稱已存在' })
    throw e
  }
})

// PATCH /api/sites/:id — 更新
router.patch('/:id', async (req: Request, res: Response) => {
  const { name, address, phone, status } = req.body
  try {
    const site = await prisma.site.update({
      where: { id: Number(req.params.id) },
      data: { ...(name && { name }), ...(address !== undefined && { address }), ...(phone !== undefined && { phone }), ...(status && { status }) },
    })
    res.json(site)
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ error: '站區不存在' })
    if (e.code === 'P2002') return res.status(409).json({ error: '站區名稱已存在' })
    throw e
  }
})

// DELETE /api/sites/:id — 刪除（軟刪除）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.site.update({ where: { id: Number(req.params.id) }, data: { status: 'inactive' } })
    res.json({ message: '已停用' })
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ error: '站區不存在' })
    throw e
  }
})

export default router
```

**Step 2: 在 app.ts 掛載**

```typescript
import siteRoutes from './routes/sites'
app.use('/api/sites', authMiddleware as any, siteRoutes)
```

**Step 3: 寫測試**（參照 auth.test.ts 的 token 取得模式，測試 CRUD 五個端點）

**Step 4: 執行測試**

```bash
cd backend && npm test
```

**Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: 實作站區 CRUD API + 測試"
```

---

### Task 6: 品項 CRUD

同 Task 5 模式。
- Create: `backend/src/routes/items.ts`
- Create: `backend/src/__tests__/items.test.ts`
- 掛載到 `app.ts`: `app.use('/api/items', authMiddleware, itemRoutes)`
- 注意：品項名稱 unique，id 即為品項編號

**Commit:** `feat: 實作品項 CRUD API + 測試`

---

### Task 7: 使用者 CRUD

同 Task 5 模式。
- Create: `backend/src/routes/users.ts`
- Create: `backend/src/__tests__/users.test.ts`
- 注意：建立使用者時密碼要 bcrypt hash，回傳時不包含 passwordHash

**Commit:** `feat: 實作使用者 CRUD API + 測試`

---

### Task 8: 假日 CRUD

- Create: `backend/src/routes/holidays.ts`
- Create: `backend/src/__tests__/holidays.test.ts`
- 端點：GET 列表（可依年份篩選）、POST 新增、DELETE 刪除、POST /import 批次匯入

**Commit:** `feat: 實作假日 CRUD API + 批次匯入 + 測試`

---

### Task 20: 儀表板統計 API

**Files:**
- Create: `backend/src/routes/dashboard.ts`
- Create: `backend/src/__tests__/dashboard.test.ts`

端點：`GET /api/dashboard/stats`

回傳彙總統計：
- 本月車趟數
- 本月應收總額 / 應付總額
- 有效客戶數
- 待審核明細數
- 合約即將到期提醒（30/15/7 天內到期的合約清單）

掛載到 `app.ts`: `app.use('/api/dashboard', authMiddleware, dashboardRoutes)`

**Commit:** `feat: 實作儀表板統計 API`

---

## Phase 3: 客戶與合約管理

### Task 9: 客戶 CRUD

**Files:**
- Create: `backend/src/routes/customers.ts`
- Create: `backend/src/__tests__/customers.test.ts`

客戶欄位多，注意事項：
- GET 列表支援篩選：`?siteId=1&type=contracted&status=active`
- GET 詳情包含 `include: { site: true, fees: true }`
- POST/PATCH 驗證：
  - `type` 必須是 `contracted` 或 `temporary`
  - `statementType` 為 `per_trip` 時，`paymentType` 強制為 `lump_sum`（設計文件 #10 修正）
  - `tripFeeEnabled` 為 true 時，`tripFeeType` 和 `tripFeeAmount` 為必填

**Commit:** `feat: 實作客戶 CRUD API + 測試`

---

### Task 10: 客戶附加費用 CRUD

**Files:**
- Create: 在 `backend/src/routes/customers.ts` 內新增附加費用子路由
- Create: `backend/src/__tests__/customer-fees.test.ts`

端點：
- `GET /api/customers/:id/fees` — 列表
- `POST /api/customers/:id/fees` — 新增
- `PATCH /api/customers/:cid/fees/:fid` — 更新
- `DELETE /api/customers/:cid/fees/:fid` — 刪除（軟刪除）

驗證：
- `billingDirection` 必須是 `receivable` 或 `payable`
- `frequency` 必須是 `monthly` 或 `per_trip`
- **按趟結算客戶限制**：若客戶 `statementType=per_trip`，則 `frequency` 只允許 `per_trip`，不可選 `monthly`（避免月度費用無處歸屬）。UI 需鎖定此選項

**Commit:** `feat: 實作客戶附加費用 CRUD API + 測試`

---

### Task 11: 合約 CRUD

**Files:**
- Create: `backend/src/routes/contracts.ts`
- Create: `backend/src/__tests__/contracts.test.ts`

注意：
- GET 列表支援 `?customerId=1&status=active`
- 合約編號格式：由前端傳入或自動產生（如 `C-2026-001`）
- `startDate`/`endDate` 為 Date 型別

**Commit:** `feat: 實作合約 CRUD API + 測試`

---

### Task 12: 合約品項 CRUD

**Files:**
- 新增於 `backend/src/routes/contracts.ts`
- Create: `backend/src/__tests__/contract-items.test.ts`

端點：
- `GET /api/contracts/:id/items`
- `POST /api/contracts/:id/items`
- `PATCH /api/contracts/:cid/items/:iid`
- `DELETE /api/contracts/:cid/items/:iid`

驗證：`billingDirection` 必須是 `receivable`/`payable`/`free`

**Commit:** `feat: 實作合約品項 CRUD API + 測試`

---

## Phase 4: Adapter 層（外部系統整合）

### Task 13: Adapter 介面與型別

**Files:**
- Create: `backend/src/adapters/types.ts`
- Create: `backend/src/adapters/pos.adapter.ts`
- Create: `backend/src/adapters/vehicle.adapter.ts`
- Create: `backend/src/adapters/index.ts`

**Step 1: 定義共用型別**

```typescript
// backend/src/adapters/types.ts
export interface PosCollectionRecord {
  externalId: string     // 外部系統 ID
  siteName: string       // 站區名稱
  customerName: string   // 客戶名稱
  collectionDate: Date   // 收運日期
  itemName: string       // 品項名稱
  quantity: number       // 數量
  unit: string           // 計量單位
  unitPrice: number      // 單價
}

export interface VehicleTripRecord {
  externalId: string
  siteName: string
  customerName: string
  tripDate: Date
  tripTime?: string
  driver: string
  vehiclePlate: string
  status: string
}

export interface VehicleStatus {
  vehiclePlate: string
  driver: string
  status: string         // idle / on_route / loading
  lastUpdate: Date
}

export interface CustomerSyncData {
  id: number
  name: string
  siteName: string
  phone?: string
  address?: string
}

export interface ContractPriceSyncData {
  customerName: string
  itemName: string
  unitPrice: number
  billingDirection: string
}

export interface DispatchData {
  siteName: string
  customerName: string
  tripDate: Date
  driver: string
  vehiclePlate: string
}
```

**Step 2: 定義介面**

```typescript
// backend/src/adapters/pos.adapter.ts
import { PosCollectionRecord, CustomerSyncData, ContractPriceSyncData } from './types'

// 健康檢查介面（IPosAdapter 和 IVehicleAdapter 皆須實作）
export interface AdapterHealthCheckResult {
  status: 'ok' | 'error'        // 連線狀態
  mode: 'mock' | 'real'         // 當前模式
  message?: string              // 錯誤訊息（僅 error 時）
  lastSyncAt?: Date             // 上次成功同步時間
}

export interface IPosAdapter {
  getCollectionRecords(params: {
    siteId?: number
    customerId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<PosCollectionRecord[]>

  getLatestRecords(since: Date): Promise<PosCollectionRecord[]>
  syncCustomer(customer: CustomerSyncData): Promise<void>
  syncContractPrices(contractItems: ContractPriceSyncData[]): Promise<void>
  healthCheck(): Promise<AdapterHealthCheckResult>
}
```

```typescript
// backend/src/adapters/vehicle.adapter.ts
import { VehicleTripRecord, VehicleStatus, CustomerSyncData, DispatchData } from './types'

export interface IVehicleAdapter {
  getTripRecords(params: {
    siteId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<VehicleTripRecord[]>

  getVehicleStatus(): Promise<VehicleStatus[]>
  syncCustomer(customer: CustomerSyncData): Promise<void>
  dispatchTrip(dispatch: DispatchData): Promise<void>
  healthCheck(): Promise<AdapterHealthCheckResult>
}
```

**Step 3: 工廠函數**（依設計文件第 2 章）

**Step 4: Commit**

```bash
git add backend/src/adapters/
git commit -m "feat: 定義 Adapter 介面（IPosAdapter + IVehicleAdapter + 型別）"
```

---

### Task 14: Mock POS Adapter

**Files:**
- Create: `backend/src/adapters/mock/mock-pos.adapter.ts`
- Create: `backend/src/__tests__/mock-pos-adapter.test.ts`

實作 `MockPosAdapter` 讀寫 `mock_pos_collections` 資料表。
- `getCollectionRecords`: 查詢 mock_pos_collections，用 siteName/customerName 比對
- `getLatestRecords`: 查詢 createdAt > since 的紀錄
- `syncCustomer`: 記錄到 system_logs（Mock 模式不實際寫入）
- `syncContractPrices`: 同上

**Commit:** `feat: 實作 MockPosAdapter（讀寫 mock_pos_collections）`

---

### Task 15: Mock Vehicle Adapter

同 Task 14 模式，實作 `MockVehicleAdapter` 讀寫 `mock_vehicle_trips`。

**Commit:** `feat: 實作 MockVehicleAdapter（讀寫 mock_vehicle_trips）`

---

### Task 16: Mock 假資料產生器

**Files:**
- Create: `backend/src/adapters/mock/mock-data-seeder.ts`

產生模擬的 POS 收運紀錄和車機車趟紀錄：
- 依據 seed 的站區、客戶、合約品項產生 3 個月的假資料
- 每天每個客戶 1-3 趟，每趟 2-5 個品項
- 觸發方式：
  - CLI：`npm run seed:mock`（在 package.json 加入 script：`"seed:mock": "tsx src/adapters/mock/mock-data-seeder.ts"`）
  - API：`POST /api/sync/mock/generate`（僅 mock 模式可用，加入 sync 路由）

**Commit:** `feat: 實作 Mock 假資料產生器`

---

### Task 17: 同步 API 路由

**Files:**
- Create: `backend/src/routes/sync.ts`
- Create: `backend/src/services/sync.service.ts`

端點（依設計文件 API 路由表）：
- `POST /api/sync/pos/pull` — 從 POS 拉取收運紀錄，比對名稱後建立 trips + trip_items
- `POST /api/sync/pos/push-customers` — 推送客戶資料
- `POST /api/sync/pos/push-prices` — 推送合約品項定價
- `POST /api/sync/vehicle/pull` — 從車機拉取車趟紀錄
- `POST /api/sync/vehicle/push-customers` — 推送客戶資料
- `POST /api/sync/vehicle/dispatch` — 派車指令
- `GET /api/sync/vehicle/status` — 車輛狀態
- `GET /api/sync/status` — Adapter 模式狀態

名稱比對邏輯（依設計文件「外部系統資料對應策略」）：精確比對 name，失敗記 system_logs。

**POS 同步定價策略：**
- 簽約客戶：使用本系統合約價（忽略 POS 端 unit_price）
- 臨時客戶：使用 POS 端 unit_price，billing_direction 預設 receivable

**去重策略（依設計文件去重比對鍵優先順序）：**
- POS 同步建立 trip + trip_items（source=pos_sync）
- 車機同步時，依以下優先順序比對：
  1. **`external_id` 精確比對**（最可靠，同來源系統的唯一識別）
  2. 同一客戶 + 同一日期 + 同一站區 + **時間區間（±30分鐘）**模糊比對
- 匹配到已存在的 trip → 補充 driver + vehicle_plate，不建立新 trip
- 車機同步未匹配到則建立新 trip（source=vehicle_sync），不含品項明細，需人工補充
- 同一客戶同一天同一站區可能有多趟收運，**必須搭配 trip_time 區分**，純「客戶+日期+站區」不足以唯一識別
- 每筆同步紀錄的 `external_id` 必須記錄，供後續追溯和去重
- 同步順序建議：先 POS → 再車機
- 新增 `POST /api/sync/mock/generate` 端點觸發 Mock 假資料產生

**Commit:** `feat: 實作外部系統同步 API + 名稱比對邏輯`

---

## Phase 5: 車趟管理

### Task 18: 車趟 CRUD

**Files:**
- Create: `backend/src/routes/trips.ts`
- Create: `backend/src/__tests__/trips.test.ts`

注意：
- GET 列表支援篩選：`?customerId=1&siteId=1&dateFrom=2026-01-01&dateTo=2026-01-31`
- GET 詳情包含 `include: { items: { include: { item: true } }, customer: true, site: true }`
- POST 建立時記錄 `source: 'manual'`

**Commit:** `feat: 實作車趟 CRUD API + 測試`

---

### Task 19: 車趟品項（快照邏輯）

**Files:**
- 新增於 `backend/src/routes/trips.ts`
- Create: `backend/src/__tests__/trip-items.test.ts`

**核心邏輯（快照設計）：**

```typescript
// POST /api/trips/:id/items
// 簽約客戶：自動帶入合約價
async function createTripItem(tripId: number, itemId: number, quantity: number, manualPrice?: number, manualDirection?: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { customer: { include: { contracts: { where: { status: 'active' }, include: { items: true } } } } } })

  let unitPrice: number
  let billingDirection: string
  let unit: string

  const item = await prisma.item.findUnique({ where: { id: itemId } })
  unit = item!.unit

  if (trip!.customer.type === 'contracted') {
    // 簽約客戶：從有效合約找品項定價
    const contractItem = trip!.customer.contracts
      .flatMap(c => c.items)
      .find(ci => ci.itemId === itemId)

    if (contractItem) {
      // 有合約品項：自動帶入合約價
      unitPrice = Number(contractItem.unitPrice)
      billingDirection = contractItem.billingDirection
    } else {
      // 合約到期或合約中無此品項：降級為手動輸入模式（等同臨時客戶）
      // UI 提示：「此客戶目前無有效合約（或合約中無此品項），請手動輸入單價和費用方向」
      // 不阻止建立車趟品項，確保業務不中斷
      if (manualPrice === undefined || !manualDirection) {
        throw new Error('此客戶目前無有效合約或合約中無此品項，請手動輸入單價和費用方向')
      }
      unitPrice = manualPrice
      billingDirection = manualDirection
    }
  } else {
    // 臨時客戶：手動輸入
    if (manualPrice === undefined || !manualDirection) throw new Error('臨時客戶須手動輸入單價和方向')
    unitPrice = manualPrice
    billingDirection = manualDirection
  }

  const amount = unitPrice * Number(quantity)

  return prisma.tripItem.create({
    data: { tripId, itemId, quantity, unit, unitPrice, billingDirection, amount },
  })
}
```

**Commit:** `feat: 實作車趟品項 CRUD + 合約價快照邏輯 + 測試`

---

---

## Phase 6: 計費引擎與月結

### Task 21: 假日服務（工作日計算）

**Files:**
- Create: `backend/src/services/holiday.service.ts`
- Create: `backend/src/__tests__/holiday.service.test.ts`

```typescript
// 核心函數
async function getWorkday(targetDate: Date): Promise<Date> {
  // while targetDate 是週六日或國定假日: targetDate -= 1 天
}

async function isHoliday(date: Date): Promise<boolean> {
  // 檢查週六日 + holidays 表
}
```

**測試案例：**
- 一般工作日 → 回傳原日期
- 週六 → 往前推到週五
- 週日 → 往前推到週五
- 國定假日 → 往前推到前一工作日
- 連假（如春節）→ 往前推到連假前的工作日

**Commit:** `feat: 實作假日服務（工作日計算邏輯 + 測試）`

---

### Task 22: 計費引擎（核心計算）

**Files:**
- Create: `backend/src/services/billing.service.ts`
- Create: `backend/src/__tests__/billing.service.test.ts`

依設計文件第 6 章完整實作：

```typescript
interface BillingResult {
  itemReceivable: number           // 品項應收小計
  itemPayable: number              // 品項應付小計
  tripFeeTotal: number             // 車趟費合計（固定應收）
  additionalFeeReceivable: number  // 應收附加費用合計
  additionalFeePayable: number     // 應付附加費用合計
  totalReceivable: number          // 應收合計 = 品項應收 + 車趟費 + 應收附加費用
  totalPayable: number             // 應付合計 = 品項應付 + 應付附加費用
  netAmount: number                // 淨額 = 應收合計 - 應付合計
  subtotal: number                 // 小計（淨額模式）
  taxAmount: number                // 稅額（5%）
  totalAmount: number              // 總額
  // 分開開票（invoice_type=separate 時有值）
  receivableSubtotal?: number
  receivableTax?: number
  receivableTotal?: number
  payableSubtotal?: number
  payableTax?: number
  payableTotal?: number
  // 明細
  additionalFees: { name: string; amount: number; direction: string }[]
  details: {
    items: TripItemDetail[]
    tripFee: { count: number; amount: number; type: string }
    fees: AdditionalFeeDetail[]
  }
}

async function calculateMonthlyBilling(customerId: number, yearMonth: string): Promise<BillingResult>
async function calculateTripBilling(tripId: number): Promise<BillingResult>
```

**計算步驟：**
1. 查詢 trip_items → 依 billingDirection 分組加總
2. 車趟費：依 customer 設定計算
3. 附加費用：查 customer_fees (active)，依 frequency 計算
4. 彙總：應收合計 / 應付合計 / 淨額
5. 稅額：依 invoiceType (net/separate) 計算 5%

**測試案例（至少 8 個）：**
- 純應收客戶
- 純應付客戶
- 混合方向客戶
- 有車趟費（按次）
- 有車趟費（按月）
- 有附加費用（按月+按趟混合）
- 淨額開票 vs 分開開票
- 無車趟的月份（金額為 0）

**Commit:** `feat: 實作計費引擎（應收/應付/車趟費/附加費用/稅額）+ 測試`

---

### Task 23: 月結明細產出

**Files:**
- Create: `backend/src/services/statement.service.ts`
- Create: `backend/src/__tests__/statement.service.test.ts`

```typescript
// 產出所有月結客戶的明細（每月 5 號呼叫）
async function generateMonthlyStatements(yearMonth: string): Promise<{ created: number; errors: string[] }>

// 產出單一客戶月結
async function generateCustomerStatement(customerId: number, yearMonth: string): Promise<Statement>
```

- 查詢所有 `statementType = 'monthly'` 且 `status = 'active'` 的客戶
- 呼叫 billing.service 計算
- 建立 Statement (draft)
- detailJson 存完整明細

**Commit:** `feat: 實作月結明細自動產出服務 + 測試`

---

### Task 24: 按趟明細產出

在 `statement.service.ts` 新增：

```typescript
async function generateTripStatement(tripId: number): Promise<Statement>
```

- 查詢 trip 所屬客戶的 `statementType`
- 如果是 `per_trip`，自動產出單趟明細

**Commit:** `feat: 實作按趟明細產出 + 測試`

---

### Task 25: 月結 API + 審核流程

**Files:**
- Create: `backend/src/routes/statements.ts`
- Create: `backend/src/__tests__/statements.test.ts`

端點：
- `GET /api/statements` — 列表（篩選 yearMonth, status, customerId）
- `GET /api/statements/:id` — 詳情
- `POST /api/statements/generate` — 手動觸發月結產出
- `PATCH /api/statements/:id/review` — 審核（body: `{ action: 'approve' | 'reject' }`）
- `PATCH /api/statements/:id/invoice` — 標記已開票
- `POST /api/statements/:id/send` — 寄送

狀態流轉：
- 需開票：`draft → approved → invoiced → sent`
- 不需開票：`draft → approved → sent`
- 退回：`approved → rejected → (修正後) draft → approved`

**Commit:** `feat: 實作月結 API + 審核流程 + 測試`

---

## Phase 7: 報表與通知

### Task 26: PDF 報表產出

**Files:**
- Create: `backend/src/services/pdf-generator.ts`
- Create: `backend/src/__tests__/pdf-generator.test.ts`

依設計文件第 9 章 PDF 範例格式，使用 `pdfkit` 產出：
- 公司標頭
- 客戶資訊
- 收運明細表格
- 車趟費
- 附加費用
- 彙總（應收/應付/淨額/稅額/總額）
- 匯款帳戶

端點：`GET /api/reports/customers/:customerId?yearMonth=2026-01` → 回傳 PDF buffer

**Commit:** `feat: 實作客戶月結明細 PDF 產出`

---

### Task 27: Excel 站區彙總報表

**Files:**
- Create: `backend/src/services/excel-report.service.ts`

依設計文件第 9 章，使用 `exceljs` 產出：
- 工作表一：客戶總額（客戶名稱、類型、應收、應付、車趟費、附加費用、淨額、稅額、總額）
- 工作表二：品項彙總（品項、單位、總數量、應收金額、應付金額、淨額）

端點：`GET /api/reports/sites/:siteId?yearMonth=2026-01` → 回傳 Excel buffer

**Commit:** `feat: 實作站區彙總報表 Excel 產出`

---

### Task 28: Email 通知服務

**Files:**
- Create: `backend/src/services/notification.service.ts`

使用 `nodemailer` 實作：
- `sendStatementEmail(statementId)` — 寄送明細 PDF 給客戶
- `sendContractExpiryReminder(contractId, daysLeft)` — 合約到期提醒
- `sendFailureReport(failures)` — 寄送失敗報告給管理員

LINE 介面預留但不實作。

**Commit:** `feat: 實作 Email 通知服務（明細寄送 + 到期提醒）`

---

### Task 29: 排程服務

**Files:**
- Create: `backend/src/services/scheduler.service.ts`
- Create: `backend/src/routes/schedule.ts`

使用 `node-cron` 設定：
- 每月 5 號 09:00 → 月結明細產出（先算工作日）
- 每日 09:00 → 檢查寄送日 + 自動寄送
- 每日 09:00 → 通知重試
- 每日 10:00 → 合約到期掃描

API：
- `GET /api/schedule` — 排程狀態
- `POST /api/schedule/:name/trigger` — 手動觸發

**Commit:** `feat: 實作排程服務（月結/寄送/到期/重試）`

---

## Phase 8: 前端

### Task 30: 前端專案初始化

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install antd @ant-design/icons @tanstack/react-query axios react-router-dom dayjs
npm install -D @types/react @types/react-dom
```

建立基礎結構：
- `src/api/client.ts` — Axios instance（自動帶 token）
- `src/contexts/AuthContext.tsx` — 認證上下文
- `src/hooks/useResponsive.ts` — 響應式斷點 Hook（isMobile/isTablet/isDesktop）
- `src/components/AppLayout.tsx` — Ant Design 響應式側邊欄佈局（桌面 Sider / 行動裝置 Drawer）
- `src/App.tsx` — 路由設定

注意：AppLayout 需實作 RWD 三段式斷點（≥992px 桌面、768~991px 平板、<768px 手機），依設計文件使用 Ant Design 標準斷點（lg/md），所有後續頁面 Task 都需配合 useResponsive 處理響應式佈局。

**Commit:** `feat: 初始化前端專案（React + Ant Design + React Query + RWD 基礎）`

---

### Task 31: 登入頁 + 認證流程

- `src/pages/LoginPage.tsx`
- localStorage 存 token
- ProtectedRoute 元件
- 登入後跳轉儀表板

**Commit:** `feat: 實作登入頁和認證流程`

---

### Task 32: 儀表板

- `src/pages/DashboardPage.tsx`
- 依設計文件第 10 章 UI 佈局
- 卡片：本月車趟、應收總額、應付總額、客戶數
- 待處理事項列表
- 合約到期提醒列表

**Commit:** `feat: 實作儀表板頁面`

---

### Task 33: 基礎資料頁面（站區/品項/使用者/假日）

- `src/pages/SitesPage.tsx`
- `src/pages/ItemsPage.tsx`
- `src/pages/UsersPage.tsx`
- `src/pages/HolidaysPage.tsx`

每頁標準 Ant Design Table + Modal CRUD。

**Commit:** `feat: 實作基礎資料管理頁面（站區/品項/使用者/假日）`

---

### Task 34: 客戶管理

- `src/pages/CustomersPage.tsx` — 客戶列表 + 篩選
- 客戶編輯 Modal/Drawer（含所有設定欄位）
- 附加費用子區塊（依設計文件 UI 範例）

**Commit:** `feat: 實作客戶管理頁面（含附加費用）`

---

### Task 35: 合約管理

- `src/pages/ContractsPage.tsx`
- 合約列表 + CRUD
- 合約品項子表格（品項+單價+方向）

**Commit:** `feat: 實作合約管理頁面（含品項定價）`

---

### Task 36: 車趟管理

- `src/pages/TripsPage.tsx` — 車趟列表 + 品項明細展開

**Commit:** `feat: 實作車趟管理頁面`

---

### Task 36.5: 外部系統同步頁面

- `src/pages/SyncPage.tsx`
- 手動觸發 POS/車機同步按鈕
- 同步結果顯示（成功/失敗筆數）
- Mock 假資料產生按鈕（僅 mock 模式顯示）
- Adapter 連線模式狀態顯示

**Commit:** `feat: 實作外部系統同步管理頁面`

---

### Task 37: 月結管理 + 審核

- `src/pages/StatementsPage.tsx`
- 依設計文件 UI：Tab 切換狀態（待審核/已審核/已開票/已寄送/退回）
- 審核詳情展開（品項明細 + 車趟費 + 附加費用 + 彙總）
- 審核通過/退回按鈕
- 標記已開票按鈕（僅已審核狀態可操作）
- 全部審核通過按鈕

**Commit:** `feat: 實作月結管理 + 審核流程頁面`

---

### Task 38: 報表 + 排程管理

- `src/pages/ReportsPage.tsx` — PDF 下載 + Excel 下載
- `src/pages/SchedulePage.tsx` — 排程狀態 + 手動觸發

**Commit:** `feat: 實作報表下載 + 排程管理頁面`

---

## Phase 9: 整合驗證

### Task 39: 端對端驗證

依設計文件第 12 章驗收標準，逐項驗證：

1. 基礎資料 CRUD（6 項）
2. 合約與計費（3 項）
3. 車趟與品項（5 項）
4. 月結流程（8 項）
5. 報表（3 項）
6. 系統管理（5 項）
7. 外部系統整合（8 項）

修正任何發現的問題。

**Commit:** `fix: 修正整合驗證發現的問題`

---

### Task 40: 最終清理

- 確認所有測試通過：`cd backend && npm test`
- 確認前後端可正常啟動和互動
- 確認 .env.example 檔案完整
- 更新設計文件狀態為「實作完成」

**Commit:** `chore: 最終清理與驗證`

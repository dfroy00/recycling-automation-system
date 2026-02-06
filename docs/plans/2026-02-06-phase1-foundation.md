# 階段一：基礎建設 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立環保回收業務自動化系統的基礎架構，包含專案骨架、資料庫結構、身份驗證系統與前端登入頁面

**Architecture:** 前後端分離架構。後端使用 Express.js + TypeScript + Prisma ORM，前端使用 React + Vite + Ant Design。PostgreSQL 透過 Docker Compose 運行。身份驗證採用 JWT Token + bcrypt 密碼加密 + RBAC 角色授權。

**Tech Stack:** Node.js 20, TypeScript, Express.js, Prisma, PostgreSQL 16, Docker Compose, Vitest, Supertest, React 18, Vite, Ant Design 5.x, React Router v6, Axios

**參考文件:** `docs/plans/2026-02-06-recycling-automation-system-design.md`

---

### Task 1: Backend 專案初始化

**Files:**
- Create: `.gitignore`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`

**Step 1: 建立 .gitignore**

```gitignore
# .gitignore（專案根目錄）
node_modules/
dist/
.env
*.log
uploads/
*.pdf
coverage/
.DS_Store
Thumbs.db
```

**Step 2: 初始化 backend 專案並安裝依賴**

Run:
```bash
mkdir backend
cd backend
npm init -y
npm install express cors helmet dotenv
npm install -D typescript @types/node @types/express @types/cors tsx
```

**Step 3: 建立 tsconfig.json**

```jsonc
// backend/tsconfig.json
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
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: 建立 Express 應用（app.ts）**

```typescript
// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

const app = express()

// 中介層
app.use(helmet())
app.use(cors())
app.use(express.json())

// 健康檢查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
```

**Step 5: 建立伺服器入口（index.ts）**

```typescript
// backend/src/index.ts
import dotenv from 'dotenv'
dotenv.config()

import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`)
})
```

**Step 6: 在 package.json 加入 scripts**

在 `backend/package.json` 的 `"scripts"` 中加入：

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 7: 驗證伺服器可啟動**

Run: `cd backend && npx tsx src/index.ts`
Expected: 終端顯示 `伺服器啟動於 http://localhost:3000`

在另一個終端測試：
Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok","timestamp":"..."}`

停止伺服器（Ctrl+C）。

**Step 8: Commit**

```bash
git add .gitignore backend/package.json backend/package-lock.json backend/tsconfig.json backend/src/app.ts backend/src/index.ts
git commit -m "feat: 初始化 backend 專案 (Express + TypeScript)"
```

---

### Task 2: Docker Compose 與環境設定

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env`

**Step 1: 建立 docker-compose.yml**

```yaml
# docker-compose.yml（專案根目錄）
version: '3.8'
services:
  postgres:
    image: postgres:16
    container_name: recycle-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-recycle_db}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres123}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: 建立 .env.example 與 .env**

```bash
# .env.example（專案根目錄，提交到 Git）
# 資料庫
POSTGRES_DB=recycle_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
DB_PORT=5432
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/recycle_db

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=8h

# 伺服器
PORT=3000
```

複製 `.env.example` 為 `.env`，並填入實際密碼：

```bash
# .env（不提交到 Git）
POSTGRES_DB=recycle_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
DB_PORT=5432
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/recycle_db

JWT_SECRET=recycling-system-jwt-secret-2026
JWT_EXPIRES_IN=8h

PORT=3000
```

**Step 3: 啟動 PostgreSQL 容器並驗證**

Run: `docker compose up -d`
Expected: PostgreSQL 容器啟動成功

Run: `docker compose ps`
Expected: `recycle-db` 狀態為 `running`

Run: `docker compose exec postgres psql -U postgres -d recycle_db -c "SELECT 1"`
Expected: 回傳 `1`，代表資料庫連線成功

**Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: 新增 Docker Compose 設定 (PostgreSQL 16)"
```

---

### Task 3: Prisma Schema 定義

**Files:**
- Create: `backend/prisma/schema.prisma`
- Modify: `backend/package.json`（加入 prisma 相關 scripts）

**Step 1: 安裝 Prisma**

Run:
```bash
cd backend
npm install prisma @prisma/client
npx prisma init
```

這會建立 `backend/prisma/schema.prisma` 和更新 `.env`。

**Step 2: 撰寫完整 Prisma Schema**

覆寫 `backend/prisma/schema.prisma`，根據設計文檔定義所有資料表：

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================
// 站點主檔表
// ============================
model Site {
  siteId       String   @id @map("site_id") @db.VarChar(20)
  siteName     String   @map("site_name") @db.VarChar(100)
  manager      String?  @db.VarChar(50)
  contactPhone String?  @map("contact_phone") @db.VarChar(20)
  contactEmail String?  @map("contact_email") @db.VarChar(100)
  status       String   @default("啟用") @db.VarChar(10)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  customers         Customer[]
  trips             Trip[]
  itemsCollected    ItemCollected[]
  monthlyStatements MonthlyStatement[]
  systemLogs        SystemLog[]
  users             User[]

  @@map("sites")
}

// ============================
// 客戶主檔表
// ============================
model Customer {
  customerId         String   @id @map("customer_id") @db.VarChar(20)
  siteId             String   @map("site_id") @db.VarChar(20)
  customerName       String   @map("customer_name") @db.VarChar(100)
  billingType        String   @map("billing_type") @db.Char(1) // A/B/C/D
  tripPrice          Decimal? @map("trip_price") @db.Decimal(10, 2)
  notificationMethod String   @default("Email") @map("notification_method") @db.VarChar(10)
  lineId             String?  @map("line_id") @db.VarChar(100)
  email              String?  @db.VarChar(100)
  status             String   @default("啟用") @db.VarChar(10)
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  site              Site              @relation(fields: [siteId], references: [siteId])
  contractPrices    ContractPrice[]
  trips             Trip[]
  itemsCollected    ItemCollected[]
  monthlyStatements MonthlyStatement[]

  @@index([siteId], name: "idx_customer_site_id")
  @@index([billingType], name: "idx_customer_billing_type")
  @@map("customers")
}

// ============================
// 合約品項單價表（C 類客戶用）
// ============================
model ContractPrice {
  contractPriceId Int      @id @default(autoincrement()) @map("contract_price_id")
  customerId      String   @map("customer_id") @db.VarChar(20)
  itemName        String   @map("item_name") @db.VarChar(100)
  contractPrice   Decimal  @map("contract_price") @db.Decimal(10, 2)
  startDate       DateTime @map("start_date") @db.Date
  endDate         DateTime @map("end_date") @db.Date
  createdAt       DateTime @default(now()) @map("created_at")

  customer Customer @relation(fields: [customerId], references: [customerId])

  @@index([customerId, itemName], name: "idx_contract_customer_item")
  @@index([endDate], name: "idx_contract_end_date")
  @@map("contract_prices")
}

// ============================
// 品項標準單價表（牌價）
// ============================
model ItemPrice {
  itemPriceId   Int       @id @default(autoincrement()) @map("item_price_id")
  itemName      String    @map("item_name") @db.VarChar(100)
  standardPrice Decimal   @map("standard_price") @db.Decimal(10, 2)
  effectiveDate DateTime  @map("effective_date") @db.Date
  expiryDate    DateTime? @map("expiry_date") @db.Date
  createdAt     DateTime  @default(now()) @map("created_at")

  @@index([itemName, effectiveDate, expiryDate], name: "idx_item_effective")
  @@map("item_prices")
}

// ============================
// 車趟記錄表
// ============================
model Trip {
  tripId       Int      @id @default(autoincrement()) @map("trip_id")
  siteId       String   @map("site_id") @db.VarChar(20)
  customerId   String   @map("customer_id") @db.VarChar(20)
  tripDate     DateTime @map("trip_date") @db.Date
  tripTime     DateTime @map("trip_time") @db.Time()
  driver       String   @db.VarChar(50)
  vehiclePlate String   @map("vehicle_plate") @db.VarChar(20)
  importedAt   DateTime @default(now()) @map("imported_at")
  sourceFile   String?  @map("source_file") @db.VarChar(200)

  site     Site     @relation(fields: [siteId], references: [siteId])
  customer Customer @relation(fields: [customerId], references: [customerId])

  @@index([customerId, tripDate], name: "idx_trip_customer_date")
  @@index([siteId, tripDate], name: "idx_trip_site_date")
  @@map("trips")
}

// ============================
// 品項收取記錄表
// ============================
model ItemCollected {
  collectionId   Int      @id @default(autoincrement()) @map("collection_id")
  siteId         String   @map("site_id") @db.VarChar(20)
  customerId     String   @map("customer_id") @db.VarChar(20)
  collectionDate DateTime @map("collection_date") @db.Date
  itemName       String   @map("item_name") @db.VarChar(100)
  weightKg       Decimal  @map("weight_kg") @db.Decimal(10, 2)
  importedAt     DateTime @default(now()) @map("imported_at")
  sourceFile     String?  @map("source_file") @db.VarChar(200)

  site     Site     @relation(fields: [siteId], references: [siteId])
  customer Customer @relation(fields: [customerId], references: [customerId])

  @@index([customerId, collectionDate], name: "idx_collected_customer_date")
  @@index([itemName, collectionDate], name: "idx_collected_item_date")
  @@map("items_collected")
}

// ============================
// 月結明細表
// ============================
model MonthlyStatement {
  statementId Int       @id @default(autoincrement()) @map("statement_id")
  siteId      String    @map("site_id") @db.VarChar(20)
  customerId  String    @map("customer_id") @db.VarChar(20)
  yearMonth   String    @map("year_month") @db.VarChar(7) // YYYY-MM
  totalAmount Decimal   @map("total_amount") @db.Decimal(12, 2)
  detailJson  Json      @map("detail_json")
  generatedAt DateTime  @default(now()) @map("generated_at")
  sentAt      DateTime? @map("sent_at")
  sendStatus  String    @default("pending") @map("send_status") @db.VarChar(20)
  pdfPath     String?   @map("pdf_path") @db.VarChar(200)

  site     Site     @relation(fields: [siteId], references: [siteId])
  customer Customer @relation(fields: [customerId], references: [customerId])

  @@index([yearMonth], name: "idx_statement_year_month")
  @@index([sendStatus], name: "idx_statement_send_status")
  @@map("monthly_statements")
}

// ============================
// 系統日誌表
// ============================
model SystemLog {
  logId        Int      @id @default(autoincrement()) @map("log_id")
  siteId       String?  @map("site_id") @db.VarChar(20)
  eventType    String   @map("event_type") @db.VarChar(50)
  eventContent String   @map("event_content") @db.Text
  createdAt    DateTime @default(now()) @map("created_at")

  site Site? @relation(fields: [siteId], references: [siteId])

  @@index([eventType, createdAt], name: "idx_log_event_time")
  @@map("system_logs")
}

// ============================
// 使用者表（設計文檔未列出，身份驗證需要）
// ============================
model User {
  userId    Int      @id @default(autoincrement()) @map("user_id")
  username  String   @unique @db.VarChar(50)
  password  String   @db.VarChar(200) // bcrypt hash
  name      String   @db.VarChar(50)
  role      String   @db.VarChar(20) // system_admin / site_admin / finance / sales
  siteId    String?  @map("site_id") @db.VarChar(20)
  email     String?  @db.VarChar(100)
  status    String   @default("啟用") @db.VarChar(10)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  site Site? @relation(fields: [siteId], references: [siteId])

  @@index([role], name: "idx_user_role")
  @@map("users")
}
```

**Step 3: 執行資料庫遷移**

Run:
```bash
cd backend
npx prisma migrate dev --name init
```

Expected: 遷移成功，顯示 `Your database is now in sync with your schema.`

**Step 4: 驗證資料表已建立**

Run:
```bash
docker compose exec postgres psql -U postgres -d recycle_db -c "\dt"
```

Expected: 列出 `sites`, `customers`, `contract_prices`, `item_prices`, `trips`, `items_collected`, `monthly_statements`, `system_logs`, `users` 等資料表

**Step 5: Commit**

```bash
cd backend
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: 新增 Prisma Schema 定義所有資料表"
```

---

### Task 4: Prisma Client 與資料庫連線

**Files:**
- Create: `backend/src/lib/prisma.ts`

**Step 1: 建立 Prisma Client 單例**

```typescript
// backend/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// 避免開發時 hot-reload 產生多個連線
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Step 2: 在 app.ts 匯入並測試連線**

在 `backend/src/app.ts` 的健康檢查端點加入資料庫連線狀態：

```typescript
// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { prisma } from './lib/prisma'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

// 健康檢查（含資料庫連線狀態）
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() })
  }
})

export default app
```

**Step 3: 驗證資料庫連線**

Run: `cd backend && npx tsx src/index.ts`

在另一個終端：
Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok","database":"connected","timestamp":"..."}`

停止伺服器。

**Step 4: Commit**

```bash
git add backend/src/lib/prisma.ts backend/src/app.ts
git commit -m "feat: 新增 Prisma Client 單例與資料庫健康檢查"
```

---

### Task 5: Seed 測試資料

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json`（加入 prisma seed 設定）

**Step 1: 撰寫 Seed 腳本**

```typescript
// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('開始填入測試資料...')

  // 1. 建立站點
  const sites = [
    { siteId: 'S001', siteName: '台北站', manager: '張三', contactPhone: '02-1234-5678', contactEmail: 'taipei@example.com' },
    { siteId: 'S002', siteName: '新北站', manager: '李四', contactPhone: '02-2345-6789', contactEmail: 'newtaipei@example.com' },
    { siteId: 'S003', siteName: '桃園站', manager: '王五', contactPhone: '03-3456-7890', contactEmail: 'taoyuan@example.com' },
    { siteId: 'S004', siteName: '台中站', manager: '趙六', contactPhone: '04-4567-8901', contactEmail: 'taichung@example.com' },
    { siteId: 'S005', siteName: '台南站', manager: '孫七', contactPhone: '06-5678-9012', contactEmail: 'tainan@example.com' },
    { siteId: 'S006', siteName: '高雄站', manager: '周八', contactPhone: '07-6789-0123', contactEmail: 'kaohsiung@example.com' },
    { siteId: 'S007', siteName: '新竹站', manager: '吳九', contactPhone: '03-7890-1234', contactEmail: 'hsinchu@example.com' },
  ]

  for (const site of sites) {
    await prisma.site.upsert({
      where: { siteId: site.siteId },
      update: site,
      create: site,
    })
  }
  console.log(`已建立 ${sites.length} 個站點`)

  // 2. 建立品項標準單價
  const itemPrices = [
    { itemName: '紙類', standardPrice: 5.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '塑膠', standardPrice: 3.5, effectiveDate: new Date('2026-01-01') },
    { itemName: '金屬', standardPrice: 8.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '鋁罐', standardPrice: 35.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '鐵罐', standardPrice: 12.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '玻璃', standardPrice: 1.5, effectiveDate: new Date('2026-01-01') },
    { itemName: '寶特瓶', standardPrice: 15.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '廢紙箱', standardPrice: 4.0, effectiveDate: new Date('2026-01-01') },
  ]

  // 先清除舊資料再插入
  await prisma.itemPrice.deleteMany()
  for (const item of itemPrices) {
    await prisma.itemPrice.create({
      data: {
        itemName: item.itemName,
        standardPrice: item.standardPrice,
        effectiveDate: item.effectiveDate,
      },
    })
  }
  console.log(`已建立 ${itemPrices.length} 個品項牌價`)

  // 3. 建立範例客戶（每種類型各一個）
  const customers = [
    { customerId: 'C001', siteId: 'S001', customerName: 'ABC 科技股份有限公司', billingType: 'A', tripPrice: 300, notificationMethod: 'Email', email: 'abc@example.com' },
    { customerId: 'C002', siteId: 'S001', customerName: 'XYZ 物流有限公司', billingType: 'B', tripPrice: 500, notificationMethod: 'LINE', lineId: 'U1234567890' },
    { customerId: 'C003', siteId: 'S002', customerName: '大成製造股份有限公司', billingType: 'C', tripPrice: null, notificationMethod: 'Both', lineId: 'U9876543210', email: 'dacheng@example.com' },
    { customerId: 'C004', siteId: 'S002', customerName: '小明商行', billingType: 'D', tripPrice: null, notificationMethod: 'Email', email: 'xiaoming@example.com' },
  ]

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { customerId: customer.customerId },
      update: customer,
      create: customer,
    })
  }
  console.log(`已建立 ${customers.length} 個客戶`)

  // 4. 建立 C 類客戶合約品項
  await prisma.contractPrice.deleteMany()
  const contracts = [
    { customerId: 'C003', itemName: '紙類', contractPrice: 4.5, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
    { customerId: 'C003', itemName: '塑膠', contractPrice: 3.0, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
  ]

  for (const contract of contracts) {
    await prisma.contractPrice.create({ data: contract })
  }
  console.log(`已建立 ${contracts.length} 筆合約品項`)

  // 5. 建立系統管理員帳號
  const adminPassword = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: '系統管理員',
      role: 'system_admin',
      email: 'admin@example.com',
    },
  })
  console.log('已建立系統管理員帳號 (admin / admin123)')

  console.log('測試資料填入完成！')
}

main()
  .catch((e) => {
    console.error('Seed 失敗:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: 安裝 bcrypt 並設定 prisma seed**

Run:
```bash
cd backend
npm install bcrypt
npm install -D @types/bcrypt
```

在 `backend/package.json` 加入 prisma seed 設定：

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Step 3: 執行 Seed**

Run:
```bash
cd backend
npx prisma db seed
```

Expected:
```
開始填入測試資料...
已建立 7 個站點
已建立 8 個品項牌價
已建立 4 個客戶
已建立 2 筆合約品項
已建立系統管理員帳號 (admin / admin123)
測試資料填入完成！
```

**Step 4: 驗證資料已寫入**

Run:
```bash
docker compose exec postgres psql -U postgres -d recycle_db -c "SELECT site_id, site_name FROM sites"
```
Expected: 顯示 7 個站點

Run:
```bash
docker compose exec postgres psql -U postgres -d recycle_db -c "SELECT username, role FROM users"
```
Expected: 顯示 admin / system_admin

**Step 5: Commit**

```bash
git add backend/prisma/seed.ts backend/package.json backend/package-lock.json
git commit -m "feat: 新增 Seed 腳本填入站點、品項、客戶與管理員測試資料"
```

---

### Task 6: 測試基礎設施

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/tests/setup.ts`
- Create: `backend/tests/health.test.ts`
- Modify: `backend/package.json`（加入 test script）

**Step 1: 安裝測試依賴**

Run:
```bash
cd backend
npm install -D vitest supertest @types/supertest
```

**Step 2: 建立 Vitest 設定**

```typescript
// backend/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
  },
})
```

**Step 3: 建立測試 setup**

```typescript
// backend/tests/setup.ts
import { prisma } from '../src/lib/prisma'
import { afterAll } from 'vitest'

// 測試結束後斷開資料庫連線
afterAll(async () => {
  await prisma.$disconnect()
})
```

**Step 4: 撰寫健康檢查測試**

```typescript
// backend/tests/health.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app'

describe('GET /api/health', () => {
  it('應回傳 ok 狀態與資料庫連線狀態', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.database).toBe('connected')
    expect(res.body.timestamp).toBeDefined()
  })
})
```

**Step 5: 在 package.json 加入 test script**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 6: 執行測試並驗證通過**

Run: `cd backend && npm test`
Expected: 1 test passed

**Step 7: Commit**

```bash
git add backend/vitest.config.ts backend/tests/setup.ts backend/tests/health.test.ts backend/package.json backend/package-lock.json
git commit -m "feat: 建立測試基礎設施 (Vitest + Supertest)"
```

---

### Task 7: Auth Service - 密碼雜湊與 JWT

**Files:**
- Create: `backend/tests/auth.service.test.ts`
- Create: `backend/src/services/auth.service.ts`

**Step 1: 撰寫 Auth Service 失敗測試**

```typescript
// backend/tests/auth.service.test.ts
import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword, generateToken, verifyToken } from '../src/services/auth.service'

describe('Auth Service', () => {
  describe('密碼雜湊', () => {
    it('應成功雜湊密碼', async () => {
      const hash = await hashPassword('test123')
      expect(hash).toBeDefined()
      expect(hash).not.toBe('test123')
    })

    it('應正確比對密碼', async () => {
      const hash = await hashPassword('test123')
      const match = await comparePassword('test123', hash)
      expect(match).toBe(true)
    })

    it('應拒絕錯誤密碼', async () => {
      const hash = await hashPassword('test123')
      const match = await comparePassword('wrong', hash)
      expect(match).toBe(false)
    })
  })

  describe('JWT Token', () => {
    it('應產生有效 Token', () => {
      const token = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('應正確解析 Token', () => {
      const payload = { userId: 1, username: 'admin', role: 'system_admin' }
      const token = generateToken(payload)
      const decoded = verifyToken(token)

      expect(decoded.userId).toBe(1)
      expect(decoded.username).toBe('admin')
      expect(decoded.role).toBe('system_admin')
    })

    it('應拒絕無效 Token', () => {
      expect(() => verifyToken('invalid-token')).toThrow()
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test`
Expected: FAIL - `Cannot find module '../src/services/auth.service'`

**Step 3: 安裝 JWT 依賴**

Run:
```bash
cd backend
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

**Step 4: 實作 Auth Service**

```typescript
// backend/src/services/auth.service.ts
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const SALT_ROUNDS = 12
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

export interface TokenPayload {
  userId: number
  username: string
  role: string
  siteId?: string | null
}

// 密碼雜湊
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// 密碼比對
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// 產生 JWT Token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// 驗證 JWT Token
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}
```

**Step 5: 執行測試驗證通過**

Run: `cd backend && npm test`
Expected: 所有 Auth Service 測試通過（5 tests passed）

**Step 6: Commit**

```bash
git add backend/src/services/auth.service.ts backend/tests/auth.service.test.ts backend/package.json backend/package-lock.json
git commit -m "feat: 實作 Auth Service (密碼雜湊 + JWT Token)"
```

---

### Task 8: Auth Routes - 註冊與登入 API

**Files:**
- Create: `backend/tests/auth.routes.test.ts`
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/app.ts`（掛載 auth 路由）

**Step 1: 撰寫 Auth Routes 失敗測試**

```typescript
// backend/tests/auth.routes.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/lib/prisma'

describe('Auth Routes', () => {
  // 測試前清除測試用的使用者
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'test_' } },
    })
  })

  describe('POST /api/auth/register', () => {
    it('應成功註冊新使用者', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_user1',
          password: 'password123',
          name: '測試使用者',
          role: 'site_admin',
          siteId: 'S001',
        })

      expect(res.status).toBe(201)
      expect(res.body.user.username).toBe('test_user1')
      expect(res.body.user.role).toBe('site_admin')
      expect(res.body.user.password).toBeUndefined() // 不回傳密碼
    })

    it('應拒絕重複的 username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_user1',
          password: 'password123',
          name: '重複使用者',
          role: 'site_admin',
        })

      expect(res.status).toBe(409)
      expect(res.body.message).toContain('已存在')
    })

    it('應拒絕缺少必填欄位', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'test_incomplete' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('應成功登入並回傳 Token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test_user1',
          password: 'password123',
        })

      expect(res.status).toBe(200)
      expect(res.body.token).toBeDefined()
      expect(res.body.user.username).toBe('test_user1')
      expect(res.body.user.password).toBeUndefined()
    })

    it('應拒絕錯誤密碼', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test_user1',
          password: 'wrong_password',
        })

      expect(res.status).toBe(401)
      expect(res.body.message).toContain('密碼錯誤')
    })

    it('應拒絕不存在的帳號', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        })

      expect(res.status).toBe(401)
      expect(res.body.message).toContain('不存在')
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test`
Expected: FAIL - `/api/auth/register` 回傳 404（路由尚未建立）

**Step 3: 實作 Auth 路由**

```typescript
// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { hashPassword, comparePassword, generateToken } from '../services/auth.service'

const router = Router()

// POST /api/auth/register - 註冊
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, name, role, siteId, email } = req.body

    // 驗證必填欄位
    if (!username || !password || !name || !role) {
      return res.status(400).json({ message: '缺少必填欄位：username, password, name, role' })
    }

    // 檢查 username 是否已存在
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return res.status(409).json({ message: `使用者 ${username} 已存在` })
    }

    // 建立使用者
    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role,
        siteId: siteId || null,
        email: email || null,
      },
    })

    // 回傳（排除密碼）
    const { password: _, ...userWithoutPassword } = user
    res.status(201).json({ user: userWithoutPassword })
  } catch (error) {
    console.error('註冊失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// POST /api/auth/login - 登入
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: '缺少 username 或 password' })
    }

    // 查詢使用者
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return res.status(401).json({ message: `帳號 ${username} 不存在` })
    }

    // 檢查帳號狀態
    if (user.status !== '啟用') {
      return res.status(403).json({ message: '帳號已停用' })
    }

    // 驗證密碼
    const isValid = await comparePassword(password, user.password)
    if (!isValid) {
      return res.status(401).json({ message: '密碼錯誤' })
    }

    // 產生 Token
    const token = generateToken({
      userId: user.userId,
      username: user.username,
      role: user.role,
      siteId: user.siteId,
    })

    // 回傳（排除密碼）
    const { password: _, ...userWithoutPassword } = user
    res.json({ token, user: userWithoutPassword })
  } catch (error) {
    console.error('登入失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router
```

**Step 4: 在 app.ts 掛載路由**

```typescript
// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { prisma } from './lib/prisma'
import authRouter from './routes/auth'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

// 健康檢查
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() })
  }
})

// 路由
app.use('/api/auth', authRouter)

export default app
```

**Step 5: 執行測試驗證通過**

Run: `cd backend && npm test`
Expected: 所有 Auth Routes 測試通過

**Step 6: Commit**

```bash
git add backend/src/routes/auth.ts backend/src/app.ts backend/tests/auth.routes.test.ts
git commit -m "feat: 實作 Auth Routes (註冊與登入 API)"
```

---

### Task 9: Auth Middleware - JWT 驗證與角色授權

**Files:**
- Create: `backend/tests/auth.middleware.test.ts`
- Create: `backend/src/middleware/auth.ts`

**Step 1: 撰寫 Auth Middleware 失敗測試**

```typescript
// backend/tests/auth.middleware.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authenticate, authorize } from '../src/middleware/auth'
import { generateToken } from '../src/services/auth.service'

// 建立測試用 Express app
function createTestApp() {
  const app = express()
  app.use(express.json())

  // 受保護的測試端點
  app.get('/protected', authenticate, (_req, res) => {
    res.json({ message: 'ok', user: (req as any).user })
  })

  // 需要特定角色的端點
  app.get('/admin-only', authenticate, authorize('system_admin'), (_req, res) => {
    res.json({ message: 'admin access granted' })
  })

  // 多角色端點
  app.get('/managers', authenticate, authorize('system_admin', 'site_admin'), (_req, res) => {
    res.json({ message: 'manager access granted' })
  })

  return app
}

describe('Auth Middleware', () => {
  let app: express.Express
  let validToken: string

  beforeAll(() => {
    app = createTestApp()
    validToken = generateToken({
      userId: 1,
      username: 'admin',
      role: 'system_admin',
    })
  })

  describe('authenticate', () => {
    it('應拒絕沒有 Token 的請求', async () => {
      const res = await request(app).get('/protected')
      expect(res.status).toBe(401)
      expect(res.body.message).toContain('未提供')
    })

    it('應拒絕無效 Token', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
      expect(res.body.message).toContain('無效')
    })

    it('應接受有效 Token', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
    })
  })

  describe('authorize', () => {
    it('應允許正確角色存取', async () => {
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
    })

    it('應拒絕錯誤角色存取', async () => {
      const siteToken = generateToken({
        userId: 2,
        username: 'site_user',
        role: 'finance',
      })

      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${siteToken}`)

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('權限不足')
    })

    it('應支援多角色驗證', async () => {
      const siteAdminToken = generateToken({
        userId: 3,
        username: 'site_admin',
        role: 'site_admin',
      })

      const res = await request(app)
        .get('/managers')
        .set('Authorization', `Bearer ${siteAdminToken}`)

      expect(res.status).toBe(200)
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test`
Expected: FAIL - `Cannot find module '../src/middleware/auth'`

**Step 3: 實作 Auth Middleware**

```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import { verifyToken, TokenPayload } from '../services/auth.service'

// 擴展 Express Request 型別
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

// JWT 驗證中介層
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未提供驗證 Token' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ message: '無效或過期的 Token' })
  }
}

// 角色授權中介層
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: '未驗證身份' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `權限不足，需要角色：${allowedRoles.join(' 或 ')}`,
      })
    }

    next()
  }
}
```

**Step 4: 修正測試中的 req 參考問題**

回到 `backend/tests/auth.middleware.test.ts`，修正 `createTestApp` 中的 `_req` → `req`：

```typescript
// 修正受保護的測試端點
app.get('/protected', authenticate, (req, res) => {
  res.json({ message: 'ok', user: req.user })
})
```

**Step 5: 執行測試驗證通過**

Run: `cd backend && npm test`
Expected: 所有 Auth Middleware 測試通過

**Step 6: Commit**

```bash
git add backend/src/middleware/auth.ts backend/tests/auth.middleware.test.ts
git commit -m "feat: 實作 Auth Middleware (JWT 驗證 + RBAC 角色授權)"
```

---

### Task 10: 受保護的 API 端點範例

**Files:**
- Create: `backend/tests/sites.routes.test.ts`
- Create: `backend/src/routes/sites.ts`
- Modify: `backend/src/app.ts`（掛載 sites 路由）

**Step 1: 撰寫 Sites Routes 失敗測試**

```typescript
// backend/tests/sites.routes.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { generateToken } from '../src/services/auth.service'

describe('Sites Routes', () => {
  let adminToken: string
  let financeToken: string

  beforeAll(() => {
    adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
    financeToken = generateToken({ userId: 2, username: 'finance', role: 'finance' })
  })

  describe('GET /api/sites', () => {
    it('應回傳站點清單（已驗證）', async () => {
      const res = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body[0]).toHaveProperty('siteId')
      expect(res.body[0]).toHaveProperty('siteName')
    })

    it('應拒絕未驗證的請求', async () => {
      const res = await request(app).get('/api/sites')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/sites', () => {
    it('應允許管理員新增站點', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          siteId: 'S099',
          siteName: '測試站',
          manager: '測試管理員',
        })

      expect(res.status).toBe(201)
      expect(res.body.siteId).toBe('S099')
    })

    it('應拒絕財務人員新增站點', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({
          siteId: 'S100',
          siteName: '不應被建立的站',
        })

      expect(res.status).toBe(403)
    })
  })
})
```

**Step 2: 執行測試驗證失敗**

Run: `cd backend && npm test`
Expected: FAIL - `/api/sites` 回傳 404

**Step 3: 實作 Sites 路由**

```typescript
// backend/src/routes/sites.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

// GET /api/sites - 取得站點清單
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { siteId: 'asc' },
    })
    res.json(sites)
  } catch (error) {
    console.error('查詢站點失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// POST /api/sites - 新增站點（僅系統管理員）
router.post('/', authenticate, authorize('system_admin'), async (req: Request, res: Response) => {
  try {
    const { siteId, siteName, manager, contactPhone, contactEmail } = req.body

    if (!siteId || !siteName) {
      return res.status(400).json({ message: '缺少必填欄位：siteId, siteName' })
    }

    const site = await prisma.site.create({
      data: { siteId, siteName, manager, contactPhone, contactEmail },
    })

    res.status(201).json(site)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: `站點 ${req.body.siteId} 已存在` })
    }
    console.error('新增站點失敗:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router
```

**Step 4: 在 app.ts 掛載 sites 路由**

在 `backend/src/app.ts` 加入：

```typescript
import sitesRouter from './routes/sites'

// 在路由區塊加入
app.use('/api/sites', sitesRouter)
```

**Step 5: 執行測試驗證通過**

Run: `cd backend && npm test`
Expected: 所有 Sites Routes 測試通過

**Step 6: 清理測試資料（刪除 S099）**

在 `backend/tests/sites.routes.test.ts` 的 `beforeAll` 加入清理邏輯：

```typescript
beforeAll(async () => {
  adminToken = generateToken({ userId: 1, username: 'admin', role: 'system_admin' })
  financeToken = generateToken({ userId: 2, username: 'finance', role: 'finance' })
  // 清理測試站點
  await prisma.site.deleteMany({ where: { siteId: { in: ['S099', 'S100'] } } })
})
```

記得在檔案頂部加入 `import { prisma } from '../src/lib/prisma'`。

**Step 7: Commit**

```bash
git add backend/src/routes/sites.ts backend/src/app.ts backend/tests/sites.routes.test.ts
git commit -m "feat: 實作 Sites CRUD API 搭配 JWT 驗證與 RBAC 授權"
```

---

### Task 11: Frontend 專案初始化

**Files:**
- Create: `frontend/` (透過 Vite 建立)
- Modify: `frontend/package.json`（安裝 Ant Design 等依賴）
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`

**Step 1: 使用 Vite 建立 React + TypeScript 專案**

Run:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: 安裝 UI 和路由依賴**

Run:
```bash
cd frontend
npm install antd @ant-design/icons react-router-dom axios dayjs
```

**Step 3: 清理預設檔案**

刪除 Vite 預設的 `src/App.css`、`src/index.css` 內容（保留檔案），刪除 `src/assets/react.svg`。

**Step 4: 建立基本 App 結構**

```typescript
// frontend/src/App.tsx
import { ConfigProvider } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import zhTW from 'antd/locale/zh_TW'

function App() {
  return (
    <ConfigProvider locale={zhTW}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<div>登入頁（待實作）</div>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
```

**Step 5: 驗證 Frontend 可啟動**

Run: `cd frontend && npm run dev -- --port 5173`
Expected: 瀏覽器開啟 `http://localhost:5173`，看到「登入頁（待實作）」

停止開發伺服器。

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: 初始化 Frontend 專案 (React + Vite + Ant Design + React Router)"
```

---

### Task 12: 登入頁面與身份驗證整合

**Files:**
- Create: `frontend/src/services/api.ts`
- Create: `frontend/src/services/auth.ts`
- Create: `frontend/src/contexts/AuthContext.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 建立 API 服務基底**

```typescript
// frontend/src/services/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// 請求攔截器：自動附加 JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 回應攔截器：處理 401 未授權
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

**Step 2: 建立 Auth API 服務**

```typescript
// frontend/src/services/auth.ts
import api from './api'

export interface LoginRequest {
  username: string
  password: string
}

export interface User {
  userId: number
  username: string
  name: string
  role: string
  siteId?: string | null
  email?: string | null
}

export interface LoginResponse {
  token: string
  user: User
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', data)
  return res.data
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await api.get('/health')
    return res.data.status === 'ok'
  } catch {
    return false
  }
}
```

**Step 3: 建立 Auth Context**

```typescript
// frontend/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { login as loginApi, type User, type LoginRequest } from '../services/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token')
  })

  const login = useCallback(async (data: LoginRequest) => {
    const result = await loginApi(data)
    localStorage.setItem('token', result.token)
    localStorage.setItem('user', JSON.stringify(result.user))
    setToken(result.token)
    setUser(result.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必須在 AuthProvider 內使用')
  }
  return context
}
```

**Step 4: 建立登入頁面**

```typescript
// frontend/src/pages/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, message, Space } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values)
      message.success('登入成功')
      navigate('/')
    } catch (error: any) {
      const msg = error.response?.data?.message || '登入失敗，請檢查帳號密碼'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f0f2f5',
    }}>
      <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>環保回收業務管理系統</Title>
            <Text type="secondary">請輸入帳號密碼登入</Text>
          </div>

          <Form
            name="login"
            onFinish={onFinish}
            size="large"
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '請輸入帳號' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="帳號" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '請輸入密碼' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密碼" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登入
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}
```

**Step 5: 建立 ProtectedRoute 與 Dashboard 佔位頁**

```typescript
// frontend/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: string[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
```

```typescript
// frontend/src/pages/DashboardPage.tsx
import { Button, Card, Typography } from 'antd'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={3}>儀表板</Title>
        <Text>歡迎，{user?.name}（{user?.role}）</Text>
        <br /><br />
        <Text type="secondary">系統功能開發中，請期待後續更新。</Text>
        <br /><br />
        <Button danger onClick={handleLogout}>登出</Button>
      </Card>
    </div>
  )
}
```

**Step 6: 更新 App.tsx 整合所有元件**

```typescript
// frontend/src/App.tsx
import { ConfigProvider } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import zhTW from 'antd/locale/zh_TW'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <ConfigProvider locale={zhTW}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
```

**Step 7: 建立 .env 設定 API URL**

```bash
# frontend/.env
VITE_API_URL=http://localhost:3000/api
```

**Step 8: 驗證前後端整合**

1. 啟動後端：`cd backend && npm run dev`
2. 啟動前端：`cd frontend && npm run dev -- --port 5173`
3. 開啟 `http://localhost:5173`
4. 應看到登入頁面
5. 用 `admin` / `admin123` 登入
6. 應跳轉到儀表板頁面，顯示「歡迎，系統管理員」
7. 點擊登出，應回到登入頁面

**Step 9: Commit**

```bash
git add frontend/src/services/ frontend/src/contexts/ frontend/src/pages/ frontend/src/components/ frontend/src/App.tsx frontend/.env
git commit -m "feat: 實作登入頁面與身份驗證整合 (JWT + AuthContext + ProtectedRoute)"
```

---

### Task 13: 後端 CORS 與錯誤處理完善

**Files:**
- Modify: `backend/src/app.ts`（CORS 設定與全域錯誤處理）

**Step 1: 更新 CORS 設定**

在 `backend/src/app.ts` 中更新 CORS 設定，允許前端存取：

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
```

**Step 2: 加入全域錯誤處理**

在 `backend/src/app.ts` 的所有路由之後加入：

```typescript
// 404 處理
app.use((_req, res) => {
  res.status(404).json({ message: '找不到該端點' })
})

// 全域錯誤處理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('未處理的錯誤:', err)
  res.status(500).json({ message: '伺服器內部錯誤' })
})
```

**Step 3: 在 .env 加入 CORS_ORIGIN**

在 `backend/.env`（若 Prisma init 建立了）或根目錄 `.env` 中加入：

```
CORS_ORIGIN=http://localhost:5173
```

**Step 4: 執行所有測試確認無 regression**

Run: `cd backend && npm test`
Expected: 所有測試通過

**Step 5: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: 完善 CORS 設定與全域錯誤處理"
```

---

### Task 14: 整合驗證與最終清理

**Files:**
- Verify: 所有測試通過
- Verify: 前後端整合正常

**Step 1: 執行所有後端測試**

Run: `cd backend && npm test`
Expected: 所有測試通過（health + auth.service + auth.routes + auth.middleware + sites.routes）

**Step 2: 啟動完整系統驗證**

1. 確認 Docker PostgreSQL 運行中：`docker compose ps`
2. 啟動後端：`cd backend && npm run dev`
3. 啟動前端：`cd frontend && npm run dev -- --port 5173`
4. 手動測試以下場景：
   - 登入頁面正常顯示
   - 正確帳密登入成功
   - 錯誤帳密登入失敗並顯示錯誤訊息
   - 登入後看到儀表板
   - 登出後回到登入頁
   - 未登入直接存取 `/` 會跳轉到 `/login`

**Step 3: 更新 .env.example 加入所有變數**

```bash
# .env.example
POSTGRES_DB=recycle_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
DB_PORT=5432
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/recycle_db

JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=8h

PORT=3000
CORS_ORIGIN=http://localhost:5173
```

**Step 4: 最終 Commit**

```bash
git add .env.example
git commit -m "chore: 階段一基礎建設完成 - 更新環境變數範例"
```

---

## 階段一完成標準

- [x] PostgreSQL 透過 Docker Compose 運行
- [x] Prisma Schema 定義 9 個資料表（sites, customers, contract_prices, item_prices, trips, items_collected, monthly_statements, system_logs, users）
- [x] Seed 腳本填入 7 站點、8 品項、4 客戶、2 合約、1 管理員
- [x] Auth Service（bcrypt 密碼雜湊 + JWT Token）
- [x] Auth Routes（POST /api/auth/register、POST /api/auth/login）
- [x] Auth Middleware（JWT 驗證 + RBAC 角色授權）
- [x] Sites API（GET /api/sites、POST /api/sites）搭配權限控管
- [x] Frontend 登入頁面（Ant Design）
- [x] AuthContext + ProtectedRoute
- [x] 前後端整合驗證通過
- [x] 所有測試通過

## 專案結構

```
recycling-automation-system/
├── .gitignore
├── .env.example
├── .env                          # 不提交
├── docker-compose.yml
├── docs/
│   └── plans/
│       ├── 2026-02-06-recycling-automation-system-design.md
│       └── 2026-02-06-phase1-foundation.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts              # 伺服器入口
│   │   ├── app.ts                # Express 應用
│   │   ├── lib/
│   │   │   └── prisma.ts         # Prisma Client 單例
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT + RBAC 中介層
│   │   ├── routes/
│   │   │   ├── auth.ts           # 身份驗證路由
│   │   │   └── sites.ts          # 站點管理路由
│   │   └── services/
│   │       └── auth.service.ts   # 密碼雜湊 + JWT 服務
│   └── tests/
│       ├── setup.ts
│       ├── health.test.ts
│       ├── auth.service.test.ts
│       ├── auth.routes.test.ts
│       ├── auth.middleware.test.ts
│       └── sites.routes.test.ts
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── .env
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── services/
        │   ├── api.ts            # Axios 基底
        │   └── auth.ts           # Auth API
        ├── contexts/
        │   └── AuthContext.tsx    # 身份驗證 Context
        ├── components/
        │   └── ProtectedRoute.tsx # 路由保護
        └── pages/
            ├── LoginPage.tsx     # 登入頁
            └── DashboardPage.tsx # 儀表板佔位
```

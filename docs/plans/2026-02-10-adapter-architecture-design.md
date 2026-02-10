# 外部系統整合架構設計（Adapter 模式）

> 日期：2026-02-10
> 狀態：設計完成，待實作
> 前置：`docs/plans/2026-02-10-mvp-full-rewrite-design.md`

---

## 1. 背景

公司目前有三套獨立系統，資料各自獨立、月底才人工彙整：

| 系統 | 角色 | 產出資料 |
|------|------|---------|
| **POS 系統** | 現場收運交易 | 品項、重量、單價 |
| **車機系統** | 車趟追蹤 + 調度 | 車趟紀錄、GPS 軌跡、派車調度 |
| **CRM 系統** | 營運核心（全包） | 客戶、合約、計費、報表、通知 |

**策略：**
- 新系統優先取代 CRM 系統
- POS 和車機系統：現階段建立模擬 DB + 假資料，未來替換為真實串接
- 資料流向為**雙向同步**

---

## 2. 整體架構

```
┌─────────────────────────────────────────────────────────┐
│                    新系統（回收業務自動化）                  │
│                                                         │
│  ┌──────────────────────────────────────────────┐      │
│  │              核心業務層                         │      │
│  │  客戶管理 │ 合約管理 │ 計費引擎 │ 月結 │ 報表    │      │
│  └────────────────────┬─────────────────────────┘      │
│                       │                                 │
│  ┌────────────────────▼─────────────────────────┐      │
│  │           外部系統整合層 (Adapters)              │      │
│  │                                               │      │
│  │  ┌─────────────────┐  ┌─────────────────┐    │      │
│  │  │  IPosAdapter     │  │ IVehicleAdapter  │    │      │
│  │  │                 │  │                 │    │      │
│  │  │ 讀：品項+重量+單價│  │ 讀：車趟+GPS+調度│    │      │
│  │  │ 寫：客戶+合約單價 │  │ 寫：客戶+派車指令│    │      │
│  │  └────────┬────────┘  └────────┬────────┘    │      │
│  └───────────┼────────────────────┼──────────────┘      │
│              │                    │                      │
│  ┌───────────▼────────┐ ┌────────▼─────────┐           │
│  │  MockPosAdapter    │ │MockVehicleAdapter │ ← 現階段   │
│  │  (模擬 DB + 假資料) │ │(模擬 DB + 假資料) │            │
│  └────────────────────┘ └──────────────────┘           │
│              ↓                    ↓                      │
│  ┌────────────────────┐ ┌──────────────────┐           │
│  │  RealPosAdapter    │ │RealVehicleAdapter │ ← 未來替換 │
│  │  (API 串接真實 POS) │ │(API 串接真實車機) │            │
│  └────────────────────┘ └──────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### 設計原則

- **核心業務層**完全不知道外部系統的存在，只透過 Adapter 介面取得/推送資料
- **Adapter 介面**定義讀取和寫入的標準方法，不綁定任何實作細節
- **Mock 實作**用獨立的模擬資料表 + 假資料產生器，供開發和測試使用
- **切換方式**：透過環境變數決定用 Mock 還是 Real，核心邏輯零修改
- **漸進式擴充**：介面可隨時新增方法/欄位，不影響既有邏輯

---

## 3. Adapter 介面定義

### IPosAdapter（POS 系統）

```typescript
// backend/src/adapters/pos.adapter.ts

/** POS 系統介面 — 負責品項進銷貨資料 */
interface IPosAdapter {

  // ====== 讀取（POS → 新系統）======

  /** 取得指定日期範圍的收運紀錄 */
  getCollectionRecords(params: {
    siteId?: number
    customerId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<PosCollectionRecord[]>

  /** 取得即時/最新的過磅紀錄（用於增量同步） */
  getLatestRecords(since: Date): Promise<PosCollectionRecord[]>

  // ====== 寫入（新系統 → POS）======

  /** 同步客戶資料給 POS（新增/更新） */
  syncCustomer(customer: CustomerSyncData): Promise<void>

  /** 同步合約品項單價給 POS（讓現場知道該用什麼價格） */
  syncContractPrices(contractItems: ContractPriceSyncData[]): Promise<void>
}

/** POS 回傳的收運紀錄格式 */
interface PosCollectionRecord {
  externalId: string       // POS 系統的原始 ID
  siteId: number           // 站區
  customerName: string     // POS 端的客戶名稱（需對應）
  collectionDate: Date     // 收運日期
  items: {
    itemName: string       // 品項名稱
    quantity: number       // 數量/重量
    unit: string           // 單位
    unitPrice: number      // POS 端單價
  }[]
}
```

### IVehicleAdapter（車機系統）

```typescript
// backend/src/adapters/vehicle.adapter.ts

/** 車機系統介面 — 負責車趟與調度 */
interface IVehicleAdapter {

  // ====== 讀取（車機 → 新系統）======

  /** 取得車趟紀錄 */
  getTripRecords(params: {
    siteId?: number
    dateFrom: Date
    dateTo: Date
  }): Promise<VehicleTripRecord[]>

  /** 取得車輛即時狀態（未來擴充用） */
  getVehicleStatus(): Promise<VehicleStatus[]>

  // ====== 寫入（新系統 → 車機）======

  /** 同步客戶資料（地址、聯絡方式，供調度使用） */
  syncCustomer(customer: CustomerSyncData): Promise<void>

  /** 派車指令（未來擴充用） */
  dispatchTrip(dispatch: DispatchData): Promise<void>
}

/** 車機回傳的車趟紀錄格式 */
interface VehicleTripRecord {
  externalId: string       // 車機系統的原始 ID
  siteId: number           // 站區
  customerName: string     // 客戶名稱
  tripDate: Date           // 車趟日期
  tripTime: string         // 車趟時間
  driver: string           // 司機
  vehiclePlate: string     // 車牌
  gpsRoute?: object        // GPS 軌跡（未來用）
}
```

### 共用型別

```typescript
// backend/src/adapters/types.ts

/** 客戶同步資料（推送給 POS/車機） */
interface CustomerSyncData {
  id: number               // 新系統客戶 ID
  name: string             // 客戶名稱
  contactPerson?: string   // 聯絡人
  phone?: string           // 電話
  address?: string         // 地址
  type: 'contracted' | 'temporary'  // 簽約/臨時
}

/** 合約品項單價同步（推送給 POS） */
interface ContractPriceSyncData {
  customerId: number       // 客戶 ID
  customerName: string     // 客戶名稱
  itemName: string         // 品項名稱
  unit: string             // 單位
  unitPrice: number        // 合約單價
  billingDirection: string // 費用方向
}

/** 車輛狀態（未來擴充） */
interface VehicleStatus {
  vehiclePlate: string     // 車牌
  driver: string           // 司機
  status: 'idle' | 'on_route' | 'loading' | 'returning'
  lastLocation?: { lat: number; lng: number }
}

/** 派車指令（未來擴充） */
interface DispatchData {
  vehiclePlate: string     // 車牌
  driver: string           // 司機
  customerId: number       // 客戶
  scheduledDate: Date      // 預排日期
  notes?: string           // 備註
}
```

---

## 4. Mock DB 結構

在同一個 PostgreSQL 中，用 `mock_` 前綴區隔模擬資料表。

### Prisma Schema（模擬部分）

```prisma
// ====== POS 模擬：收運紀錄 ======
model MockPosCollection {
  /// 自動遞增主鍵
  id              Int      @id @default(autoincrement())
  /// POS 系統的原始 ID（模擬外部系統主鍵）
  externalId      String   @unique @map("external_id")
  /// 站區名稱（模擬 POS 端用名稱而非 ID）
  siteName        String   @map("site_name")
  /// 客戶名稱（模擬 POS 端用名稱，需與主系統客戶對應）
  customerName    String   @map("customer_name")
  /// 收運日期
  collectionDate  DateTime @map("collection_date") @db.Date
  /// 品項名稱
  itemName        String   @map("item_name")
  /// 數量/重量
  quantity        Decimal  @db.Decimal(10, 2)
  /// 計量單位（kg、件、袋等）
  unit            String
  /// 品項單價
  unitPrice       Decimal  @map("unit_price") @db.Decimal(10, 2)
  /// 是否已被新系統讀取匯入（用於增量同步）
  imported        Boolean  @default(false)
  /// 資料建立時間
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("mock_pos_collections")
}

// ====== POS 模擬：同步紀錄 ======
model MockPosSyncLog {
  /// 自動遞增主鍵
  id          Int      @id @default(autoincrement())
  /// 同步方向（push=推送至 POS / pull=從 POS 讀取）
  direction   String   // push | pull
  /// 同步類型（customer=客戶 / contract_price=合約單價 / collection=收運紀錄）
  syncType    String   @map("sync_type")
  /// 同步資料筆數
  recordCount Int      @map("record_count")
  /// 同步狀態（success / failed）
  status      String
  /// 錯誤訊息（失敗時記錄）
  errorMsg    String?  @map("error_msg")
  /// 同步時間
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("mock_pos_sync_log")
}

// ====== 車機模擬：車趟紀錄 ======
model MockVehicleTrip {
  /// 自動遞增主鍵
  id            Int      @id @default(autoincrement())
  /// 車機系統的原始 ID（模擬外部系統主鍵）
  externalId    String   @unique @map("external_id")
  /// 站區名稱
  siteName      String   @map("site_name")
  /// 客戶名稱
  customerName  String   @map("customer_name")
  /// 車趟日期
  tripDate      DateTime @map("trip_date") @db.Date
  /// 車趟時間（HH:MM 格式）
  tripTime      String   @map("trip_time")
  /// 司機姓名
  driver        String
  /// 車牌號碼
  vehiclePlate  String   @map("vehicle_plate")
  /// 是否已被新系統讀取匯入
  imported      Boolean  @default(false)
  /// 資料建立時間
  createdAt     DateTime @default(now()) @map("created_at")

  @@map("mock_vehicle_trips")
}

// ====== 車機模擬：車輛狀態 ======
model MockVehicleStatus {
  /// 自動遞增主鍵
  id            Int      @id @default(autoincrement())
  /// 車牌號碼
  vehiclePlate  String   @unique @map("vehicle_plate")
  /// 司機姓名
  driver        String
  /// 車輛狀態（idle=閒置 / on_route=在途 / loading=裝載中 / returning=返程）
  status        String   @default("idle")
  /// 最後回報時間
  lastReportAt  DateTime? @map("last_report_at")
  /// 更新時間
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("mock_vehicle_status")
}

// ====== 車機模擬：同步紀錄 ======
model MockVehicleSyncLog {
  /// 自動遞增主鍵
  id          Int      @id @default(autoincrement())
  /// 同步方向（push=推送至車機 / pull=從車機讀取）
  direction   String   // push | pull
  /// 同步類型（customer=客戶 / trip=車趟 / dispatch=派車指令）
  syncType    String   @map("sync_type")
  /// 同步資料筆數
  recordCount Int      @map("record_count")
  /// 同步狀態（success / failed）
  status      String
  /// 錯誤訊息
  errorMsg    String?  @map("error_msg")
  /// 同步時間
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("mock_vehicle_sync_log")
}
```

---

## 5. 假資料產生器

```typescript
// backend/src/adapters/mock/mock-data-seeder.ts

export class MockDataSeeder {
  /**
   * 產出指定月份的完整模擬資料
   * 呼叫方式：npm run seed:mock -- --month 2026-01
   */
  async seed(yearMonth: string, options?: {
    sitesCount?: number       // 幾個站區有資料，預設 3
    customersPerSite?: number // 每站幾個客戶，預設 10
    tripsPerCustomer?: number // 每客戶每月幾趟，預設 5
    itemsPerTrip?: number     // 每趟幾個品項，預設 2-4（隨機）
  })
}
```

### 假資料產生規則

| 資料 | 產生規則 |
|------|---------|
| 車趟日期 | 該月工作日隨機分佈，避開週末 |
| 司機 | 從預設名單隨機（王大明、李小華、陳志強...） |
| 車牌 | 從預設車牌隨機（ABC-1234、DEF-5678...） |
| 品項 | 從主系統品項主檔隨機抽取 2-4 個 |
| 重量 | 50-500 kg 之間隨機，常態分佈 |
| 單價 | 合約客戶用合約價 ±10%，臨時客戶用隨機價 |
| 時間 | 08:00-17:00 之間隨機 |
| external_id | 格式 `POS-{YYYYMMDD}-{流水號}` / `VH-{YYYYMMDD}-{流水號}` |

---

## 6. 切換機制

### 環境變數控制

```bash
# backend/.env
POS_ADAPTER_MODE=mock          # mock | real
VEHICLE_ADAPTER_MODE=mock      # mock | real
```

### 工廠函式

```typescript
// backend/src/adapters/index.ts

export function createPosAdapter(): IPosAdapter {
  const mode = process.env.POS_ADAPTER_MODE || 'mock'
  switch (mode) {
    case 'mock':  return new MockPosAdapter()
    // case 'real': return new RealPosAdapter()   // 未來加入
    default:      return new MockPosAdapter()
  }
}

export function createVehicleAdapter(): IVehicleAdapter {
  const mode = process.env.VEHICLE_ADAPTER_MODE || 'mock'
  switch (mode) {
    case 'mock':  return new MockVehicleAdapter()
    // case 'real': return new RealVehicleAdapter()
    default:      return new MockVehicleAdapter()
  }
}
```

### 未來切換流程

```
1. 實作 RealPosAdapter / RealVehicleAdapter（串接真實 API）
2. 測試通過
3. .env 改 POS_ADAPTER_MODE=real / VEHICLE_ADAPTER_MODE=real
4. 重啟服務
5. 完成，核心邏輯零修改
```

---

## 7. 資料同步流程

### 讀取方向（外部 → 新系統）

```
1. 先讀車機 → 建立 Trip（日期+司機+車牌+客戶）
2. 再讀 POS  → 比對同一天同一客戶 → 掛載 TripItems
3. 簽約客戶 → 驗證單價是否與合約一致
4. 標記 imported=true，避免重複匯入
```

### 寫入方向（新系統 → 外部）

| 觸發時機 | 推送內容 | 目標 |
|---------|---------|------|
| 客戶新增/修改 | 客戶名稱、地址、聯絡方式 | POS + 車機 |
| 合約品項變更 | 品項名稱、單價、方向 | POS |
| 手動觸發 | 全量客戶 + 合約資料 | POS + 車機 |

---

## 8. 檔案結構

```
backend/src/adapters/
├── index.ts                    # 工廠函式（createPosAdapter, createVehicleAdapter）
├── pos.adapter.ts              # IPosAdapter 介面定義
├── vehicle.adapter.ts          # IVehicleAdapter 介面定義
├── types.ts                    # 共用型別（PosCollectionRecord, VehicleTripRecord...）
├── mock/
│   ├── mock-pos.adapter.ts     # POS Mock 實作（讀寫模擬 DB）
│   ├── mock-vehicle.adapter.ts # 車機 Mock 實作
│   └── mock-data-seeder.ts     # 假資料產生器
└── real/                       # 未來實作
    ├── real-pos.adapter.ts     # 真實 POS API 串接
    └── real-vehicle.adapter.ts # 真實車機 API 串接
```

---

## 9. 介面擴充指南

未來需要新增功能時的調整成本：

| 變更類型 | 影響範圍 | 難度 |
|---------|---------|------|
| 新增 Adapter 方法 | 介面 + Mock/Real 各補一個實作 | 低 |
| 新增資料欄位 | 在型別加 optional 欄位，不破壞既有邏輯 | 低 |
| 修改既有欄位 | 可能需調整核心業務層的使用方式 | 中 |
| 整個介面重新設計 | 核心層 + 所有實作都要改（極少發生） | 高 |

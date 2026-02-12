# 回收業務自動化系統 — 系統規格書

> **版本**：1.0
> **日期**：2026-02-12
> **用途**：提供完整的系統規格，供開發者依照 Spec-Driven Development 流程從零實作

---

## 目錄

1. [專案概述](#1-專案概述)
2. [資料模型](#2-資料模型)
3. [API 契約](#3-api-契約)
4. [業務規則](#4-業務規則)
5. [UI 規格](#5-ui-規格)
6. [外部整合](#6-外部整合)
7. [非功能需求](#7-非功能需求)
8. [種子資料](#8-種子資料)
9. [環境設定](#9-環境設定)

---

## 1. 專案概述

### 1.1 業務背景

公司經營 **7 個回收站區**，向配合客戶收取回收物（紙類、鐵類、五金類、塑膠類、雜項），每月結算帳務。

公司目前有 **三套獨立系統**，彼此之間無資料串接，月底靠人工彙整：

| 系統 | 功能 | 問題 |
|------|------|------|
| CRM（自有） | 客戶基本資料管理 | 資料陳舊、欄位不完整 |
| POS（外購） | 過磅秤重、列印磅單 | 無法匯出結構化資料 |
| 車機系統（外購） | GPS 軌跡、派車管理 | 獨立運作、人工比對車趟 |

本系統目標：建立統一平台，整合三套系統資料，自動化月結帳務流程。

### 1.2 MVP 範圍

**做：**
- 基礎資料 CRUD（站區、品項、客戶、行號、合約）
- 車趟管理（手動輸入 + 外部系統同步）
- 計費引擎（品項層級方向定價、車趟費、附加費用）
- 月結明細產出、審核、開票、寄送、作廢流程
- 報表輸出（PDF 月結明細、Excel 站區彙總）
- Email 通知寄送
- 外部系統 Adapter 整合（Mock 實作）
- 排程自動化（月結產出、寄送檢查、合約到期提醒）

**不做：**
- 權限分離（所有使用者同等權限，統一 admin 角色）
- LINE 通知（預留介面，不實作）
- 真實 POS / 車機 API 接入（使用 Mock DB 模擬）
- 報價簽約流程（系統外處理，只管理已簽約的合約）
- 車趟排程預排
- 政府假日 API 串接（手動維護假日）
- 月結全自動（人工審核階段）

### 1.3 技術選型

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Vite |
| UI 元件庫 | Ant Design 5 |
| 前端狀態管理 | React Query (@tanstack/react-query) |
| 路由 | react-router-dom |
| 後端 | Express.js + TypeScript |
| ORM | Prisma |
| 資料庫 | PostgreSQL 16 |
| 容器化 | Docker Compose |
| PDF 產出 | pdfkit + Noto Sans TC 中文字型 |
| Excel 產出 | exceljs |
| 排程 | node-cron |
| 郵件 | nodemailer (SMTP) |
| 測試 | Jest + Supertest |

### 1.4 系統架構

```
┌──────────────────┐     ┌──────────────────┐
│   React SPA      │────>│  Express REST    │
│   (port 5173)    │     │  API (port 3000) │
└──────────────────┘     └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐
              │ PostgreSQL │ │ Adapter │ │   SMTP      │
              │ (port 5432)│ │  Layer  │ │   Server    │
              └───────────┘ └────┬────┘ └─────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │                         │
              ┌─────▼─────┐           ┌───────▼───────┐
              │  POS 系統  │           │  車機系統      │
              │  (Mock DB) │           │  (Mock DB)    │
              └───────────┘           └───────────────┘
```

---

## 2. 資料模型

### 2.1 實體關聯圖（ERD）

```
Site 1──* Customer 1──* Trip 1──* TripItem *──1 Item
  │                │              │
  │                │              └──* Statement
  │                │
  │                ├──* CustomerFee
  │                │
  │                ├──* Contract 1──* ContractItem *──1 Item
  │                │
  │                └──* Statement
  │
  └──* Trip

BusinessEntity 1──* Customer
               1──* Statement

User 1──* SystemLog
     1──* Statement (reviewedBy / voidedBy)

Holiday（獨立）
MockPosCollection（獨立）
MockVehicleTrip（獨立）
```

### 2.2 Model 定義

> **型別慣例**：
> - 所有狀態 / 類型欄位使用 `String` 型別，驗證在應用層實作（不使用資料庫 enum）。
> - 「必填」欄位不可為 null；「選填」欄位可為 null。
> - Decimal 精度標示如 `Decimal(10,2)` 表示總共 10 位、小數 2 位。

#### Site（站區主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| name | String | unique | 站區名稱 |
| address | String | 選填 | 地址 |
| phone | String | 選填 | 電話 |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | 建立時間 |
| updatedAt | DateTime | auto | 更新時間 |

**關聯**：`customers[]`, `trips[]`

#### BusinessEntity（行號主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| name | String | unique | 行號名稱 |
| taxId | String | unique | 統一編號 |
| bizItems | String | 選填 | 營業項目說明 |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`customers[]`, `statements[]`

#### Item（品項主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | 同時作為品項編號 |
| name | String | unique | 品項名稱（全公司統一） |
| category | String | 選填 | 分類（紙類 / 鐵類 / 五金類 / 塑膠類 / 雜項） |
| unit | String | | 計量單位（kg / 件 / 袋） |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`contractItems[]`, `tripItems[]`

#### Customer（客戶主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| siteId | Int | FK → Site | 所屬站區 |
| name | String | | 客戶名稱 |
| contactPerson | String | 選填 | 聯絡人 |
| phone | String | 選填 | 電話 |
| address | String | 選填 | 地址 |
| type | String | | `contracted`（簽約）/ `temporary`（臨時） |
| tripFeeEnabled | Boolean | default: false | 是否收車趟費 |
| tripFeeType | String | 選填 | `per_trip`（按次）/ `per_month`（按月） |
| tripFeeAmount | Decimal(10,2) | 選填 | 車趟費金額 |
| statementType | String | default: "monthly" | `monthly`（月結）/ `per_trip`（按趟） |
| paymentType | String | default: "lump_sum" | `lump_sum`（一次付清）/ `per_trip`（按趟分付） |
| statementSendDay | Int | 選填, default: 15 | 明細寄送日（每月幾號） |
| paymentDueDay | Int | 選填, default: 15 | 付款到期日 |
| invoiceRequired | Boolean | default: false | 是否需開立發票 |
| invoiceType | String | 選填, default: "net" | `net`（淨額開票）/ `separate`（分開開票） |
| notificationMethod | String | default: "email" | `email` / `line` / `both` |
| notificationEmail | String | 選填 | 通知 Email |
| notificationLineId | String | 選填 | LINE ID |
| paymentAccount | String | 選填 | 匯款帳戶資訊 |
| businessEntityId | Int | 選填, FK → BusinessEntity | 開票行號 |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`site`, `businessEntity?`, `contracts[]`, `fees[]`, `trips[]`, `statements[]`

**有效的結算組合**：

| statementType | paymentType | 允許？ |
|---------------|-------------|--------|
| monthly | lump_sum | ✅ |
| monthly | per_trip | ✅ |
| per_trip | lump_sum | ✅ |
| per_trip | per_trip | ❌ 不提供 |

#### CustomerFee（客戶附加費用）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| name | String | | 費用名稱（自由輸入） |
| amount | Decimal(10,2) | | 固定金額 |
| billingDirection | String | | `receivable`（應收）/ `payable`（應付） |
| frequency | String | | `monthly`（按月）/ `per_trip`（按趟） |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**約束**：按趟結算客戶（`statementType = 'per_trip'`）的附加費用只允許 `frequency = 'per_trip'`。

#### Contract（合約）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| contractNumber | String | unique | 合約編號 |
| startDate | Date | | 起始日 |
| endDate | Date | | 到期日 |
| status | String | default: "draft" | `draft` / `active` / `expired` / `terminated` |
| notes | String | 選填 | 備註 |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`customer`, `items[]`

**狀態機**：

```
draft ──> active ──> expired
  │                    │
  └──> terminated <────┘
```

#### ContractItem（合約品項 — 計費核心）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| contractId | Int | FK → Contract | |
| itemId | Int | FK → Item | |
| unitPrice | Decimal(10,2) | | 合約單價 |
| billingDirection | String | | `receivable` / `payable` / `free` |

**關聯**：`contract`, `item`

#### Trip（車趟紀錄）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| siteId | Int | FK → Site | |
| tripDate | Date | | 收運日期 |
| tripTime | String | 選填 | 收運時間（如 "08:30"） |
| driver | String | 選填 | 司機 |
| vehiclePlate | String | 選填 | 車牌 |
| source | String | default: "manual" | `manual` / `pos_sync` / `vehicle_sync` |
| externalId | String | 選填 | 外部系統原始 ID |
| notes | String | 選填 | 備註 |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`customer`, `site`, `items[]`, `statements[]`

#### TripItem（趟次品項明細 — 快照設計）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| tripId | Int | FK → Trip | |
| itemId | Int | FK → Item | |
| quantity | Decimal(10,2) | | 數量 |
| unit | String | | **快照**：收運當時的計量單位 |
| unitPrice | Decimal(10,2) | | **快照**：收運當時的單價 |
| billingDirection | String | | **快照**：收運當時的方向 |
| amount | Decimal(10,2) | | 計算值（unitPrice × quantity，free 為 0） |

**關聯**：`trip`, `item`

> **快照設計要點**：合約變動不影響已記錄的車趟品項。新增品項時從合約取得當時的單價和方向存入 TripItem，後續合約價格調整不會回溯修改歷史紀錄。

#### Statement（結算明細）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| statementType | String | | `monthly` / `per_trip` |
| tripId | Int | 選填, FK → Trip | 僅 per_trip 使用 |
| yearMonth | String | | 結算月份（如 "2026-01"） |
| itemReceivable | Decimal(12,2) | | 品項應收小計 |
| itemPayable | Decimal(12,2) | | 品項應付小計 |
| tripFeeTotal | Decimal(12,2) | | 車趟費合計 |
| additionalFeeReceivable | Decimal(12,2) | | 應收附加費用合計 |
| additionalFeePayable | Decimal(12,2) | | 應付附加費用合計 |
| totalReceivable | Decimal(12,2) | | 應收合計 |
| totalPayable | Decimal(12,2) | | 應付合計 |
| netAmount | Decimal(12,2) | | 淨額（應收 - 應付） |
| subtotal | Decimal(12,2) | | 小計 |
| taxAmount | Decimal(12,2) | | 稅額（5%） |
| totalAmount | Decimal(12,2) | | 總額 |
| receivableSubtotal | Decimal(12,2) | 選填 | 分開開票：應收小計 |
| receivableTax | Decimal(12,2) | 選填 | 分開開票：應收稅額 |
| receivableTotal | Decimal(12,2) | 選填 | 分開開票：應收總額 |
| payableSubtotal | Decimal(12,2) | 選填 | 分開開票：應付小計 |
| payableTax | Decimal(12,2) | 選填 | 分開開票：應付稅額 |
| payableTotal | Decimal(12,2) | 選填 | 分開開票：應付總額 |
| detailJson | Json | 選填 | 完整明細 JSON 快照 |
| status | String | default: "draft" | 見狀態機 |
| reviewedBy | Int | 選填, FK → User | 審核者 |
| reviewedAt | DateTime | 選填 | 審核時間 |
| sentAt | DateTime | 選填 | 寄送時間 |
| sentMethod | String | 選填 | `email` / `line` |
| sendRetryCount | Int | default: 0 | 寄送重試次數（最大 3） |
| sendError | String | 選填 | 最後一次寄送失敗原因 |
| voidedAt | DateTime | 選填 | 作廢時間 |
| voidedBy | Int | 選填, FK → User | 作廢者 |
| voidReason | String | 選填 | 作廢原因 |
| businessEntityId | Int | 選填, FK → BusinessEntity | 快照：產出時的開票行號 |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**狀態機**：

```
                    ┌───── rejected
                    │         │
                    │    （修正後重新產出）
                    │         │
draft ──> approved ──> invoiced ──> sent
              │                      │
              │        ┌─────────────┘
              │        │
              └──> sent ──> voided
              │              ▲
              └──> invoiced ──┘
```

- 需開票客戶流程：`draft → approved → invoiced → sent`
- 不需開票客戶流程：`draft → approved → sent`
- 退回重做：`approved → rejected`，修正後刪除 rejected 明細重新產出
- 作廢：`sent → voided` 或 `invoiced → voided`

#### Holiday（假日主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| date | Date | unique | 假日日期 |
| name | String | | 假日名稱 |
| year | Int | | 年份 |

#### User（使用者）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| username | String | unique | 帳號 |
| passwordHash | String | | 密碼雜湊（bcrypt, salt=10） |
| name | String | | 姓名 |
| email | String | 選填 | Email |
| role | String | default: "admin" | MVP 統一 admin |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

#### SystemLog（系統日誌）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| eventType | String | | 事件類型 |
| eventContent | String | | 事件內容 |
| userId | Int | 選填, FK → User | |
| createdAt | DateTime | auto | |

#### MockPosCollection（模擬 POS 收運紀錄）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| externalId | String | unique | 外部 ID |
| siteName | String | | 站區名稱（文字比對） |
| customerName | String | | 客戶名稱（文字比對） |
| collectionDate | Date | | 收運日期 |
| itemName | String | | 品項名稱 |
| quantity | Decimal | | 數量 |
| unit | String | | 單位 |
| unitPrice | Decimal | | POS 端單價 |
| imported | Boolean | default: false | 是否已匯入 |

#### MockVehicleTrip（模擬車機車趟紀錄）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| externalId | String | unique | 外部 ID |
| siteName | String | | 站區名稱 |
| customerName | String | | 客戶名稱 |
| tripDate | Date | | 車趟日期 |
| tripTime | String | 選填 | 車趟時間 |
| driver | String | | 司機 |
| vehiclePlate | String | | 車牌 |
| status | String | | `pending` / `in_progress` / `completed` |
| imported | Boolean | default: false | 是否已匯入 |

### 2.3 資料庫索引

| 資料表 | 索引欄位 | 目的 |
|--------|---------|------|
| trips | (customerId, tripDate) | 月結查詢加速 |
| trips | (siteId, tripDate) | 站區報表加速 |
| statements | (customerId, yearMonth, status) | 防重複 + 查詢 |
| contractItems | (contractId) | 合約品項查詢 |
| tripItems | (tripId) | 車趟品項查詢 |
| customers | (siteId, status) | 站區客戶篩選 |

---

## 3. API 契約

### 3.0 通用規則

**認證**：除 `POST /api/auth/login` 外，所有 API 需攜帶 `Authorization: Bearer <JWT>` 標頭。

**分頁回傳格式**：

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

- 預設 `pageSize=20`，最大 100
- `?all=true` 取消分頁，回傳純陣列（最大 1000 筆），用於下拉選單

**錯誤回傳格式**：

```json
{
  "error": "錯誤訊息"
}
```

**常見 HTTP 狀態碼**：
- `200`：成功
- `201`：建立成功
- `202`：已接受（非同步處理）
- `400`：請求錯誤（驗證失敗）
- `401`：未認證
- `404`：資源不存在
- `409`：衝突（唯一值重複）
- `429`：速率限制
- `500`：伺服器錯誤
- `503`：服務不可用（報表並發限制）

---

### 3.1 認證 `/api/auth`

#### POST /api/auth/login

登入取得 JWT Token。**不需認證**。

**Request Body**：
```json
{ "username": "admin", "password": "admin123" }
```

**200 Response**：
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "username": "admin", "name": "系統管理員", "role": "admin" }
}
```

**401 Response**：帳號或密碼錯誤、使用者已停用

**速率限制**：5 次 / 分鐘 / IP

#### GET /api/auth/me

取得當前登入使用者資訊。

**200 Response**：
```json
{ "id": 1, "username": "admin", "name": "系統管理員", "email": null, "role": "admin" }
```

---

### 3.2 站區 `/api/sites`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/sites` | 列表（支援分頁，`?all=true` 回傳陣列） |
| GET | `/api/sites/:id` | 詳情 |
| POST | `/api/sites` | 新增 |
| PATCH | `/api/sites/:id` | 更新 |
| DELETE | `/api/sites/:id` | 軟刪除（設為 inactive） |

**POST Request Body**：
```json
{ "name": "新竹站", "address": "新竹市...", "phone": "03-1234567" }
```
- `name`：必填

**DELETE Response**：
```json
{ "message": "已停用" }
```

**錯誤**：`409` 名稱已存在

---

### 3.3 品項 `/api/items`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/items` | 列表（`?category&status&all=true`） |
| GET | `/api/items/:id` | 詳情 |
| POST | `/api/items` | 新增 |
| PATCH | `/api/items/:id` | 更新 |
| DELETE | `/api/items/:id` | 軟刪除 |

**POST Request Body**：
```json
{ "name": "總紙", "unit": "kg", "category": "紙類" }
```
- `name`、`unit`：必填

---

### 3.4 行號 `/api/business-entities`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/business-entities` | 列表（支援分頁） |
| GET | `/api/business-entities/:id` | 詳情 |
| POST | `/api/business-entities` | 新增 |
| PATCH | `/api/business-entities/:id` | 更新 |
| DELETE | `/api/business-entities/:id` | 軟刪除 |

**POST Request Body**：
```json
{ "name": "和東", "taxId": "12345678", "bizItems": "資源回收" }
```
- `name`、`taxId`：必填

**錯誤**：`409` 名稱或統一編號已存在

---

### 3.5 客戶 `/api/customers`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/customers` | 列表（`?siteId&type&status&all=true`），include site 資訊 |
| GET | `/api/customers/:id` | 詳情（include site + active fees） |
| POST | `/api/customers` | 新增 |
| PATCH | `/api/customers/:id` | 更新 |
| DELETE | `/api/customers/:id` | 軟刪除 |

**POST Request Body**：
```json
{
  "siteId": 1,
  "name": "大明企業",
  "contactPerson": "王大明",
  "phone": "02-12345678",
  "address": "台北市...",
  "type": "contracted",
  "tripFeeEnabled": true,
  "tripFeeType": "per_trip",
  "tripFeeAmount": 500,
  "statementType": "monthly",
  "paymentType": "lump_sum",
  "statementSendDay": 15,
  "paymentDueDay": 15,
  "invoiceRequired": true,
  "invoiceType": "net",
  "notificationMethod": "email",
  "notificationEmail": "daming@example.com",
  "businessEntityId": 1
}
```

**驗證規則**：
1. `siteId`、`name`、`type` 必填
2. `type` 必須是 `contracted` 或 `temporary`
3. 若 `statementType = 'per_trip'`，強制 `paymentType = 'lump_sum'`
4. 若 `tripFeeEnabled = true`，`tripFeeType` 和 `tripFeeAmount` 必填
5. 若 `invoiceRequired = true`，`businessEntityId` 必填

#### 客戶附加費用 `/api/customers/:id/fees`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/customers/:id/fees` | 列表 |
| POST | `/api/customers/:id/fees` | 新增 |
| PATCH | `/api/customers/:cid/fees/:fid` | 更新 |
| DELETE | `/api/customers/:cid/fees/:fid` | 軟刪除 |

**POST Request Body**：
```json
{ "name": "處理費", "amount": 1000, "billingDirection": "receivable", "frequency": "monthly" }
```

**驗證規則**：
- `billingDirection`：`receivable` 或 `payable`
- `frequency`：`monthly` 或 `per_trip`
- 按趟結算客戶只能使用 `frequency = 'per_trip'`

---

### 3.6 合約 `/api/contracts`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/contracts` | 列表（`?customerId&status&all=true`），include customer + items |
| GET | `/api/contracts/:id` | 詳情（include customer + items.item） |
| POST | `/api/contracts` | 新增 |
| PATCH | `/api/contracts/:id` | 更新 |
| DELETE | `/api/contracts/:id` | 終止（設為 terminated） |

**POST Request Body**：
```json
{
  "customerId": 1,
  "contractNumber": "C-2026-001",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "status": "active",
  "notes": "年約"
}
```

#### 合約品項 `/api/contracts/:id/items`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/contracts/:id/items` | 列表（include item） |
| POST | `/api/contracts/:id/items` | 新增 |
| PATCH | `/api/contracts/:cid/items/:iid` | 更新 |
| DELETE | `/api/contracts/:cid/items/:iid` | **硬刪除** |

**POST Request Body**：
```json
{ "itemId": 1, "unitPrice": 3.5, "billingDirection": "payable" }
```
- `billingDirection`：`receivable` / `payable` / `free`

---

### 3.7 車趟 `/api/trips`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/trips` | 列表（`?customerId&siteId&dateFrom&dateTo&all=true`），include customer + site + items |
| GET | `/api/trips/:id` | 詳情（include 完整關聯） |
| POST | `/api/trips` | 新增 |
| PATCH | `/api/trips/:id` | 更新 |
| DELETE | `/api/trips/:id` | **硬刪除**（先刪 items） |

**POST Request Body**：
```json
{
  "customerId": 1,
  "siteId": 1,
  "tripDate": "2026-01-15",
  "tripTime": "08:30",
  "driver": "張三",
  "vehiclePlate": "ABC-1234",
  "notes": ""
}
```

#### 車趟品項 `/api/trips/:id/items`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/trips/:id/items` | 列表（include item） |
| POST | `/api/trips/:id/items` | 新增（含快照邏輯，見業務規則 4.2） |
| PATCH | `/api/trips/:tid/items/:iid` | 更新 |
| DELETE | `/api/trips/:tid/items/:iid` | 刪除 |

**POST Request Body**：
```json
{ "itemId": 1, "quantity": 150.5, "unitPrice": 3.5, "billingDirection": "payable" }
```
- `unitPrice` 和 `billingDirection`：簽約客戶可不填（自動從合約帶入），臨時客戶必填

---

### 3.8 月結明細 `/api/statements`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/statements` | 列表（`?yearMonth&status&customerId`），include customer |
| GET | `/api/statements/:id` | 詳情（include customer + trip） |
| POST | `/api/statements/generate` | 產出月結明細 |
| POST | `/api/statements/generate-trip` | 產出按趟明細 |
| PATCH | `/api/statements/:id/review` | 審核 |
| PATCH | `/api/statements/:id/invoice` | 標記開票 |
| POST | `/api/statements/:id/send` | 寄送 |
| POST | `/api/statements/:id/void` | 作廢 |

#### POST /api/statements/generate

**Request Body**：
```json
{ "yearMonth": "2026-01", "customerId": 1 }
```
- `yearMonth`：必填
- `customerId`：可選。有提供 → 同步回傳 `201`；未提供 → 批次產出，立即回傳 `202`（背景非同步處理）

#### POST /api/statements/generate-trip

**Request Body**：
```json
{ "tripId": 1 }
```

#### PATCH /api/statements/:id/review

**Request Body**：
```json
{ "action": "approve" }
```
- `action`：`approve` 或 `reject`
- 只有 `draft` 狀態可以審核

#### PATCH /api/statements/:id/invoice

- 無 Request Body
- 只有 `approved` 狀態可以標記開票

#### POST /api/statements/:id/send

- 無 Request Body
- 寄送規則見[業務規則 4.4](#44-明細寄送規則)

#### POST /api/statements/:id/void

**Request Body**：
```json
{ "reason": "金額有誤，需重新計算" }
```
- `reason`：必填
- 只有 `sent` 或 `invoiced` 狀態可以作廢

---

### 3.9 報表 `/api/reports`

| 方法 | 路徑 | 說明 | 回傳 |
|------|------|------|------|
| GET | `/api/reports/customers/:customerId` | 客戶月結 PDF | `?yearMonth` → application/pdf |
| GET | `/api/reports/statements/:statementId/pdf` | 明細 PDF | application/pdf |
| GET | `/api/reports/sites/:siteId` | 站區彙總 Excel | `?yearMonth` → application/xlsx |

**速率限制**：10 次 / 分鐘 / IP
**並發控制**：最多 5 個報表同時產出，超過回傳 `503`

---

### 3.10 儀表板 `/api/dashboard`

#### GET /api/dashboard/stats

**200 Response**：
```json
{
  "monthlyTrips": 42,
  "totalReceivable": 125000,
  "totalPayable": 85000,
  "customerCount": 15,
  "pendingReviews": 3,
  "expiringContracts": [
    { "id": 1, "contractNumber": "C-2026-001", "customerName": "大明企業", "endDate": "2026-03-01", "daysRemaining": 17 }
  ],
  "pendingItems": [
    { "id": 5, "customerName": "小華工廠", "yearMonth": "2026-01", "status": "draft" }
  ]
}
```

計算邏輯：
- `monthlyTrips`：本月車趟數
- `totalReceivable` / `totalPayable`：本月非 draft 的 Statement 合計
- `customerCount`：status=active 的客戶數
- `pendingReviews`：status=draft 的 Statement 數
- `expiringContracts`：30 天內到期的 active 合約
- `pendingItems`：status=draft 的 Statement 列表

---

### 3.11 使用者 `/api/users`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/users` | 列表（**不分頁**，回傳純陣列） |
| GET | `/api/users/:id` | 詳情 |
| POST | `/api/users` | 新增 |
| PATCH | `/api/users/:id` | 更新 |
| DELETE | `/api/users/:id` | 軟刪除 |

**POST Request Body**：
```json
{ "username": "user1", "password": "Password1", "name": "使用者一", "email": "user1@example.com" }
```

**密碼策略**：最少 8 字元，至少包含 1 個數字。
**回應永遠排除** `passwordHash` 欄位。

---

### 3.12 假日 `/api/holidays`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/holidays` | 列表（`?year`，**不分頁**，回傳純陣列） |
| POST | `/api/holidays` | 新增單筆 |
| POST | `/api/holidays/import` | 批次匯入（upsert） |
| DELETE | `/api/holidays/:id` | **硬刪除** |

**批次匯入 Request Body**：
```json
{
  "holidays": [
    { "date": "2026-01-01", "name": "元旦", "year": 2026 },
    { "date": "2026-01-29", "name": "除夕", "year": 2026 }
  ]
}
```

---

### 3.13 排程 `/api/schedule`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/schedule` | 排程狀態列表 |
| POST | `/api/schedule/:name/trigger` | 手動觸發排程 |

**GET Response**：
```json
[
  { "name": "monthly-statement", "cron": "0 9 5 * *", "description": "月結明細產出", "enabled": true },
  { "name": "daily-send", "cron": "0 9 * * *", "description": "每日寄送檢查", "enabled": true }
]
```

---

### 3.14 同步 `/api/sync`

| 方法 | 路徑 | 說明 | Request Body |
|------|------|------|-------------|
| POST | `/api/sync/pos/pull` | POS 收運紀錄拉取 | `{ dateFrom, dateTo }` |
| POST | `/api/sync/pos/push-customers` | 推送客戶至 POS | `{ customerId }` |
| POST | `/api/sync/pos/push-prices` | 推送合約定價至 POS | `{ contractId }` |
| POST | `/api/sync/vehicle/pull` | 車機車趟拉取 | `{ dateFrom, dateTo }` |
| POST | `/api/sync/vehicle/push-customers` | 推送客戶至車機 | `{ customerId }` |
| POST | `/api/sync/vehicle/dispatch` | 派車指令 | `{ customerId, tripDate, driver, vehiclePlate }` |
| GET | `/api/sync/vehicle/status` | 車輛即時狀態 | - |
| GET | `/api/sync/status` | Adapter 健康檢查 | - |
| POST | `/api/sync/mock/generate` | 產生 Mock 假資料 | - |

---

## 4. 業務規則

### 4.1 客戶分類

| 類型 | 說明 | 計費方式 |
|------|------|---------|
| `contracted`（簽約） | 正式簽約客戶，有合約品項定價 | 依合約品項單價和方向 |
| `temporary`（臨時） | 臨時叫車收運，無合約 | 每次手動輸入單價和方向 |

**合約到期降級**：簽約客戶的所有有效合約全部到期時，新增車趟品項時改為手動輸入模式（等同臨時客戶），UI 提示「無有效合約」，但不阻止建立。

### 4.2 車趟品項快照邏輯

新增車趟品項時，系統自動決定單價和方向的來源：

```
客戶類型？
├─ contracted（簽約）
│   └─ 查找該客戶有效合約（active，日期區間內）的 ContractItem
│       ├─ 找到 → 使用合約的 unitPrice 和 billingDirection
│       └─ 找不到 → 降級為手動輸入（request 必須提供）
│
└─ temporary（臨時）
    └─ 必須手動提供 unitPrice 和 billingDirection
```

**amount 計算**：
- `billingDirection = 'free'` → `amount = 0`
- 其他 → `amount = unitPrice × quantity`

### 4.3 計費引擎

#### 4.3.1 月結計費 `calculateMonthlyBilling(customerId, yearMonth)`

1. 查詢該客戶當月所有 TripItems（已快照單價和方向）
2. 依方向分組累加：
   - 品項應收小計 = Σ(`receivable` 品項的 amount)
   - 品項應付小計 = Σ(`payable` 品項的 amount)
   - `free` 品項不計入
3. 車趟費（固定歸入**應收**）：
   - 未啟用 → 0
   - `per_trip` → 當月車趟數 × tripFeeAmount
   - `per_month` → tripFeeAmount
4. 附加費用（各自有 billingDirection）：
   - `monthly` → 直接加入
   - `per_trip` → 金額 × 當月車趟數
5. 彙總：
   - 應收合計 = 品項應收 + 車趟費 + 應收附加費用
   - 應付合計 = 品項應付 + 應付附加費用
   - 淨額 = 應收合計 - 應付合計
6. 稅額計算（5% 營業稅）：
   - **淨額開票 (net)**：`taxAmount = Math.round(|netAmount| × 0.05) × sign`；`totalAmount = subtotal + taxAmount`
   - **分開開票 (separate)**：應收端和應付端各自計算 5% 稅額

#### 4.3.2 按趟計費 `calculateTripBilling(tripId)`

- 只計算單趟的品項
- 車趟費只計算 `per_trip` 類型
- 附加費用只計算 `per_trip` 頻率的

#### 4.3.3 計費引擎測試矩陣

| # | 場景 | 驗證重點 |
|---|------|---------|
| 1 | 純應收品項 | 應收小計正確、應付為 0 |
| 2 | 純應付品項 | 應付小計正確、應收為 0 |
| 3 | 混合方向品項 | 應收、應付各自正確，淨額 = 差額 |
| 4 | 含 free 品項 | free 不計入金額 |
| 5 | 分開開票 | 應收端/應付端各自有 subtotal/tax/total |
| 6 | 無車趟月份 | 品項全為 0，只有 monthly 附加費用 |
| 7 | 按趟附加費用 | 金額 × 車趟數 |
| 8 | 按月車趟費 | 固定金額，不乘車趟數 |
| 9 | 按趟車趟費 | 金額 × 車趟數 |
| 10 | 稅額四捨五入 | Math.round 精度 |
| 11 | 大量品項 | 加總精度（Decimal） |
| 12 | Decimal 精度 | 避免浮點誤差 |

### 4.4 明細寄送規則

| 條件 | 可寄送的狀態 |
|------|-------------|
| 需開票客戶（`invoiceRequired = true`） | `invoiced` |
| 不需開票客戶 | `approved` 或 `invoiced` |

**通知方式**：
- `email`：附帶 PDF 附件，寄送至 `customer.notificationEmail`
- `line`：尚未實作（記錄 log 跳過）
- `both`：Email + LINE

**寄送失敗處理**：
- 增加 `sendRetryCount`
- 記錄 `sendError`
- 每日排程自動重試（`sendRetryCount < 3`）

### 4.5 明細產出防重複機制

| 已有明細狀態 | 處理方式 |
|-------------|---------|
| `draft` / `approved` / `invoiced` / `sent` | **跳過**，不重複產出 |
| `rejected` | **刪除**舊的，重新產出 |
| `voided` | **不算**，可以重新產出 |

### 4.6 軟刪除策略

以下實體使用軟刪除（`status: 'inactive'`），API 的 DELETE 方法實際上是更新狀態：
- Site
- Item
- Customer
- CustomerFee
- BusinessEntity
- User

以下實體使用硬刪除：
- Trip（先刪 TripItems）
- TripItem
- ContractItem
- Holiday

合約使用特殊處理：DELETE 設為 `terminated` 狀態。

---

## 5. UI 規格

### 5.1 整體佈局

```
┌──────────────────────────────────────────────┐
│  Sider (240px)  │       Header              │
│                 ├────────────────────────────│
│  Logo           │                            │
│  ─────          │       Content              │
│  選單項目        │       (主內容區)            │
│  ...            │                            │
│                 │                            │
└──────────────────────────────────────────────┘
```

**RWD 三段式斷點**：
- 桌面（≥992px）：側邊欄固定展開 240px
- 平板（768~991px）：側邊欄收合為圖示列 80px
- 手機（<768px）：側邊欄隱藏，改為 Drawer

### 5.2 側邊選單結構

```
儀表板                    /dashboard
基礎資料
  ├─ 站區管理             /sites
  ├─ 品項管理             /items
  ├─ 客戶管理             /customers
  ├─ 行號管理             /business-entities
  └─ 合約管理             /contracts
營運管理
  ├─ 車趟管理             /trips
  └─ 外部同步             /sync
帳務管理
  ├─ 月結管理             /statements
  └─ 報表                /reports
系統
  ├─ 使用者               /users
  ├─ 假日設定             /holidays
  └─ 排程管理             /schedule
```

### 5.3 頁面規格

#### LoginPage `/login`

- 登入表單：帳號 + 密碼 + 登入按鈕
- 登入成功後導向 `/dashboard`
- 不需認證即可存取

#### DashboardPage `/dashboard`

- 統計卡片（4 格）：本月車趟數、應收總額、應付總額、待審明細數
- 合約到期提醒列表
- 待審明細列表

#### SitesPage `/sites`

- 資料表格：名稱、地址、電話、狀態、操作（編輯 / 刪除）
- 新增按鈕 → Modal 表單
- 編輯 → Modal 表單
- 刪除 → Popconfirm 確認 → 軟刪除

#### ItemsPage `/items`

- 資料表格：品項編號(id)、名稱、分類、單位、狀態、操作
- 支援分類篩選
- 新增 / 編輯 → Modal 表單

#### BusinessEntitiesPage `/business-entities`

- 資料表格：名稱、統一編號、營業項目、狀態、操作
- 新增 / 編輯 → Modal 表單

#### CustomersPage `/customers`

- 資料表格：名稱、站區、類型、結算方式、通知方式、狀態、操作
- 篩選：站區下拉、類型篩選
- 新增 / 編輯 → Modal 表單（包含所有客戶設定欄位）
- 客戶詳情包含附加費用管理子區塊

#### ContractsPage `/contracts`

- 資料表格：合約編號、客戶、起訖日期、狀態、操作
- 篩選：客戶下拉、狀態篩選
- 新增 / 編輯 → Modal 表單
- 展開列或子頁面：合約品項管理（品項、單價、方向）

#### TripsPage `/trips`

- **Tabs 架構**：頂部頁籤切換站區（只顯示 active 站區）
- 每個 Tab 內為獨立的 `SiteTripsTab` 元件
- **SiteTripsTab 內容**：
  - 篩選列：客戶下拉（只含該站區客戶）+ 日期範圍選擇器
  - 車趟資料表格：收運日期、客戶、司機、車牌、來源標籤、操作
  - 展開列：品項明細（`TripItemsExpand` 元件）
  - 新增車趟 Modal：站區自動帶入、客戶下拉只含該站客戶
- **TripItemsExpand**：
  - 品項明細表格：品項、數量、單位、單價、方向、金額
  - 新增品項行（inline 或 Modal）
  - 簽約客戶：品項選擇後自動帶入合約單價和方向
  - 臨時客戶：手動填寫

#### SyncPage `/sync`

- Adapter 連線狀態卡片（POS / 車機）
- 操作按鈕：POS 拉取、車機拉取、產生 Mock 資料
- 同步結果顯示

#### StatementsPage `/statements`

- 篩選列：月份選擇 + 客戶下拉 + 狀態篩選
- **車趟預覽區塊**（選擇客戶 + 月份後自動顯示）：
  - 摘要：共 N 趟、品項總筆數、日期範圍
  - 車趟表格（可展開品項明細）
  - 「產出月結明細」按鈕
  - 已有明細時提示「該月已有明細紀錄」
- 明細資料表格：客戶、月份、應收、應付、淨額、狀態、操作
- 操作按鈕依狀態顯示：審核（draft）、開票（approved）、寄送、作廢
- 批次產出按鈕

#### ReportsPage `/reports`

- 客戶月結 PDF 下載：選擇客戶 + 月份 → 下載
- 站區彙總 Excel 下載：選擇站區 + 月份 → 下載

#### UsersPage `/users`

- 資料表格：帳號、姓名、Email、角色、狀態、操作
- 新增 / 編輯 → Modal 表單

#### HolidaysPage `/holidays`

- 年份篩選
- 假日列表表格：日期、名稱、操作（刪除）
- 新增單筆 + 批次匯入

#### SchedulePage `/schedule`

- 排程列表：名稱、Cron 表達式、說明、狀態
- 手動觸發按鈕

### 5.4 資料表格響應式設計

| 斷點 | 行為 |
|------|------|
| ≥992px | 完整表格 |
| 768~991px | 隱藏次要欄位 + 水平捲動 |
| <768px | 切換為卡片列表模式 |

### 5.5 前端 API Hook 命名慣例

所有 API 呼叫封裝為 React Query hooks，命名規則：

| 操作 | 命名規則 | 範例 |
|------|---------|------|
| 查詢列表 | `use{Entity}s(params?)` | `useSites()`, `useCustomers({ siteId: 1 })` |
| 查詢單筆 | `use{Entity}(id)` | `useCustomer(1)` |
| 新增 | `useCreate{Entity}()` | `useCreateSite()` |
| 更新 | `useUpdate{Entity}()` | `useUpdateSite()` |
| 刪除 | `useDelete{Entity}()` | `useDeleteSite()` |

**快取失效策略**：mutation 成功後 invalidate 對應的 queryKey。

**`all=true` 處理**：下拉選單用的 hooks 需同時處理陣列和分頁兩種回傳格式。

---

## 6. 外部整合

### 6.1 Adapter 模式設計

使用**策略模式（Strategy Pattern）**實作外部系統整合：

```
Adapter 介面
├── MockAdapter（Mock DB 模擬）  ← MVP 使用
└── RealAdapter（真實 API）      ← 未來擴充
```

環境變數控制切換：
- `POS_ADAPTER_MODE=mock|real`
- `VEHICLE_ADAPTER_MODE=mock|real`

### 6.2 POS Adapter 介面

| 方法 | 說明 |
|------|------|
| `getCollectionRecords(params)` | 依日期範圍拉取收運紀錄 |
| `getLatestRecords(since)` | 取得指定時間後的最新紀錄 |
| `syncCustomer(customer)` | 推送客戶資料至 POS |
| `syncContractPrices(items)` | 推送合約定價至 POS |
| `healthCheck()` | 健康檢查 |

### 6.3 Vehicle Adapter 介面

| 方法 | 說明 |
|------|------|
| `getTripRecords(params)` | 依日期範圍拉取車趟紀錄 |
| `getVehicleStatus()` | 取得車輛即時狀態 |
| `syncCustomer(customer)` | 推送客戶資料至車機 |
| `dispatchTrip(dispatch)` | 發送派車指令 |
| `healthCheck()` | 健康檢查 |

### 6.4 POS 同步邏輯

1. 從 POS Adapter 拉取未匯入的收運紀錄
2. 按 `externalId` 分組為趟次
3. **名稱比對**：站區名稱 → Site、客戶名稱 → Customer（精確比對，失敗記 SystemLog）
4. **去重**：檢查 `externalId` 是否已存在於 Trip
5. 建立 Trip + TripItems
6. **定價策略**：
   - 簽約客戶 → 使用本系統合約價（忽略 POS 端 unitPrice）
   - 臨時客戶 → 使用 POS 端 unitPrice
7. 標記 MockPosCollection.imported = true

### 6.5 車機同步邏輯

1. 從車機 Adapter 拉取車趟紀錄
2. **去重策略**：
   - 精確比對：`externalId`
   - 模糊比對：同客戶 + 同日 + 同站區 + 時間差 ≤ 30 分鐘
3. 匹配到已存在 Trip → 補充 `driver` + `vehiclePlate`
4. 未匹配到 → 建立新 Trip（`source=vehicle_sync`，無品項）

### 6.6 同步鎖定機制

透過 SystemLog 表實作：
- 同步開始時寫入 `sync_start` 事件
- 同步結束時寫入 `sync_end` 事件
- 若有 5 分鐘內的 `sync_start` 無對應 `sync_end` → 進行中，回傳 `409 Conflict`
- 超過 5 分鐘自動解鎖

### 6.7 Mock 假資料產生規則

- 產出 3 個月的資料（每天每客戶 1-3 趟）
- 簽約客戶：使用合約品項
- 臨時客戶：從系統品項表隨機挑選，單價隨機產生

---

## 7. 非功能需求

### 7.1 安全性

| 項目 | 規格 |
|------|------|
| JWT 密鑰 | 啟動時檢查 `JWT_SECRET` 環境變數，未設定直接拋錯終止。**禁止** fallback 預設值 |
| JWT 有效期 | 預設 8 小時 |
| 密碼雜湊 | bcrypt, salt rounds = 10 |
| 密碼策略 | 最少 8 字元，至少包含 1 個數字 |
| 速率限制 | 登入 5 次/分鐘/IP、一般 API 100 次/分鐘/IP、報表 10 次/分鐘/IP |
| 安全標頭 | 使用 helmet 套件 |
| CORS | 限制允許來源（`CORS_ORIGIN` 環境變數） |

### 7.2 錯誤處理

- **全域錯誤中介層**：統一攔截未處理錯誤，回傳 `{ error: string }`
- **Prisma 錯誤轉換**：P2025 → 404、P2002 → 409、P2003 → 400
- **生產環境**：隱藏堆疊追蹤
- **前端 Error Boundary**：全域錯誤邊界元件
- **月結批次錯誤**：部分客戶失敗不影響其他客戶，失敗記 SystemLog

### 7.3 效能

- **分頁**：所有列表 API 預設分頁 20 筆，`?all=true` 最大 1000 筆
- **報表並發**：最多 5 個同時產出
- **月結非同步**：批次產出回傳 202，背景處理
- **批次月結**：`Promise.allSettled` 並行處理（並行上限 5）
- **React Query 快取**：站區/品項 staleTime 5 分鐘、儀表板 staleTime 30 秒

### 7.4 排程

| 排程名稱 | Cron | 說明 |
|----------|------|------|
| monthly-statement | `0 9 5 * *` | 每月 5 號 09:00 產出上月月結明細 |
| daily-send | `0 9 * * *` | 每日 09:00 檢查客戶寄送日，自動寄送已審核明細 |
| send-retry | `5 9 * * *` | 每日 09:05 重試寄送失敗的明細（retryCount < 3） |
| contract-expiry | `0 10 * * *` | 每日 10:00 掃描合約到期提醒（30/14/7/3/1 天） |

**工作日邏輯**：月結產出日若為假日（週六日 + 國定假日），往前推至最近工作日。

### 7.5 通知

**Email**：
- SMTP 寄送（nodemailer）
- 月結明細寄送：附帶 PDF 附件
- 合約到期提醒：寄送至管理員信箱
- 排程失敗報告：寄送至管理員信箱

**LINE**：
- 預留介面，尚未實作
- 呼叫時記錄 SystemLog 並跳過

### 7.6 報表格式

**客戶月結明細 PDF**：
1. 標題：資源回收管理系統 / 月結明細表
2. 客戶資訊：月份、名稱、站區、類型、聯絡人、電話、地址
3. 收運明細表格：日期 / 品項 / 數量 / 單位 / 單價 / 方向 / 金額
4. 車趟費
5. 附加費用
6. 彙總：應收小計 / 應付小計 / 淨額 / 稅額 / 總額
7. 匯款帳戶
8. **中文字型**：使用 Noto Sans TC（放在 `backend/assets/fonts/NotoSansTC-Regular.ttf`）

**站區彙總 Excel**：
- 工作表一（客戶總額）：每個客戶一列，含各項金額
- 工作表二（品項彙總）：按品項聚合數量和金額

### 7.7 備份

- 每日 02:00 執行 `pg_dump`
- 保留 30 天
- 每月 4 號額外全備

---

## 8. 種子資料

系統初始化應建立以下測試資料：

### 8.1 使用者

| 帳號 | 密碼 | 姓名 | 角色 |
|------|------|------|------|
| admin | admin123 | 系統管理員 | admin |

### 8.2 站區（7 個）

新竹站、草屯站、金馬站、員林站、斗六站、和美站、神岡站

### 8.3 行號（4 個）

| 名稱 | 統一編號 | 營業項目 |
|------|---------|---------|
| 和東 | 12345678 | 資源回收 |
| 河北 | 23456789 | 廢棄物處理 |
| 和南 | 34567890 | 資源回收、廢棄物清運 |
| 和西 | 45678901 | 資源回收、五金回收 |

### 8.4 品項（46 項，5 大分類）

| 分類 | 品項數 | 範例 |
|------|--------|------|
| 紙類 | 5 | 總紙、紙容器、白紙、牛皮紙、紙板 |
| 鐵類 | 12 | 總鐵、H 鐵、新料鐵、鑄鐵、馬達鐵... |
| 五金類 | 14 | 紅銅燒、紅銅光、青銅、白鐵 304... |
| 塑膠類 | 7 | PET、PE、PP、PS、ABS... |
| 雜項 | 8 | 鋁罐、鋁片、鋁線、電線、電池... |

全部以 `kg` 為計量單位。

### 8.5 假日（2026 年台灣國定假日，13 天）

元旦、除夕、春節、228 和平紀念日、兒童節、清明節、勞動節、端午節、中秋節、國慶日等。

### 8.6 測試客戶（3 位）

| 客戶 | 站區 | 類型 | 車趟費 | 結算 | 開票 |
|------|------|------|--------|------|------|
| 大明企業 | 新竹站 | 簽約 | per_trip $500 | 月結 | 需要（淨額） |
| 小華工廠 | 新竹站 | 簽約 | per_month $3000 | 月結 | 不需要 |
| 王先生 | 草屯站 | 臨時 | 無 | 按趟 | 不需要 |

### 8.7 測試合約（2 份）

| 合約編號 | 客戶 | 品項 |
|---------|------|------|
| C-2026-001 | 大明企業 | 總紙 $3.5 應付、總鐵 $8.0 應付、PET $2.0 應收 |
| C-2026-002 | 小華工廠 | 總鐵 $7.5 應付、紅銅燒 $150.0 應付 |

### 8.8 測試附加費用（1 筆）

大明企業：處理費 $1000/月，應收

---

## 9. 環境設定

### 9.1 Docker Compose

- PostgreSQL 16-alpine，port 5432
- Volume 持久化資料

### 9.2 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://postgres:postgres123@localhost:5432/recycle_db` | 資料庫連線字串 |
| `JWT_SECRET` | （必須設定） | JWT 簽章金鑰 |
| `JWT_EXPIRES_IN` | `8h` | Token 有效期 |
| `PORT` | `3000` | 後端服務端口 |
| `CORS_ORIGIN` | `http://localhost:5173` | 前端來源 |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 主機 |
| `SMTP_PORT` | `587` | SMTP 端口 |
| `SMTP_USER` | | SMTP 帳號 |
| `SMTP_PASS` | | SMTP 密碼 |
| `SMTP_FROM` | | 寄件人地址 |
| `ADMIN_EMAIL` | | 管理員通知信箱 |
| `FINANCE_EMAIL` | | 財務通知信箱 |
| `ENABLE_SCHEDULER` | `false` | 排程開關 |
| `POS_ADAPTER_MODE` | `mock` | POS Adapter 模式 |
| `VEHICLE_ADAPTER_MODE` | `mock` | 車機 Adapter 模式 |

### 9.3 前端環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `VITE_API_URL` | `/api` | API 基礎路徑（透過 Vite proxy 轉發） |

### 9.4 開發環境 Port 配置

| 服務 | Port |
|------|------|
| 後端 API | 3000 |
| 前端開發伺服器 | 5173 |
| PostgreSQL | 5432 |

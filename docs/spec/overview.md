# 回收業務自動化系統 — 系統規格總覽

> **版本**：3.0（SDD 拆分版）
> **日期**：2026-02-13
> **用途**：提供完整的系統規格導航，供開發者依照 Spec-Driven Development 流程從零實作

---

## 系統簡介

公司經營 **7 個回收站區**，向配合客戶收取回收物（紙類、鐵類、五金類、塑膠類、雜項），每月結算帳務。本系統目標：建立統一平台，整合 CRM / POS / 車機三套系統資料，自動化月結帳務流程。

---

## Spec 導航

### 核心文件

| 文件 | 說明 |
|------|------|
| [architecture.md](./architecture.md) | 技術選型、系統架構、非功能需求 |
| [SDD-WORKFLOW.md](./SDD-WORKFLOW.md) | SDD 五階段變更流程 |

### 資料模型 (`data-models/`)

| 文件 | 涵蓋 Model |
|------|-----------|
| [README.md](./data-models/README.md) | ERD、Model 索引、型別慣例 |
| [base-data.md](./data-models/base-data.md) | Site, Item, BusinessEntity |
| [customer-contract.md](./data-models/customer-contract.md) | Customer, CustomerFee, Contract, ContractItem |
| [trip.md](./data-models/trip.md) | Trip, TripItem |
| [statement.md](./data-models/statement.md) | Statement |
| [system.md](./data-models/system.md) | User, Holiday, SystemLog |
| [external.md](./data-models/external.md) | MockPosCollection, MockVehicleTrip |

### API 契約 (`apis/`)

| 文件 | 涵蓋端點 |
|------|---------|
| [README.md](./apis/README.md) | 通用規則、認證授權、分頁、錯誤、權限矩陣 |
| [auth.md](./apis/auth.md) | `/api/auth` |
| [base-data.md](./apis/base-data.md) | `/api/sites`, `/api/items`, `/api/business-entities` |
| [customers.md](./apis/customers.md) | `/api/customers` + fees |
| [contracts.md](./apis/contracts.md) | `/api/contracts` + items |
| [trips.md](./apis/trips.md) | `/api/trips` + items |
| [statements.md](./apis/statements.md) | `/api/statements` (generate/review/invoice/send/void) |
| [reports.md](./apis/reports.md) | `/api/reports` |
| [dashboard.md](./apis/dashboard.md) | `/api/dashboard` |
| [users.md](./apis/users.md) | `/api/users` |
| [holidays.md](./apis/holidays.md) | `/api/holidays` |
| [schedule.md](./apis/schedule.md) | `/api/schedule` |
| [sync.md](./apis/sync.md) | `/api/sync` |

### 業務規則 (`business-rules/`)

| 文件 | 說明 |
|------|------|
| [README.md](./business-rules/README.md) | 業務規則索引 |
| [customer-classification.md](./business-rules/customer-classification.md) | 客戶分類、合約聯動 |
| [pricing-snapshot.md](./business-rules/pricing-snapshot.md) | 車趟品項快照邏輯 |
| [billing-engine.md](./business-rules/billing-engine.md) | 計費引擎（月結/按趟） |
| [settlement-flow.md](./business-rules/settlement-flow.md) | 結算流程狀態機、寄送規則、防重複 |

### UI 規格 (`ui-specs/`)

| 文件 | 說明 |
|------|------|
| [README.md](./ui-specs/README.md) | 佈局、選單、RWD、前端慣例 |
| [pages-overview.md](./ui-specs/pages-overview.md) | 路由表、權限矩陣 |
| [base-data-pages.md](./ui-specs/base-data-pages.md) | Sites, Items, BusinessEntities, Login |
| [customer-pages.md](./ui-specs/customer-pages.md) | Customers + CustomerDetail (Tab 架構) |
| [trip-pages.md](./ui-specs/trip-pages.md) | Trips (站區 Tabs 架構) |
| [statement-pages.md](./ui-specs/statement-pages.md) | Statements + Reports |
| [system-pages.md](./ui-specs/system-pages.md) | Users, Holidays, Schedule, Sync, Dashboard |

### 外部整合 (`integrations/`)

| 文件 | 說明 |
|------|------|
| [README.md](./integrations/README.md) | Adapter 模式設計 |
| [pos-adapter.md](./integrations/pos-adapter.md) | POS 同步邏輯 |
| [vehicle-adapter.md](./integrations/vehicle-adapter.md) | 車機同步邏輯 |

### 營運配置 (`operations/`)

| 文件 | 說明 |
|------|------|
| [seed-data.md](./operations/seed-data.md) | 種子資料 |
| [environment.md](./operations/environment.md) | 環境變數、Port、Docker |
| [schedules.md](./operations/schedules.md) | Cron 排程、工作日邏輯 |

---

## 變更流程

所有規格變更須遵循 [SDD 五階段流程](./SDD-WORKFLOW.md)：

```
Design → Spec Update → Implementation Plan → Test → Code
（設計）  （更新規格）   （實作計畫）          （測試） （寫程式碼）
```

## Plans 管理

設計文件與實作計畫統一存放於 [`docs/plans/`](../plans/README.md)。

# UI 規格索引

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §5.1、§5.2、§5.4、§5.5 抽取

## 檔案清單

| 檔案 | 說明 |
|------|------|
| [pages-overview.md](./pages-overview.md) | 所有頁面路由表 + 角色權限對照 |
| [base-data-pages.md](./base-data-pages.md) | Login、Sites、Items、BusinessEntities 頁面規格 |
| [customer-pages.md](./customer-pages.md) | Customers 列表 + CustomerDetail Tab 架構（5 個 Tab） |
| [trip-pages.md](./trip-pages.md) | Trips 站區 Tabs 架構 |
| [statement-pages.md](./statement-pages.md) | Statements + Reports 頁面規格 |
| [system-pages.md](./system-pages.md) | Users、Holidays、Schedule、Sync、Dashboard 頁面規格 |

## 整體佈局

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

### RWD 三段式斷點

- 桌面（≥992px）：側邊欄固定展開 240px
- 平板（768~991px）：側邊欄收合為圖示列 80px
- 手機（<768px）：側邊欄隱藏，改為 Drawer

## 側邊選單結構

```
儀表板                    /dashboard          所有角色
基礎資料
  ├─ 站區管理             /sites              所有角色（寫入僅 super_admin）
  ├─ 品項管理             /items              所有角色（寫入僅 super_admin）
  ├─ 客戶管理             /customers          所有角色（siteScope 過濾）
  ├─ 行號管理             /business-entities  所有角色（寫入僅 super_admin）
  └─ 合約總覽             /contracts          僅 super_admin
營運管理
  ├─ 車趟管理             /trips              所有角色（siteScope 過濾）
  └─ 外部同步             /sync               僅 super_admin
帳務管理
  ├─ 月結管理             /statements         所有角色（siteScope 過濾）
  └─ 報表                /reports             所有角色（siteScope 過濾）
系統                                          僅 super_admin
  ├─ 使用者               /users
  ├─ 假日設定             /holidays
  └─ 排程管理             /schedule
```

### 角色動態控制

- `site_staff`：所有寫入按鈕（新增/編輯/停用/啟用/刪除/終止/審核）隱藏
- `site_manager`：主檔管理（站區/品項/行號/假日）寫入按鈕隱藏
- `super_admin`：全部功能可見

## 資料表格響應式設計

| 斷點 | 行為 |
|------|------|
| ≥992px | 完整表格 |
| 768~991px | 隱藏次要欄位 + 水平捲動 |
| <768px | 切換為卡片列表模式 |

## 操作按鈕語意規範

前端操作按鈕必須精確對應後端行為，分為三種語意：

### 停用（軟刪除實體）

- **適用實體**：Site, Item, BusinessEntity, Customer, CustomerFee, User
- **後端行為**：`PATCH /:id/deactivate` API 將 `status` 設為 `inactive`
- **按鈕樣式**：`StopOutlined` 圖示 +「停用」文字，`warning` 色（橘色）
- **確認文字**：「確定停用此 {實體名稱}？停用後可重新啟用。」
- **成功訊息**：「{實體名稱} 已停用」

### 啟用（重新啟用已停用實體）

- **適用實體**：與停用相同
- **後端行為**：`PATCH` API 將 `status` 設為 `active`
- **按鈕樣式**：`CheckCircleOutlined` 圖示 +「啟用」文字，綠色
- **成功訊息**：「{實體名稱} 已啟用」
- **顯示條件**：僅在已停用（`status = inactive`）的項目上顯示

### 刪除（硬刪除實體）

- **適用實體**：Site, Item, BusinessEntity, Customer, CustomerFee, User, Holiday, ContractItem, Trip, TripItem
- **後端行為**：`DELETE` API 從資料庫永久移除（FK 約束失敗時回傳 409 + 友善訊息）
- **按鈕樣式**：`DeleteOutlined` 圖示 +「刪除」文字，`danger` 色（紅色）
- **確認文字**：「確定刪除此 {實體名稱}？此操作無法復原。」
- **成功訊息**：「{實體名稱} 已刪除」

### 終止（合約專用）

- **適用實體**：Contract
- **後端行為**：`DELETE` API 將 `status` 設為 `terminated`
- **按鈕樣式**：`CloseCircleOutlined` 圖示 +「終止」文字，`danger` 色（紅色）
- **確認文字**：「確定終止此合約？終止後無法恢復。」
- **成功訊息**：「合約已終止」

### 狀態篩選器

支援軟刪除的列表頁（Sites, Items, BusinessEntities, Customers, Users）需新增狀態篩選器：

| 選項 | 值 | 說明 |
|------|------|------|
| 啟用中 | `active` | 預設選項，僅顯示啟用中的項目 |
| 已停用 | `inactive` | 僅顯示已停用的項目 |
| 全部 | 不傳 `status` | 顯示所有項目 |

## 前端 API Hook 命名慣例

所有 API 呼叫封裝為 React Query hooks，命名規則：

| 操作 | 命名規則 | 範例 |
|------|---------|------|
| 查詢列表 | `use{Entity}s(params?)` | `useSites()`, `useCustomers({ siteId: 1 })` |
| 查詢單筆 | `use{Entity}(id)` | `useCustomer(1)` |
| 新增 | `useCreate{Entity}()` | `useCreateSite()` |
| 更新 | `useUpdate{Entity}()` | `useUpdateSite()` |
| 停用 | `useDeactivate{Entity}()` | `useDeactivateSite()`（軟刪除實體） |
| 啟用 | `useReactivate{Entity}()` | `useReactivateSite()`（重新啟用） |
| 刪除 | `useDelete{Entity}()` | `useDeleteSite()`（硬刪除，含 FK 約束處理） |
| 終止 | `useDelete{Entity}()` | `useDeleteContract()`（合約終止） |

**快取失效策略**：mutation 成功後 invalidate 對應的 queryKey。

**`all=true` 處理**：下拉選單用的 hooks 需同時處理陣列和分頁兩種回傳格式。

## 相關規格

- [業務規則](../business-rules/README.md)
- [資料模型](../data-models/)
- [API 規格](../apis/)

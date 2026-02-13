# UI 規格索引

> **版本**：3.0
> **日期**：2026-02-13

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

## Loading 狀態規範

### Skeleton Loading（骨架屏）

首次載入頁面或切換 Tab 時，資料尚未回傳前顯示骨架屏：

| 元件 | Skeleton 樣式 | 使用場景 |
|------|-------------|---------|
| 資料表格 | 5 行灰色方塊 + 表頭 | 所有列表頁首次載入 |
| 統計卡片 | 卡片外框 + 數字佔位灰塊 | Dashboard 統計數據 |
| 表單 | 標籤 + 輸入框灰塊 | CustomerDetail 切換 Tab |
| Tab 內容 | 表格骨架或表單骨架 | CustomerDetail 各 Tab 懶載入 |

### Spin Loading（操作中）

使用者觸發操作後，等待 API 回應期間：

| 場景 | 行為 |
|------|------|
| 表單送出 | 送出按鈕顯示 `loading` 狀態，禁用所有按鈕 |
| 刪除/停用/啟用 | Popconfirm 確認後，該行操作按鈕顯示 loading |
| 篩選/搜尋 | 表格區域顯示 Spin 覆蓋層 |
| 批次操作 | 按鈕顯示 loading + 進度文字 |

### Button Loading 規範

- 按鈕進入 loading 時，文字改為「處理中...」
- loading 期間禁用該表單/區塊的所有互動按鈕，防止重複提交
- API 回應後恢復按鈕狀態

## Empty State 規範

### 空表格

| 場景 | 顯示文案 | 圖示 |
|------|---------|------|
| 首次載入無資料 | 「尚無{實體名稱}資料」 | `InboxOutlined` |
| 篩選結果為空 | 「沒有符合條件的{實體名稱}」 | `SearchOutlined` |
| 已停用列表為空 | 「沒有已停用的{實體名稱}」 | `InboxOutlined` |

### 空 Tab 內容

| Tab 場景 | 顯示文案 |
|---------|---------|
| 合約管理無資料 | 「此客戶尚無合約，點擊「新增合約」建立第一筆」 |
| 附加費用無資料 | 「此客戶尚無附加費用」 |
| 車趟紀錄無資料 | 「此客戶尚無車趟紀錄」 |
| 結算明細無資料 | 「此客戶尚無結算明細」 |

### 車趟預覽區空狀態

- 未選擇客戶或月份：「請選擇客戶與月份以預覽車趟」
- 選擇後無車趟：「該客戶在選定月份沒有車趟紀錄」

## Toast 通知規範

使用 Ant Design `message` 元件，統一配置 `duration = 3` 秒。

### 成功通知（`message.success`）

| 操作 | 文案模板 |
|------|---------|
| 新增 | 「{實體名稱} 已新增」 |
| 編輯 | 「{實體名稱} 已更新」 |
| 刪除 | 「{實體名稱} 已刪除」 |
| 停用 | 「{實體名稱} 已停用」 |
| 啟用 | 「{實體名稱} 已啟用」 |
| 終止 | 「合約已終止」 |
| 審核 | 「明細已審核通過」 |
| 作廢 | 「明細已作廢」 |
| 登入 | 「登入成功」 |

### 失敗通知（`message.error`）

| 場景 | 文案模板 |
|------|---------|
| API 400 | 顯示後端回傳的 error 訊息 |
| API 401 | 「登入已過期，請重新登入」（同時導向 /login） |
| API 403 | 「您沒有權限執行此操作」 |
| API 404 | 「找不到指定的{實體名稱}」 |
| API 409 | 顯示後端回傳的 error 訊息（如 FK 約束） |
| API 429 | 「操作過於頻繁，請稍後再試」 |
| API 500 | 「系統發生錯誤，請稍後再試」 |
| API 503 | 「服務暫時不可用，請稍後再試」 |
| 網路錯誤 | 「網路連線異常，請檢查網路狀態」 |

### 警告通知（`message.warning`）

| 場景 | 文案模板 |
|------|---------|
| 重複產出明細 | 「該月已有明細紀錄，無需重複產出」 |
| 合約即將到期 | 「合約將於 {日期} 到期」 |
| 無有效合約 | 「此客戶無有效合約，請手動輸入單價」 |

## Modal 表單規範

### 取消 / 確認行為

| 按鈕 | 行為 |
|------|------|
| 確認（主按鈕） | 送出表單，成功後關閉 Modal 並刷新列表 |
| 取消 | 直接關閉 Modal，不送出 |
| 點擊遮罩 | 等同取消 |
| ESC 鍵 | 等同取消 |

### 未儲存提醒

- Modal 表單中修改過欄位後，按取消或點擊遮罩時：
  - 彈出確認對話框：「表單有未儲存的變更，確定要離開嗎？」
  - 確定 → 關閉 Modal（捨棄變更）
  - 取消 → 返回表單繼續編輯
- 判斷方式：使用 Ant Design Form 的 `isFieldsTouched()` 檢查

### 表單重置

- 新增模式：Modal 開啟時重置所有欄位為預設值
- 編輯模式：Modal 開啟時帶入現有資料

## 日期篩選通用規範

### 月份選擇器

| 設定 | 值 |
|------|---|
| 預設值 | 當月（`dayjs().format('YYYY-MM')`） |
| 可選範圍 | 系統啟用月份 ~ 當月 |
| 格式 | `YYYY-MM` |
| Picker 類型 | `month` |

### 日期範圍選擇器

| 設定 | 值 |
|------|---|
| 預設值 | 當月 1 日 ~ 當月最後一日 |
| 可選範圍 | 不限制（但不可起始日 > 結束日） |
| 格式 | `YYYY-MM-DD` |

### 篩選即時生效

- 月份或日期變更後，自動觸發 API 重新查詢（不需額外按搜尋按鈕）
- 查詢期間顯示 Spin Loading

## 路由守衛與認證 UX 規範

### 路由守衛邏輯

| 場景 | 行為 |
|------|------|
| 未登入使用者訪問任何受保護路由 | 導向 `/login`，登入後自動跳回原本要訪問的頁面 |
| 已登入使用者訪問 `/login` | 自動導向 `/dashboard` |
| 訪問根路徑 `/` | 已登入導向 `/dashboard`，未登入導向 `/login` |
| 訪問不存在的路由 | 顯示 404 頁面，提供「回到首頁」按鈕 |

### Token 過期處理

1. API 回應 `401` 時：
   - 清除本地儲存的 token 和使用者資訊
   - 顯示 Toast：「登入已過期，請重新登入」
   - 自動導向 `/login`
2. 實作方式：在 Axios/Fetch 的 response interceptor 統一處理

### 權限不足處理（403）

| 場景 | 行為 |
|------|------|
| API 回傳 403 | 顯示 Toast：「您沒有權限執行此操作」 |
| 前端路由權限不符 | 導向 `/dashboard` + 顯示 Toast：「您沒有權限存取該頁面」 |

### 無權限路由隱藏

- 側邊選單根據使用者角色動態渲染，不顯示無權限的項目
- 例如 `site_staff` 和 `site_manager` 看不到「系統」群組下的選單
- 實作方式：在選單設定中加入 `roles` 欄位，渲染時過濾

## 相關規格

- [業務規則](../business-rules/README.md)
- [資料模型](../data-models/)
- [API 規格](../apis/)

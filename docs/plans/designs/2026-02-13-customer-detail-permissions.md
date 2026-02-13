# 客戶詳情頁 + 權限系統設計

> 日期：2026-02-13
> 狀態：已核可

## 背景

目前客戶管理和合約管理是兩個完全獨立的頁面。實際業務中「合約跟著客戶走」，操作人員需要在客戶頁面與合約頁面之間來回切換，體驗不佳。

同時，系統目前僅有單一 `admin` 角色，缺乏站區層級的權限控制，無法支援多站區獨立管理的業務場景。

本次設計將兩者一併處理，確保架構一致性。

---

## 一、客戶詳情頁架構

### 路由設計

```
/customers           → 客戶列表頁（保留，移除 Modal 編輯）
/customers/new       → 新增客戶頁面
/customers/:id       → 客戶詳情頁（新頁面）
/contracts           → 合約總覽頁（保留，供系統管理員全局管理）
```

### 詳情頁 Tab 結構

| Tab | 內容 | 說明 |
|-----|------|------|
| **基本資料** | 客戶名稱、站區、聯絡人、車趟費、結算設定、發票通知 | 現有 Modal 內容搬到這裡，改為 inline 表單 |
| **合約管理** | 合約列表 + 新增/編輯合約 + 合約品項 | 從 ContractsPage 搬過來，預設篩選該客戶 |
| **附加費用** | 費用列表 + 新增/編輯 | 現有 Modal 內嵌的附加費用區塊獨立成 Tab |
| **車趟紀錄** | 該客戶的車趟歷史 | 從 TripsPage 篩選該客戶的資料 |
| **結算明細** | 該客戶的月結/按趟明細 | 從 StatementsPage 篩選該客戶的資料 |

### 互動流程

```
客戶列表頁
  ├─ 點擊客戶名稱 → 進入 /customers/:id 詳情頁（預設顯示基本資料 Tab）
  ├─ 「新增客戶」按鈕 → 進入 /customers/new
  └─ 列表上顯示：名稱、站區、類型、合約狀態摘要

客戶詳情頁
  ├─ 基本資料 Tab：直接編輯並儲存（不需 Modal）
  ├─ 合約 Tab：列表 + 展開/Modal 編輯合約品項
  ├─ 附加費用 Tab：列表 + Modal 新增/編輯
  ├─ 車趟 Tab：唯讀查看（連結到車趟詳情）
  └─ 明細 Tab：唯讀查看（連結到明細詳情）
```

### 資料流

```
CustomerDetailPage (/customers/:id)
  │
  ├─ useCustomer(id)           → 基本資料 Tab
  ├─ useContracts(customerId)  → 合約 Tab
  ├─ useCustomerFees(id)       → 附加費用 Tab
  ├─ useTrips(customerId)      → 車趟 Tab
  └─ useStatements(customerId) → 明細 Tab

各 Tab 懶載入：只在切換到該 Tab 時才發請求
```

### 客戶列表頁變更

- 移除 Modal 編輯功能
- 客戶名稱改為超連結，點擊導航到詳情頁
- 保留搜尋、站區篩選、類型篩選功能
- 新增欄位「合約狀態」顯示摘要（如「1 份生效中」）

### 合約總覽頁保留

- 供系統管理員跨客戶檢視所有合約
- 支援篩選：即將到期、已到期、草稿等狀態
- 合約編號可連結到對應客戶詳情頁的合約 Tab

---

## 二、權限系統架構

### 角色定義

| 角色 | `role` 值 | `siteId` | 可存取範圍 | 操作權限 |
|------|-----------|----------|-----------|----------|
| **系統管理員** | `super_admin` | `null` | 所有站區 | 完整 CRUD + 審核 + 使用者管理 |
| **站區主管** | `site_manager` | 綁定站區 ID | 僅自己站區 | CRUD 客戶/合約/車趟 + 審核明細 |
| **站區人員** | `site_staff` | 綁定站區 ID | 僅自己站區 | 唯讀（查看所有資料但不能修改） |

### 資料模型變更

User 表新增/修改欄位：

```prisma
model User {
  // 現有欄位保留...
  role     String  @default("site_staff")  // super_admin / site_manager / site_staff
  siteId   Int?    @map("site_id")         // 綁定站區（super_admin 為 null）

  site     Site?   @relation(fields: [siteId], references: [id])
}
```

Migration 策略：
- 現有 `role` 預設值從 `admin` 改為 `super_admin`
- 現有使用者全部升級為 `super_admin` + `siteId = null`
- 新增使用者時可選擇角色和站區

### 後端權限中介層

```
三層 middleware 設計：

1. auth middleware（現有）
   → 驗證 JWT token，取得 user 資訊（含 role、siteId）

2. authorize(...roles) middleware（新增）
   → 檢查使用者角色是否在允許清單中
   → 用法：authorize('super_admin', 'site_manager')

3. siteScope middleware（新增）
   → 自動為非 super_admin 的查詢加上 siteId 過濾
   → site_manager/site_staff 只能看到自己站區的資料
   → 寫入操作也驗證目標資料屬於自己站區
```

### 各模組權限矩陣

| 功能 | super_admin | site_manager | site_staff |
|------|:-----------:|:------------:|:----------:|
| 客戶 CRUD | 全站區 | 僅自己站區 | 唯讀 |
| 合約 CRUD | 全站區 | 僅自己站區 | 唯讀 |
| 車趟 CRUD | 全站區 | 僅自己站區 | 唯讀 |
| 明細審核/寄送 | 全站區 | 僅自己站區 | 唯讀 |
| 報表匯出 | 全站區 | 僅自己站區 | 僅自己站區 |
| 站區管理 | CRUD | 唯讀 | 唯讀 |
| 品項管理 | CRUD | 唯讀 | 唯讀 |
| 行號管理 | CRUD | 唯讀 | 唯讀 |
| 使用者管理 | CRUD | 唯讀自己 | 唯讀自己 |
| 假日管理 | CRUD | 唯讀 | 唯讀 |
| Dashboard | 全站區 | 僅自己站區 | 僅自己站區 |
| 同步管理 | 可操作 | 不可見 | 不可見 |

### 前端權限控制

**JWT Payload 擴充**：

```json
{
  "userId": 1,
  "role": "site_manager",
  "siteId": 2
}
```

**AuthContext 擴充**：

```typescript
// AuthContext 提供的 helper
{
  user: { id, name, role, siteId },
  isSuperAdmin: boolean,
  isSiteManager: boolean,
  isSiteStaff: boolean,
  canEdit: boolean,       // super_admin 或 site_manager
  canManageSystem: boolean // 僅 super_admin
}
```

**UI 控制規則**：

- 選單項目依角色動態顯示/隱藏（站區人員看不到同步管理）
- 表單/按鈕依角色 disabled 或隱藏（站區人員無編輯/刪除按鈕）
- 站區篩選器：super_admin 看到所有站區、其他角色自動鎖定自己站區

---

## 三、錯誤處理

| 情境 | 處理方式 |
|------|---------|
| 未登入存取 API | 401 + 前端跳轉登入頁 |
| 角色不足 | 403 + 前端顯示「權限不足」提示 |
| 跨站區存取 | 403 + 記錄異常日誌 |
| 客戶不存在 | 404 + 前端顯示空狀態 |
| 新增客戶驗證失敗 | 400 + 表單欄位提示 |

---

## 四、測試策略

| 類型 | 範圍 |
|------|------|
| **後端單元測試** | authorize middleware、siteScope middleware、各角色的 CRUD 權限 |
| **API 整合測試** | 三種角色分別測試同一端點，驗證回傳資料和狀態碼 |
| **前端元件測試** | 不同角色的 UI 呈現（按鈕隱藏/顯示）|
| **瀏覽器測試** | 三種角色完整操作流程 |

---

## 五、向下相容

- 現有 `role` 欄位值從 `admin` 遷移為 `super_admin`（DB migration 處理）
- 現有使用者全部設為 `super_admin` + `siteId = null`
- API 回應格式不變，僅增加過濾邏輯
- 前端新增的權限檢查不影響現有 super_admin 的操作體驗

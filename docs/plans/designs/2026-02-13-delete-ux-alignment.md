# 刪除/停用/啟用 UX 對齊設計

> **日期**：2026-02-13
> **問題**：前端所有「移除」操作統一顯示「刪除」，但後端實際行為分三種（軟刪除、硬刪除、終止），使用者無法從 UI 判斷操作的真實效果

---

## 問題描述

目前系統中，不論後端是軟刪除（設 status=inactive）還是硬刪除（從資料庫移除），前端一律顯示「刪除」按鈕和「確定刪除此 X？」確認訊息。這會造成：

1. 使用者誤以為軟刪除的資料已永久消失
2. 使用者不知道可以「重新啟用」被停用的項目
3. 合約的「終止」語意被「刪除」掩蓋

## 現狀盤點

| 實體 | 後端 DELETE 行為 | 後端回應 | 前端按鈕 | 前端確認文字 | 前端成功訊息 |
|------|----------------|---------|---------|------------|------------|
| Site | 軟刪除（inactive） | `已停用` | 刪除 | 確定刪除此站區？ | 站區刪除成功 |
| Item | 軟刪除（inactive） | `已停用` | 刪除 | 確定刪除此品項？ | 品項刪除成功 |
| BusinessEntity | 軟刪除（inactive） | `已停用` | 刪除 | 確定刪除此行號？ | 行號刪除成功 |
| Customer | 軟刪除（inactive） | `已停用` | 刪除 | 確定刪除此客戶？ | 客戶刪除成功 |
| CustomerFee | 軟刪除（inactive） | `已停用` | 刪除 | 確定刪除？ | 附加費用刪除成功 |
| User | 軟刪除（inactive） | `已停用` | 刪除 | 確定刪除此使用者？ | 使用者刪除成功 |
| Contract | 設為 terminated | `已終止` | 刪除 | — | 合約刪除成功 |
| Holiday | **硬刪除** | `已刪除` | 刪除 | 確定刪除此假日？ | 假日刪除成功 |
| ContractItem | **硬刪除** | `已刪除` | 刪除 | 確定刪除此品項？ | 合約品項刪除成功 |
| Trip | **硬刪除**（含級聯） | `已刪除` | 刪除 | 確定刪除此車趟？ | 車趟刪除成功 |
| TripItem | **硬刪除** | `已刪除` | 刪除 | 確定刪除？ | 品項刪除成功 |

## 決策方案

將前端 UX 分為三種操作，精確對應後端行為：

### 1. 停用（軟刪除實體）

- **適用**：Site, Item, BusinessEntity, Customer, CustomerFee, User
- **按鈕**：`StopOutlined` 圖示 +「停用」文字（橘色 warning）
- **確認**：「確定停用此 X？停用後可重新啟用。」
- **成功訊息**：「X 已停用」
- **新增啟用操作**：已停用項目顯示 `CheckCircleOutlined` +「啟用」按鈕（綠色）
- **狀態篩選**：各列表頁新增狀態篩選器（啟用中 / 已停用 / 全部），預設「啟用中」

### 2. 刪除（硬刪除實體）

- **適用**：Holiday, ContractItem, Trip, TripItem
- **按鈕**：`DeleteOutlined` 圖示 +「刪除」文字（紅色 danger）
- **確認**：「確定刪除此 X？此操作無法復原。」
- **成功訊息**：「X 已刪除」

### 3. 終止（合約專用）

- **適用**：Contract
- **按鈕**：`CloseCircleOutlined` 圖示 +「終止」文字（紅色 danger）
- **確認**：「確定終止此合約？終止後無法恢復。」
- **成功訊息**：「合約已終止」

## 影響範圍

### Spec 文件需更新

| 文件 | 變更 |
|------|------|
| `docs/spec/ui-specs/base-data-pages.md` | Sites, Items, BusinessEntities 頁面操作按鈕規格 |
| `docs/spec/ui-specs/customer-pages.md` | Customers, CustomerFees, Contracts 操作按鈕規格 |
| `docs/spec/ui-specs/system-pages.md` | Users, Holidays 操作按鈕規格 |
| `docs/spec/ui-specs/trip-pages.md` | Trips, TripItems 操作按鈕規格 |
| `docs/spec/ui-specs/README.md` | 新增「操作按鈕語意規範」通用規則 |
| `docs/spec/business-rules/settlement-flow.md` | 軟刪除策略章節補充 UX 對應 |

### 程式碼需修改

| 檔案 | 變更 |
|------|------|
| `frontend/src/pages/SitesPage.tsx` | 停用/啟用按鈕 + 狀態篩選 |
| `frontend/src/pages/ItemsPage.tsx` | 停用/啟用按鈕 + 狀態篩選 |
| `frontend/src/pages/BusinessEntitiesPage.tsx` | 停用/啟用按鈕 + 狀態篩選 |
| `frontend/src/pages/CustomersPage.tsx` | 停用按鈕（啟用在詳情頁） |
| `frontend/src/pages/CustomerFeesTab.tsx` | 停用/啟用按鈕 |
| `frontend/src/pages/CustomerContractsTab.tsx` | 終止按鈕 |
| `frontend/src/pages/ContractsPage.tsx` | 終止按鈕 |
| `frontend/src/pages/UsersPage.tsx` | 停用/啟用按鈕 + 狀態篩選 |
| `frontend/src/pages/HolidaysPage.tsx` | 保持刪除（硬刪除，正確） |
| `frontend/src/pages/SiteTripsTab.tsx` | 保持刪除（硬刪除，正確） |
| `frontend/src/pages/TripItemsExpand.tsx` | 保持刪除（硬刪除，正確） |
| `frontend/src/api/hooks.ts` | 更新成功訊息 + 新增 reactivate hooks |

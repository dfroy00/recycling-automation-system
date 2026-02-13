# 客戶頁面規格

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §5.3 抽取

## CustomersPage `/customers`

- 資料表格：名稱、站區、類型、合約摘要、結算方式、操作
- 篩選：站區下拉、類型篩選、名稱搜尋
- 客戶名稱為超連結，點擊導航到 `/customers/:id` 詳情頁
- 「新增客戶」按鈕 → 導航到 `/customers/new`
- **不使用 Modal 編輯**，所有編輯在詳情頁完成

## CustomerDetailPage `/customers/:id`

### Tab 架構

**Tab 架構**，5 個分頁：

| Tab | 內容 | 說明 |
|-----|------|------|
| 基本資料 | 客戶所有設定欄位（inline 表單） | 可直接編輯並儲存（可編輯角色） |
| 合約管理 | 該客戶的合約列表 + 新增/編輯合約 + 合約品項 | customerId 自動帶入 |
| 附加費用 | 費用列表 + 新增/編輯 | 從原 CustomersPage Modal 獨立出來 |
| 車趟紀錄 | 該客戶的車趟歷史（唯讀） | 支援月份篩選 |
| 結算明細 | 該客戶的月結/按趟明細（唯讀） | 支援月份篩選 |

### 行為規則

- 各 Tab 懶載入：切換到該 Tab 時才發請求
- `/customers/new`：新增模式，只顯示基本資料 Tab
- 「返回列表」按鈕導航回 `/customers`
- `site_staff` 角色：表單 disabled，無儲存按鈕

## ContractsPage `/contracts`（合約總覽，僅 super_admin 可見）

- 資料表格：合約編號、客戶、起訖日期、狀態、操作
- 篩選：客戶下拉、狀態篩選
- 客戶名稱為超連結，導航到 `/customers/:id?tab=contracts`
- 供系統管理員跨客戶檢視所有合約（如篩選即將到期合約）

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [客戶分類業務規則](../business-rules/customer-classification.md)
- [UI 規格索引](./README.md)

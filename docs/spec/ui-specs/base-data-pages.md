# 基礎資料頁面規格

> **版本**：3.0
> **日期**：2026-02-13

## LoginPage `/login`

- 登入表單：帳號 + 密碼 + 登入按鈕
- 登入成功後導向 `/dashboard`
- 不需認證即可存取

## SitesPage `/sites`

- 資料表格：名稱、地址、電話、狀態、操作（編輯 / 停用 or 啟用 / 刪除）
- 狀態篩選器：啟用中（預設）/ 已停用 / 全部
- 新增按鈕 → Modal 表單
- 編輯 → Modal 表單
- 停用 → Popconfirm「確定停用此站區？停用後可重新啟用。」→ `PATCH deactivate`（`StopOutlined` warning 色）
- 啟用 → 已停用項目顯示「啟用」按鈕（`CheckCircleOutlined` 綠色）→ `PATCH reactivate` 恢復 active
- 刪除 → Popconfirm「確定刪除此站區？此操作無法復原。」→ `DELETE` 硬刪除（`DeleteOutlined` danger 色）

## ItemsPage `/items`

- 資料表格：品項編號(id)、名稱、分類、單位、狀態、操作（編輯 / 停用 or 啟用 / 刪除）
- 狀態篩選器：啟用中（預設）/ 已停用 / 全部
- 支援分類篩選
- 新增 / 編輯 → Modal 表單
- 停用 → Popconfirm「確定停用此品項？停用後可重新啟用。」→ `PATCH deactivate`（`StopOutlined` warning 色）
- 啟用 → 已停用項目顯示「啟用」按鈕（`CheckCircleOutlined` 綠色）→ `PATCH reactivate` 恢復 active
- 刪除 → Popconfirm「確定刪除此品項？此操作無法復原。」→ `DELETE` 硬刪除（`DeleteOutlined` danger 色）

## BusinessEntitiesPage `/business-entities`

- 資料表格：名稱、統一編號、營業項目、狀態、操作（編輯 / 停用 or 啟用 / 刪除）
- 狀態篩選器：啟用中（預設）/ 已停用 / 全部
- 新增 / 編輯 → Modal 表單
- 停用 → Popconfirm「確定停用此行號？停用後可重新啟用。」→ `PATCH deactivate`（`StopOutlined` warning 色）
- 啟用 → 已停用項目顯示「啟用」按鈕（`CheckCircleOutlined` 綠色）→ `PATCH reactivate` 恢復 active
- 刪除 → Popconfirm「確定刪除此行號？此操作無法復原。」→ `DELETE` 硬刪除（`DeleteOutlined` danger 色）

## LoginPage 錯誤提示

| 場景 | 錯誤訊息 | 顯示方式 |
|------|---------|---------|
| 帳號或密碼為空 | 「請輸入{欄位名稱}」 | 欄位下方紅色文字 |
| 帳號或密碼錯誤 | 「帳號或密碼錯誤」 | Alert 元件顯示在表單上方 |
| 帳號已停用 | 「此帳號已停用，請聯繫管理員」 | Alert 元件顯示在表單上方 |
| API 無回應 | 「系統連線失敗，請稍後再試」 | Alert 元件顯示在表單上方 |

- 登入按鈕在 API 請求期間顯示 loading 狀態
- 按 Enter 鍵等同點擊登入按鈕

## 各 CRUD 頁面表單驗證規則

### SitesPage 表單驗證

| 欄位 | 規則 | 錯誤訊息 |
|------|------|---------|
| 名稱 | 必填、最長 50 字 | 「請輸入站區名稱」/「名稱不得超過 50 字」 |
| 地址 | 必填、最長 200 字 | 「請輸入地址」/「地址不得超過 200 字」 |
| 電話 | 選填、格式驗證 `^[0-9\-()+ ]{7,20}$` | 「電話格式不正確」 |

### ItemsPage 表單驗證

| 欄位 | 規則 | 錯誤訊息 |
|------|------|---------|
| 名稱 | 必填、最長 50 字 | 「請輸入品項名稱」/「名稱不得超過 50 字」 |
| 分類 | 必填 | 「請選擇分類」 |
| 單位 | 必填 | 「請選擇單位」 |

### BusinessEntitiesPage 表單驗證

| 欄位 | 規則 | 錯誤訊息 |
|------|------|---------|
| 名稱 | 必填、最長 100 字 | 「請輸入行號名稱」/「名稱不得超過 100 字」 |
| 統一編號 | 必填、8 位數字 | 「請輸入統一編號」/「統一編號須為 8 位數字」 |
| 營業項目 | 選填、最長 200 字 | 「營業項目不得超過 200 字」 |

### 通用驗證行為

- 驗證時機：欄位 `onBlur` 時觸發單欄驗證，送出時觸發全表單驗證
- 錯誤顯示：欄位下方紅色文字 + 欄位外框變紅
- API 回傳 400 + `details` 時，對應欄位顯示後端錯誤訊息
- 表單未通過驗證時，送出按鈕不禁用，但點擊後自動滾動到第一個錯誤欄位

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [UI 規格索引](./README.md)
- [軟刪除策略](../business-rules/settlement-flow.md#軟刪除策略)

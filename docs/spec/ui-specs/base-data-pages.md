# 基礎資料頁面規格

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §5.3 抽取

## LoginPage `/login`

- 登入表單：帳號 + 密碼 + 登入按鈕
- 登入成功後導向 `/dashboard`
- 不需認證即可存取

## SitesPage `/sites`

- 資料表格：名稱、地址、電話、狀態、操作（編輯 / 停用 or 啟用）
- 狀態篩選器：啟用中（預設）/ 已停用 / 全部
- 新增按鈕 → Modal 表單
- 編輯 → Modal 表單
- 停用 → Popconfirm「確定停用此站區？停用後可重新啟用。」→ 軟刪除（`StopOutlined` warning 色）
- 啟用 → 已停用項目顯示「啟用」按鈕（`CheckCircleOutlined` 綠色）→ `PATCH` 恢復 active

## ItemsPage `/items`

- 資料表格：品項編號(id)、名稱、分類、單位、狀態、操作（編輯 / 停用 or 啟用）
- 狀態篩選器：啟用中（預設）/ 已停用 / 全部
- 支援分類篩選
- 新增 / 編輯 → Modal 表單
- 停用 → Popconfirm「確定停用此品項？停用後可重新啟用。」→ 軟刪除（`StopOutlined` warning 色）
- 啟用 → 已停用項目顯示「啟用」按鈕（`CheckCircleOutlined` 綠色）→ `PATCH` 恢復 active

## BusinessEntitiesPage `/business-entities`

- 資料表格：名稱、統一編號、營業項目、狀態、操作（編輯 / 停用 or 啟用）
- 狀態篩選器：啟用中（預設）/ 已停用 / 全部
- 新增 / 編輯 → Modal 表單
- 停用 → Popconfirm「確定停用此行號？停用後可重新啟用。」→ 軟刪除（`StopOutlined` warning 色）
- 啟用 → 已停用項目顯示「啟用」按鈕（`CheckCircleOutlined` 綠色）→ `PATCH` 恢復 active

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [UI 規格索引](./README.md)
- [軟刪除策略](../business-rules/settlement-flow.md#軟刪除策略)

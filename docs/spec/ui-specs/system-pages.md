# 系統管理頁面規格

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §5.3 抽取

## DashboardPage `/dashboard`

- 統計卡片（4 格）：本月車趟數、應收總額、應付總額、待審明細數
- 合約到期提醒列表
- 待審明細列表

## SyncPage `/sync`

- Adapter 連線狀態卡片（POS / 車機）
- 操作按鈕：POS 拉取、車機拉取、產生 Mock 資料
- 同步結果顯示

## UsersPage `/users`（僅 super_admin 可見）

- 資料表格：帳號、姓名、Email、角色、所屬站區、狀態、操作（編輯 / 停用 or 啟用 / 刪除）
- 狀態篩選器：啟用中（預設）/ 已停用 / 全部
- 新增 / 編輯 → Modal 表單
- 角色選擇：super_admin / site_manager / site_staff
- 非 super_admin 角色需選擇所屬站區
- 停用 → Popconfirm「確定停用此使用者？停用後可重新啟用。」→ `PATCH deactivate`（`StopOutlined` warning 色）
- 啟用 → 已停用項目顯示「啟用」按鈕（`CheckCircleOutlined` 綠色）→ `PATCH reactivate` 恢復 active
- 刪除 → Popconfirm「確定刪除此使用者？此操作無法復原。」→ `DELETE` 硬刪除（`DeleteOutlined` danger 色）

## HolidaysPage `/holidays`

- 年份篩選
- 假日列表表格：日期、名稱、操作（刪除）
- 刪除 → Popconfirm「確定刪除此假日？此操作無法復原。」（`DeleteOutlined` danger 色，硬刪除）
- 新增單筆 + 批次匯入

## SchedulePage `/schedule`

- 排程列表：名稱、Cron 表達式、說明、狀態
- 手動觸發按鈕

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [軟刪除策略](../business-rules/settlement-flow.md#軟刪除策略)
- [UI 規格索引](./README.md)

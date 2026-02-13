# 基礎資料頁面規格

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §5.3 抽取

## LoginPage `/login`

- 登入表單：帳號 + 密碼 + 登入按鈕
- 登入成功後導向 `/dashboard`
- 不需認證即可存取

## SitesPage `/sites`

- 資料表格：名稱、地址、電話、狀態、操作（編輯 / 刪除）
- 新增按鈕 → Modal 表單
- 編輯 → Modal 表單
- 刪除 → Popconfirm 確認 → 軟刪除

## ItemsPage `/items`

- 資料表格：品項編號(id)、名稱、分類、單位、狀態、操作
- 支援分類篩選
- 新增 / 編輯 → Modal 表單

## BusinessEntitiesPage `/business-entities`

- 資料表格：名稱、統一編號、營業項目、狀態、操作
- 新增 / 編輯 → Modal 表單

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [UI 規格索引](./README.md)
- [軟刪除策略](../business-rules/settlement-flow.md#軟刪除策略)

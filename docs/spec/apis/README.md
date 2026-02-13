# API 契約 — 通用規則

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.0 抽取

## 認證

除 `POST /api/auth/login` 外，所有 API 需攜帶 `Authorization: Bearer <JWT>` 標頭。

## 授權中介層

三層設計：

| 層級 | 中介層 | 說明 |
|------|--------|------|
| 1 | `authMiddleware` | 驗證 JWT token，解析 userId、role、siteId |
| 2 | `authorize(...roles)` | 檢查使用者角色是否在允許清單中，不符回傳 403 |
| 3 | `siteScope()` | 非 super_admin 自動注入 siteId 過濾，限制資料範圍 |

## 各路由權限矩陣

| 路由 | GET（讀取） | POST/PATCH/DELETE（寫入） |
|------|-----------|------------------------|
| customers | 所有角色 + siteScope | super_admin + site_manager + siteScope |
| contracts | 所有角色 + siteScope | super_admin + site_manager + siteScope |
| trips | 所有角色 + siteScope | super_admin + site_manager + siteScope |
| statements | 所有角色 + siteScope | super_admin + site_manager + siteScope |
| sites | 所有角色 | 僅 super_admin |
| items | 所有角色 | 僅 super_admin |
| users | 僅 super_admin | 僅 super_admin |
| holidays | 所有角色 | 僅 super_admin |
| dashboard | 所有角色 + siteScope | N/A |
| sync | 僅 super_admin | 僅 super_admin |
| business-entities | 所有角色 | 僅 super_admin |

## 分頁回傳格式

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

- 預設 `pageSize=20`，最大 100
- `?all=true` 取消分頁，回傳純陣列（最大 1000 筆），用於下拉選單

## 錯誤回傳格式

```json
{
  "error": "錯誤訊息"
}
```

## 常見 HTTP 狀態碼

- `200`：成功
- `201`：建立成功
- `202`：已接受（非同步處理）
- `400`：請求錯誤（驗證失敗）
- `401`：未認證
- `404`：資源不存在
- `409`：衝突（唯一值重複）
- `429`：速率限制
- `500`：伺服器錯誤
- `503`：服務不可用（報表並發限制）

## 軟刪除策略

詳見 [軟刪除策略](../business-rules/settlement-flow.md)

## API 索引

| 檔案 | 說明 | 對應章節 |
|------|------|----------|
| [auth.md](./auth.md) | 認證 | §3.1 |
| [base-data.md](./base-data.md) | 站區 / 品項 / 行號 | §3.2 + §3.3 + §3.4 |
| [customers.md](./customers.md) | 客戶（含 fees 子資源） | §3.5 |
| [contracts.md](./contracts.md) | 合約（含 items 子資源） | §3.6 |
| [trips.md](./trips.md) | 車趟（含 items 子資源） | §3.7 |
| [statements.md](./statements.md) | 月結明細 | §3.8 |
| [reports.md](./reports.md) | 報表 | §3.9 |
| [dashboard.md](./dashboard.md) | 儀表板 | §3.10 |
| [users.md](./users.md) | 使用者 | §3.11 |
| [holidays.md](./holidays.md) | 假日 | §3.12 |
| [schedule.md](./schedule.md) | 排程 | §3.13 |
| [sync.md](./sync.md) | 同步 | §3.14 |

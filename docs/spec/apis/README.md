# API 契約 — 通用規則

> **版本**：3.0
> **日期**：2026-02-13

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

### 一般錯誤

```json
{
  "error": "錯誤訊息"
}
```

### 驗證錯誤（400）

欄位級別的錯誤回傳，讓前端可逐欄顯示錯誤提示：

```json
{
  "error": "驗證失敗",
  "details": {
    "name": "名稱為必填欄位",
    "email": "Email 格式不正確",
    "siteId": "請選擇所屬站區"
  }
}
```

- `error`：概括性錯誤訊息
- `details`：物件，key 為欄位名稱（對應 request body 的欄位），value 為該欄位的錯誤訊息
- 前端使用 Ant Design Form 的 `setFields()` 方法，將 `details` 中的錯誤對應到各表單欄位下方顯示

### 權限不足錯誤（403）

```json
{
  "error": "權限不足",
  "requiredRole": "super_admin",
  "currentRole": "site_staff"
}
```

### 速率限制錯誤（429）

```json
{
  "error": "操作過於頻繁，請稍後再試"
}
```

回應標頭：
- `Retry-After: <秒數>`（建議預設 60 秒）
- `X-RateLimit-Limit: <上限>`
- `X-RateLimit-Remaining: 0`

## 常見 HTTP 狀態碼與標準中文錯誤訊息

| 狀態碼 | 說明 | 標準錯誤訊息 |
|-------|------|------------|
| `200` | 成功 | — |
| `201` | 建立成功 | — |
| `202` | 已接受（非同步處理） | — |
| `400` | 請求錯誤（驗證失敗） | 「驗證失敗」+ `details` 欄位明細 |
| `401` | 未認證 | 「未提供有效的認證資訊」 |
| `403` | 權限不足 | 「權限不足，無法執行此操作」 |
| `404` | 資源不存在 | 「找不到指定的{資源名稱}」 |
| `409` | 衝突（唯一值重複 / FK 約束） | 依情境：「{欄位}已存在」或「無法刪除：此{實體}仍有關聯資料」 |
| `429` | 速率限制 | 「操作過於頻繁，請稍後再試」 |
| `500` | 伺服器錯誤 | 「系統發生錯誤，請稍後再試」 |
| `503` | 服務不可用（報表並發限制） | 「服務暫時不可用，請稍後再試」 |

### 前端統一錯誤處理

前端在 API Client 的 response interceptor 中統一處理：

```
1. 401 → 清除 token → 導向 /login → Toast「登入已過期，請重新登入」
2. 403 → Toast「您沒有權限執行此操作」
3. 400 + details → 表單欄位級別錯誤顯示
4. 400 無 details → Toast 顯示 error 訊息
5. 404/409/429/500/503 → Toast 顯示 error 訊息
6. 網路錯誤 → Toast「網路連線異常，請檢查網路狀態」
```

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

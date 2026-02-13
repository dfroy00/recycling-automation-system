# 使用者 `/api/users`

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.11 抽取

## 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/users` | 列表（**不分頁**，回傳純陣列） |
| GET | `/api/users/:id` | 詳情 |
| POST | `/api/users` | 新增 |
| PATCH | `/api/users/:id` | 更新 |
| DELETE | `/api/users/:id` | 軟刪除 |

## POST Request Body

```json
{ "username": "user1", "password": "Password1", "name": "使用者一", "email": "user1@example.com" }
```

## 規則

**密碼策略**：最少 8 字元，至少包含 1 個數字。

**回應永遠排除** `passwordHash` 欄位。

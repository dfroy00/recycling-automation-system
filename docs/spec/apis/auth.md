# 認證 `/api/auth`

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.1 抽取

## POST /api/auth/login

登入取得 JWT Token。**不需認證**。

**Request Body**：

```json
{ "username": "admin", "password": "admin123" }
```

**200 Response**：

```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "username": "admin", "name": "系統管理員", "role": "super_admin", "siteId": null }
}
```

**401 Response**：帳號或密碼錯誤、使用者已停用

**速率限制**：5 次 / 分鐘 / IP

## GET /api/auth/me

取得當前登入使用者資訊。

**200 Response**：

```json
{ "id": 1, "username": "admin", "name": "系統管理員", "email": null, "role": "super_admin", "siteId": null }
```

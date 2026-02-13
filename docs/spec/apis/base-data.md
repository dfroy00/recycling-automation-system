# 基礎資料 — 站區 / 品項 / 行號

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.2 + §3.3 + §3.4 抽取

---

## 站區 `/api/sites`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/sites` | 列表（支援分頁，`?all=true` 回傳陣列） |
| GET | `/api/sites/:id` | 詳情 |
| POST | `/api/sites` | 新增 |
| PATCH | `/api/sites/:id` | 更新 |
| DELETE | `/api/sites/:id` | 軟刪除（設為 inactive） |

**POST Request Body**：

```json
{ "name": "新竹站", "address": "新竹市...", "phone": "03-1234567" }
```

- `name`：必填

**DELETE Response**：

```json
{ "message": "已停用" }
```

**錯誤**：`409` 名稱已存在

---

## 品項 `/api/items`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/items` | 列表（`?category&status&all=true`） |
| GET | `/api/items/:id` | 詳情 |
| POST | `/api/items` | 新增 |
| PATCH | `/api/items/:id` | 更新 |
| DELETE | `/api/items/:id` | 軟刪除 |

**POST Request Body**：

```json
{ "name": "總紙", "unit": "kg", "category": "紙類" }
```

- `name`、`unit`：必填

---

## 行號 `/api/business-entities`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/business-entities` | 列表（支援分頁） |
| GET | `/api/business-entities/:id` | 詳情 |
| POST | `/api/business-entities` | 新增 |
| PATCH | `/api/business-entities/:id` | 更新 |
| DELETE | `/api/business-entities/:id` | 軟刪除 |

**POST Request Body**：

```json
{ "name": "和東", "taxId": "12345678", "bizItems": "資源回收" }
```

- `name`、`taxId`：必填

**錯誤**：`409` 名稱或統一編號已存在

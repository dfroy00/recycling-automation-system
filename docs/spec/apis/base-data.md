# 基礎資料 — 站區 / 品項 / 行號

> **版本**：3.0
> **日期**：2026-02-13

---

## 站區 `/api/sites`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/sites` | 列表（支援分頁，`?all=true` 回傳陣列） |
| GET | `/api/sites/:id` | 詳情 |
| POST | `/api/sites` | 新增 |
| PATCH | `/api/sites/:id` | 更新 |
| PATCH | `/api/sites/:id/deactivate` | 停用（設為 inactive） |
| PATCH | `/api/sites/:id/reactivate` | 啟用（恢復 active） |
| DELETE | `/api/sites/:id` | 硬刪除（永久移除，FK 失敗回 409） |

**POST Request Body**：

```json
{ "name": "新竹站", "address": "新竹市...", "phone": "03-1234567" }
```

- `name`：必填

**PATCH deactivate Response**：`{ "message": "已停用" }`

**DELETE Response**：`{ "message": "已刪除" }`

**錯誤**：
- `409` 名稱已存在
- `409`（DELETE）「無法刪除：此站區下仍有關聯資料」

---

## 品項 `/api/items`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/items` | 列表（`?category&status&all=true`） |
| GET | `/api/items/:id` | 詳情 |
| POST | `/api/items` | 新增 |
| PATCH | `/api/items/:id` | 更新 |
| PATCH | `/api/items/:id/deactivate` | 停用（設為 inactive） |
| PATCH | `/api/items/:id/reactivate` | 啟用（恢復 active） |
| DELETE | `/api/items/:id` | 硬刪除（FK 失敗回 409：「無法刪除：此品項仍有關聯的合約或車趟」） |

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
| PATCH | `/api/business-entities/:id/deactivate` | 停用（設為 inactive） |
| PATCH | `/api/business-entities/:id/reactivate` | 啟用（恢復 active） |
| DELETE | `/api/business-entities/:id` | 硬刪除（FK 失敗回 409：「無法刪除：此行號仍有關聯的客戶或明細」） |

**POST Request Body**：

```json
{ "name": "和東", "taxId": "12345678", "bizItems": "資源回收" }
```

- `name`、`taxId`：必填

**錯誤**：`409` 名稱或統一編號已存在

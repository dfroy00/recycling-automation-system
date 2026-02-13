# 車趟 `/api/trips`

> **版本**：3.0
> **日期**：2026-02-13

## 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/trips` | 列表（`?customerId&siteId&dateFrom&dateTo&all=true`），include customer + site + items |
| GET | `/api/trips/:id` | 詳情（include 完整關聯） |
| POST | `/api/trips` | 新增 |
| PATCH | `/api/trips/:id` | 更新 |
| DELETE | `/api/trips/:id` | **硬刪除**（先刪 items） |

## POST Request Body

```json
{
  "customerId": 1,
  "siteId": 1,
  "tripDate": "2026-01-15",
  "tripTime": "08:30",
  "driver": "張三",
  "vehiclePlate": "ABC-1234",
  "notes": ""
}
```

---

## 車趟品項 `/api/trips/:id/items`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/trips/:id/items` | 列表（include item） |
| POST | `/api/trips/:id/items` | 新增（含快照邏輯，見[業務規則 4.2](../business-rules/billing-engine.md)） |
| PATCH | `/api/trips/:tid/items/:iid` | 更新 |
| DELETE | `/api/trips/:tid/items/:iid` | 刪除 |

### POST Request Body

```json
{ "itemId": 1, "quantity": 150.5, "unitPrice": 3.5, "billingDirection": "payable" }
```

- `unitPrice` 和 `billingDirection`：簽約客戶可不填（自動從合約帶入），臨時客戶必填

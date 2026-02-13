# 合約 `/api/contracts`

> **版本**：3.0
> **日期**：2026-02-13

## 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/contracts` | 列表（`?customerId&status&all=true`），include customer + items |
| GET | `/api/contracts/:id` | 詳情（include customer + items.item） |
| POST | `/api/contracts` | 新增 |
| PATCH | `/api/contracts/:id` | 更新 |
| DELETE | `/api/contracts/:id` | 終止（設為 terminated） |

## POST Request Body

```json
{
  "customerId": 1,
  "contractNumber": "C-2026-001",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "status": "active",
  "notes": "年約"
}
```

---

## 合約品項 `/api/contracts/:id/items`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/contracts/:id/items` | 列表（include item） |
| POST | `/api/contracts/:id/items` | 新增 |
| PATCH | `/api/contracts/:cid/items/:iid` | 更新 |
| DELETE | `/api/contracts/:cid/items/:iid` | **硬刪除** |

### POST Request Body

```json
{ "itemId": 1, "unitPrice": 3.5, "billingDirection": "payable" }
```

- `billingDirection`：`receivable` / `payable` / `free`

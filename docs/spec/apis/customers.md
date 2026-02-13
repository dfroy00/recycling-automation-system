# 客戶 `/api/customers`

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.5 抽取

## 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/customers` | 列表（`?siteId&type&status&all=true`），include site 資訊 |
| GET | `/api/customers/:id` | 詳情（include site + active fees） |
| POST | `/api/customers` | 新增 |
| PATCH | `/api/customers/:id` | 更新 |
| PATCH | `/api/customers/:id/deactivate` | 停用（設為 inactive） |
| PATCH | `/api/customers/:id/reactivate` | 啟用（恢復 active） |
| DELETE | `/api/customers/:id` | 硬刪除（FK 失敗回 409：「無法刪除：此客戶仍有關聯的合約、車趟或明細」） |

## POST Request Body

```json
{
  "siteId": 1,
  "name": "大明企業",
  "contactPerson": "王大明",
  "phone": "02-12345678",
  "address": "台北市...",
  "type": "contracted",
  "tripFeeEnabled": true,
  "tripFeeType": "per_trip",
  "tripFeeAmount": 500,
  "statementType": "monthly",
  "paymentType": "lump_sum",
  "statementSendDay": 15,
  "paymentDueDay": 15,
  "invoiceRequired": true,
  "invoiceType": "net",
  "notificationMethod": "email",
  "notificationEmail": "daming@example.com",
  "businessEntityId": 1
}
```

## 驗證規則

1. `siteId`、`name`、`type` 必填
2. `type` 必須是 `contracted` 或 `temporary`
3. 若 `statementType = 'per_trip'`，強制 `paymentType = 'lump_sum'`
4. 若 `tripFeeEnabled = true`，`tripFeeType` 和 `tripFeeAmount` 必填
5. 若 `invoiceRequired = true`，`businessEntityId` 必填

---

## 客戶附加費用 `/api/customers/:id/fees`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/customers/:id/fees` | 列表 |
| POST | `/api/customers/:id/fees` | 新增 |
| PATCH | `/api/customers/:cid/fees/:fid` | 更新 |
| PATCH | `/api/customers/:cid/fees/:fid/deactivate` | 停用（設為 inactive） |
| PATCH | `/api/customers/:cid/fees/:fid/reactivate` | 啟用（恢復 active） |
| DELETE | `/api/customers/:cid/fees/:fid` | 硬刪除（永久移除） |

### POST Request Body

```json
{ "name": "處理費", "amount": 1000, "billingDirection": "receivable", "frequency": "monthly" }
```

### 驗證規則

- `billingDirection`：`receivable` 或 `payable`
- `frequency`：`monthly` 或 `per_trip`
- 按趟結算客戶只能使用 `frequency = 'per_trip'`

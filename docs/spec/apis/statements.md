# 月結明細 `/api/statements`

> **版本**：3.0
> **日期**：2026-02-13

## 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/statements` | 列表（`?yearMonth&status&customerId`），include customer |
| GET | `/api/statements/:id` | 詳情（include customer + trip） |
| POST | `/api/statements/generate` | 產出月結明細 |
| POST | `/api/statements/generate-trip` | 產出按趟明細 |
| PATCH | `/api/statements/:id/review` | 審核 |
| PATCH | `/api/statements/:id/invoice` | 標記開票 |
| POST | `/api/statements/:id/send` | 寄送 |
| POST | `/api/statements/:id/void` | 作廢 |

---

## POST /api/statements/generate

**Request Body**：

```json
{ "yearMonth": "2026-01", "customerId": 1 }
```

- `yearMonth`：必填
- `customerId`：可選。有提供 → 同步回傳 `201`；未提供 → 批次產出，立即回傳 `202`（背景非同步處理）

---

## POST /api/statements/generate-trip

**Request Body**：

```json
{ "tripId": 1 }
```

---

## PATCH /api/statements/:id/review

**Request Body**：

```json
{ "action": "approve" }
```

- `action`：`approve` 或 `reject`
- 只有 `draft` 狀態可以審核

---

## PATCH /api/statements/:id/invoice

- 無 Request Body
- 只有 `approved` 狀態可以標記開票

---

## POST /api/statements/:id/send

- 無 Request Body
- 寄送規則見[業務規則 — 結算流程](../business-rules/settlement-flow.md)

---

## POST /api/statements/:id/void

**Request Body**：

```json
{ "reason": "金額有誤，需重新計算" }
```

- `reason`：必填
- 只有 `sent` 或 `invoiced` 狀態可以作廢

# 客戶與合約模型：Customer / CustomerFee / Contract / ContractItem

> **版本**：3.0
> **日期**：2026-02-13

## Customer（客戶主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| siteId | Int | FK → Site | 所屬站區 |
| name | String | | 客戶名稱 |
| contactPerson | String | 選填 | 聯絡人 |
| phone | String | 選填 | 電話 |
| address | String | 選填 | 地址 |
| type | String | | `contracted`（簽約）/ `temporary`（臨時） |
| tripFeeEnabled | Boolean | default: false | 是否收車趟費 |
| tripFeeType | String | 選填 | `per_trip`（按次）/ `per_month`（按月） |
| tripFeeAmount | Decimal(10,2) | 選填 | 車趟費金額 |
| statementType | String | default: "monthly" | `monthly`（月結）/ `per_trip`（按趟） |
| paymentType | String | default: "lump_sum" | `lump_sum`（一次付清）/ `per_trip`（按趟分付） |
| statementSendDay | Int | 選填, default: 15 | 明細寄送日（每月幾號） |
| paymentDueDay | Int | 選填, default: 15 | 付款到期日 |
| invoiceRequired | Boolean | default: false | 是否需開立發票 |
| invoiceType | String | 選填, default: "net" | `net`（淨額開票）/ `separate`（分開開票） |
| notificationMethod | String | default: "email" | `email` / `line` / `both` |
| notificationEmail | String | 選填 | 通知 Email |
| notificationLineId | String | 選填 | LINE ID |
| paymentAccount | String | 選填 | 匯款帳戶資訊 |
| businessEntityId | Int | 選填, FK → BusinessEntity | 開票行號 |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`site`, `businessEntity?`, `contracts[]`, `fees[]`, `trips[]`, `statements[]`

### 有效的結算組合

| statementType | paymentType | 允許？ |
|---------------|-------------|--------|
| monthly | lump_sum | ✅ |
| monthly | per_trip | ✅ |
| per_trip | lump_sum | ✅ |
| per_trip | per_trip | ❌ 不提供 |

---

## CustomerFee（客戶附加費用）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| name | String | | 費用名稱（自由輸入） |
| amount | Decimal(10,2) | | 固定金額 |
| billingDirection | String | | `receivable`（應收）/ `payable`（應付） |
| frequency | String | | `monthly`（按月）/ `per_trip`（按趟） |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**約束**：按趟結算客戶（`statementType = 'per_trip'`）的附加費用只允許 `frequency = 'per_trip'`。

---

## Contract（合約）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| contractNumber | String | unique | 合約編號 |
| startDate | Date | | 起始日 |
| endDate | Date | | 到期日 |
| status | String | default: "draft" | `draft` / `active` / `expired` / `terminated` |
| notes | String | 選填 | 備註 |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`customer`, `items[]`

### Contract 狀態機

```
draft ──> active ──> expired
  │                    │
  └──> terminated <────┘
```

---

## ContractItem（合約品項 — 計費核心）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| contractId | Int | FK → Contract | |
| itemId | Int | FK → Item | |
| unitPrice | Decimal(10,2) | | 合約單價 |
| billingDirection | String | | `receivable` / `payable` / `free` |

**關聯**：`contract`, `item`

> 計費邏輯詳見 [計費引擎](../business-rules/billing-engine.md)。

---

## 相關索引

| 資料表 | 索引欄位 | 目的 |
|--------|---------|------|
| contractItems | (contractId) | 合約品項查詢 |

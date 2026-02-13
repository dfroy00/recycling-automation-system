# 結算明細模型：Statement

> **版本**：3.0
> **日期**：2026-02-13

## Statement（結算明細）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| statementType | String | | `monthly` / `per_trip` |
| tripId | Int | 選填, FK → Trip | 僅 per_trip 使用 |
| yearMonth | String | | 結算月份（如 "2026-01"） |
| itemReceivable | Decimal(12,2) | | 品項應收小計 |
| itemPayable | Decimal(12,2) | | 品項應付小計 |
| tripFeeTotal | Decimal(12,2) | | 車趟費合計 |
| additionalFeeReceivable | Decimal(12,2) | | 應收附加費用合計 |
| additionalFeePayable | Decimal(12,2) | | 應付附加費用合計 |
| totalReceivable | Decimal(12,2) | | 應收合計 |
| totalPayable | Decimal(12,2) | | 應付合計 |
| netAmount | Decimal(12,2) | | 淨額（應收 - 應付） |
| subtotal | Decimal(12,2) | | 小計 |
| taxAmount | Decimal(12,2) | | 稅額（5%） |
| totalAmount | Decimal(12,2) | | 總額 |
| receivableSubtotal | Decimal(12,2) | 選填 | 分開開票：應收小計 |
| receivableTax | Decimal(12,2) | 選填 | 分開開票：應收稅額 |
| receivableTotal | Decimal(12,2) | 選填 | 分開開票：應收總額 |
| payableSubtotal | Decimal(12,2) | 選填 | 分開開票：應付小計 |
| payableTax | Decimal(12,2) | 選填 | 分開開票：應付稅額 |
| payableTotal | Decimal(12,2) | 選填 | 分開開票：應付總額 |
| detailJson | Json | 選填 | 完整明細 JSON 快照 |
| status | String | default: "draft" | 見狀態機 |
| reviewedBy | Int | 選填, FK → User | 審核者 |
| reviewedAt | DateTime | 選填 | 審核時間 |
| sentAt | DateTime | 選填 | 寄送時間 |
| sentMethod | String | 選填 | `email` / `line` |
| sendRetryCount | Int | default: 0 | 寄送重試次數（最大 3） |
| sendError | String | 選填 | 最後一次寄送失敗原因 |
| voidedAt | DateTime | 選填 | 作廢時間 |
| voidedBy | Int | 選填, FK → User | 作廢者 |
| voidReason | String | 選填 | 作廢原因 |
| businessEntityId | Int | 選填, FK → BusinessEntity | 快照：產出時的開票行號 |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

---

## Statement 狀態機

```
                    ┌───── rejected
                    │         │
                    │    （修正後重新產出）
                    │         │
draft ──> approved ──> invoiced ──> sent
              │                      │
              │        ┌─────────────┘
              │        │
              └──> sent ──> voided
              │              ▲
              └──> invoiced ──┘
```

### 流程說明

- **需開票客戶流程**：`draft → approved → invoiced → sent`
- **不需開票客戶流程**：`draft → approved → sent`
- **退回重做**：`approved → rejected`，修正後刪除 rejected 明細重新產出
- **作廢**：`sent → voided` 或 `invoiced → voided`

> 結算計算邏輯詳見 [計費引擎](../business-rules/billing-engine.md)。

---

## 相關索引

| 資料表 | 索引欄位 | 目的 |
|--------|---------|------|
| statements | (customerId, yearMonth, status) | 防重複 + 查詢 |

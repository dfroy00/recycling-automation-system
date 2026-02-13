# 車趟品項快照邏輯

> **版本**：3.0
> **日期**：2026-02-13

## 單價與方向來源決定

新增車趟品項時，系統自動決定單價和方向的來源：

```
客戶類型？
├─ contracted（簽約）
│   └─ 查找該客戶有效合約（active，日期區間內）的 ContractItem
│       ├─ 找到 → 使用合約的 unitPrice 和 billingDirection
│       └─ 找不到 → 降級為手動輸入（request 必須提供）
│
└─ temporary（臨時）
    └─ 必須手動提供 unitPrice 和 billingDirection
```

## amount 計算

- `billingDirection = 'free'` → `amount = 0`
- 其他 → `amount = unitPrice × quantity`

## 驗收條件

### 快照邏輯

- [ ] Given: 一個 `contracted` 客戶有有效合約，合約品項 A 的單價為 100、方向為 `receivable`。When: 新增車趟品項選擇品項 A，數量為 5。Then: TripItem 的 `unitPrice` = 100、`billingDirection` = `receivable`、`amount` = 500（自動快照合約價）。

- [ ] Given: 一個 `contracted` 客戶有有效合約，但合約中無品項 B。When: 新增車趟品項選擇品項 B，手動輸入單價 200、方向 `payable`，數量 3。Then: TripItem 的 `unitPrice` = 200、`billingDirection` = `payable`、`amount` = 600（降級為手動輸入）。

- [ ] Given: 一個 `temporary` 客戶。When: 新增車趟品項時未提供 `unitPrice` 或 `billingDirection`。Then: API 回傳 400 驗證錯誤。

- [ ] Given: 任意客戶新增車趟品項，`billingDirection` = `free`。When: 品項建立成功。Then: `amount` = 0，無論 `unitPrice` 和 `quantity` 為何值。

## 相關規格

- [客戶分類](./customer-classification.md)
- [計費引擎](./billing-engine.md)
- [車趟頁面 UI 規格](../ui-specs/trip-pages.md)

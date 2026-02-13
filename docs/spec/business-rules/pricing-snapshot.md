# 車趟品項快照邏輯

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §4.2 抽取

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

## 相關規格

- [客戶分類](./customer-classification.md)
- [計費引擎](./billing-engine.md)
- [車趟頁面 UI 規格](../ui-specs/trip-pages.md)

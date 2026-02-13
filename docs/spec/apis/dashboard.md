# 儀表板 `/api/dashboard`

> **版本**：3.0
> **日期**：2026-02-13

## GET /api/dashboard/stats

**200 Response**：

```json
{
  "monthlyTrips": 42,
  "totalReceivable": 125000,
  "totalPayable": 85000,
  "customerCount": 15,
  "pendingReviews": 3,
  "expiringContracts": [
    { "id": 1, "contractNumber": "C-2026-001", "customerName": "大明企業", "endDate": "2026-03-01", "daysRemaining": 17 }
  ],
  "pendingItems": [
    { "id": 5, "customerName": "小華工廠", "yearMonth": "2026-01", "status": "draft" }
  ]
}
```

## 計算邏輯

- `monthlyTrips`：本月車趟數
- `totalReceivable` / `totalPayable`：本月非 draft 的 Statement 合計
- `customerCount`：status=active 的客戶數
- `pendingReviews`：status=draft 的 Statement 數
- `expiringContracts`：30 天內到期的 active 合約
- `pendingItems`：status=draft 的 Statement 列表

# 計費引擎

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §4.3 抽取

## 月結計費 `calculateMonthlyBilling(customerId, yearMonth)`

1. 查詢該客戶當月所有 TripItems（已快照單價和方向）
2. 依方向分組累加：
   - 品項應收小計 = Σ(`receivable` 品項的 amount)
   - 品項應付小計 = Σ(`payable` 品項的 amount)
   - `free` 品項不計入
3. 車趟費（固定歸入**應收**）：
   - 未啟用 → 0
   - `per_trip` → 當月車趟數 × tripFeeAmount
   - `per_month` → tripFeeAmount
4. 附加費用（各自有 billingDirection）：
   - `monthly` → 直接加入
   - `per_trip` → 金額 × 當月車趟數
5. 彙總：
   - 應收合計 = 品項應收 + 車趟費 + 應收附加費用
   - 應付合計 = 品項應付 + 應付附加費用
   - 淨額 = 應收合計 - 應付合計
6. 稅額計算（5% 營業稅）：
   - **淨額開票 (net)**：`taxAmount = Math.round(|netAmount| × 0.05) × sign`；`totalAmount = subtotal + taxAmount`
   - **分開開票 (separate)**：應收端和應付端各自計算 5% 稅額

## 按趟計費 `calculateTripBilling(tripId)`

- 只計算單趟的品項
- 車趟費只計算 `per_trip` 類型
- 附加費用只計算 `per_trip` 頻率的

## 計費引擎測試矩陣

| # | 場景 | 驗證重點 |
|---|------|---------|
| 1 | 純應收品項 | 應收小計正確、應付為 0 |
| 2 | 純應付品項 | 應付小計正確、應收為 0 |
| 3 | 混合方向品項 | 應收、應付各自正確，淨額 = 差額 |
| 4 | 含 free 品項 | free 不計入金額 |
| 5 | 分開開票 | 應收端/應付端各自有 subtotal/tax/total |
| 6 | 無車趟月份 | 品項全為 0，只有 monthly 附加費用 |
| 7 | 按趟附加費用 | 金額 × 車趟數 |
| 8 | 按月車趟費 | 固定金額，不乘車趟數 |
| 9 | 按趟車趟費 | 金額 × 車趟數 |
| 10 | 稅額四捨五入 | Math.round 精度 |
| 11 | 大量品項 | 加總精度（Decimal） |
| 12 | Decimal 精度 | 避免浮點誤差 |

## 相關規格

- [車趟品項快照邏輯](./pricing-snapshot.md)
- [明細寄送與狀態流程](./settlement-flow.md)
- [結算明細頁面 UI 規格](../ui-specs/statement-pages.md)

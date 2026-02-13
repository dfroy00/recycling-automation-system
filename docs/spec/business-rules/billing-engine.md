# 計費引擎

> **版本**：3.0
> **日期**：2026-02-13

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
| 13 | 跨月合約失效 | 月中到期的合約，該月車趟仍使用合約價（快照時有效即可） |
| 14 | 零金額明細 | 當月無車趟但有 monthly 附加費用，應產出含附加費用的明細 |
| 15 | 並行審核衝突 | 兩人同時審核同一明細，第二人收到 409「該明細已被審核」 |
| 16 | 全 free 品項月份 | 所有品項皆為 free，應收/應付品項小計為 0，僅有車趟費和附加費 |

## 邊界情境詳細說明

### 跨月合約失效（月中到期）

- 場景：客戶合約於 2026-03-15 到期
- 規則：車趟品項的單價和方向在**建立車趟品項時**進行快照（參見 [pricing-snapshot.md](./pricing-snapshot.md)）
- 因此 2026-03-01 ~ 2026-03-15 建立的車趟品項已快照合約價，計費時直接使用
- 2026-03-16 以後建立的車趟品項，因無有效合約，降級為手動輸入（也已快照）
- **結論**：計費引擎不需額外處理合約過期，因所有 TripItem 已有快照值

### 零金額明細（無車趟但有月費附加費用）

- 場景：客戶當月無任何車趟，但有 `monthly` 頻率的附加費用
- 規則：
  - 品項應收小計 = 0，品項應付小計 = 0
  - 車趟費（`per_trip`）：車趟數 = 0，金額 = 0
  - 車趟費（`per_month`）：固定金額照算
  - `monthly` 附加費用：照算
  - `per_trip` 附加費用：車趟數 = 0，金額 = 0
- **結論**：仍應產出明細，金額 = 月車趟費 + monthly 附加費用

### 並行操作：兩人同時審核同一明細

- 場景：使用者 A 和 B 同時開啟同一筆 `draft` 明細並點擊審核
- 處理方式：
  1. 使用者 A 審核成功 → 明細狀態變為 `approved`
  2. 使用者 B 審核請求到達時，後端檢查明細狀態已非 `draft`
  3. 回傳 `409`：「該明細已被審核，請重新整理頁面」
- 實作：後端使用樂觀鎖（檢查 `status` 是否仍為預期值）

## 驗收條件

### 計費引擎

- [ ] Given: 客戶當月有 3 趟車趟，品項分別為應收 100、應收 200、應付 150。When: 執行 `calculateMonthlyBilling`。Then: 品項應收小計 = 300、品項應付小計 = 150。

- [ ] Given: 客戶啟用 `per_trip` 車趟費 50 元，當月有 3 趟。When: 執行 `calculateMonthlyBilling`。Then: 車趟費 = 150（50 × 3），歸入應收。

- [ ] Given: 客戶啟用 `per_month` 車趟費 500 元，當月有 3 趟。When: 執行 `calculateMonthlyBilling`。Then: 車趟費 = 500（固定金額），歸入應收。

- [ ] Given: 客戶有 `monthly` 應收附加費用 100 元 + `per_trip` 應付附加費用 30 元，當月 3 趟。When: 執行 `calculateMonthlyBilling`。Then: 應收附加費用 = 100、應付附加費用 = 90（30 × 3）。

- [ ] Given: 客戶淨額開票，應收合計 1000、應付合計 600。When: 計算稅額。Then: `netAmount` = 400、`taxAmount` = Math.round(400 × 0.05) = 20、`totalAmount` = 420。

- [ ] Given: 客戶當月無車趟，有 `per_month` 車趟費 500 + `monthly` 應收附加費用 200。When: 執行 `calculateMonthlyBilling`。Then: 應收合計 = 700（500 + 200）、品項小計 = 0、仍應產出明細。

## 相關規格

- [車趟品項快照邏輯](./pricing-snapshot.md)
- [明細寄送與狀態流程](./settlement-flow.md)
- [結算明細頁面 UI 規格](../ui-specs/statement-pages.md)

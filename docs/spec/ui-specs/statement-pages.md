# 結算明細與報表頁面規格

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §5.3 抽取

## StatementsPage `/statements`

### 篩選列

- 月份選擇 + 客戶下拉 + 狀態篩選

### 車趟預覽區塊

選擇客戶 + 月份後自動顯示：

- 摘要：共 N 趟、品項總筆數、日期範圍
- 車趟表格（可展開品項明細）
- 「產出月結明細」按鈕
- 已有明細時提示「該月已有明細紀錄」

### 明細資料表格

- 欄位：客戶、月份、應收、應付、淨額、狀態、操作
- 操作按鈕依狀態顯示：審核（draft）、開票（approved）、寄送、作廢
- 批次產出按鈕

## ReportsPage `/reports`

- 客戶月結 PDF 下載：選擇客戶 + 月份 → 下載
- 站區彙總 Excel 下載：選擇站區 + 月份 → 下載

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [計費引擎](../business-rules/billing-engine.md)
- [明細寄送規則與防重複機制](../business-rules/settlement-flow.md)
- [UI 規格索引](./README.md)

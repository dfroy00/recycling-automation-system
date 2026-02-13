# 車趟頁面規格

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §5.3 抽取

## TripsPage `/trips`

### Tabs 架構

- **Tabs 架構**：頂部頁籤切換站區（只顯示 active 站區）
- 每個 Tab 內為獨立的 `SiteTripsTab` 元件

### SiteTripsTab 內容

- 篩選列：客戶下拉（只含該站區客戶）+ 日期範圍選擇器
- 車趟資料表格：收運日期、客戶、司機、車牌、來源標籤、操作
- 展開列：品項明細（`TripItemsExpand` 元件）
- 新增車趟 Modal：站區自動帶入、客戶下拉只含該站客戶

### TripItemsExpand

- 品項明細表格：品項、數量、單位、單價、方向、金額
- 新增品項行（inline 或 Modal）
- 簽約客戶：品項選擇後自動帶入合約單價和方向
- 臨時客戶：手動填寫

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [車趟品項快照邏輯](../business-rules/pricing-snapshot.md)
- [客戶分類業務規則](../business-rules/customer-classification.md)
- [UI 規格索引](./README.md)

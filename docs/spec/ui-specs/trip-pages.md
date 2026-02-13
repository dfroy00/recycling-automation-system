# 車趟頁面規格

> **版本**：3.0
> **日期**：2026-02-13

## TripsPage `/trips`

### Tabs 架構

- **Tabs 架構**：頂部頁籤切換站區（只顯示 active 站區）
- 每個 Tab 內為獨立的 `SiteTripsTab` 元件

### SiteTripsTab 內容

- 篩選列：客戶下拉（只含該站區客戶）+ 日期範圍選擇器
- 車趟資料表格：收運日期、客戶、司機、車牌、來源標籤、操作（刪除）
- 刪除 → Popconfirm「確定刪除此車趟？此操作無法復原。」（`DeleteOutlined` danger 色，硬刪除，含級聯刪除品項）
- 展開列：品項明細（`TripItemsExpand` 元件）
- 新增車趟 Modal：站區自動帶入、客戶下拉只含該站客戶

### TripItemsExpand

- 品項明細表格：品項、數量、單位、單價、方向、金額、操作（刪除）
- 刪除 → Popconfirm「確定刪除此品項？此操作無法復原。」（`DeleteOutlined` danger 色，硬刪除）
- 新增品項行（inline 或 Modal）
- 簽約客戶：品項選擇後自動帶入合約單價和方向
- 臨時客戶：手動填寫

## 日期篩選預設值

- 篩選列的日期範圍選擇器：
  - **預設值**：當月 1 日 ~ 當月最後一日
  - 切換站區 Tab 時保留日期篩選狀態
  - 變更日期後自動重新查詢

## 品項自動帶入 UX

### 簽約客戶（contracted）

1. 選擇品項後，自動查詢該客戶有效合約中的 ContractItem
2. **找到合約品項**：
   - 自動帶入單價（`unitPrice`）和方向（`billingDirection`）
   - 欄位顯示為唯讀，旁邊標註「合約價」
3. **未找到合約品項**：
   - 單價和方向欄位變為可編輯
   - 欄位上方顯示警告：「此品項無合約定價，請手動輸入」
4. **客戶無有效合約**：
   - 所有品項均為手動輸入模式
   - 表單上方顯示提示：「此客戶無有效合約」

### 臨時客戶（temporary）

- 品項選擇後，單價和方向欄位直接可編輯
- 無自動帶入邏輯

## 金額即時計算

- `amount = unitPrice × quantity`
- 數量或單價變更時，即時計算並顯示金額（前端計算，不需 API）
- `billingDirection = 'free'` 時，金額顯示為 `$0`，且不可編輯
- 金額欄位唯讀，僅供確認
- 使用 `Decimal.js` 或 `Math.round` 避免浮點誤差，顯示至整數

## 相關規格

- [頁面路由總覽](./pages-overview.md)
- [車趟品項快照邏輯](../business-rules/pricing-snapshot.md)
- [客戶分類業務規則](../business-rules/customer-classification.md)
- [UI 規格索引](./README.md)

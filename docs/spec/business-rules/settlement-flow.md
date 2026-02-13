# 明細寄送規則、防重複機制與軟刪除策略

> **版本**：3.0
> **日期**：2026-02-13

## 明細寄送規則

### 可寄送條件

| 條件 | 可寄送的狀態 |
|------|-------------|
| 需開票客戶（`invoiceRequired = true`） | `invoiced` |
| 不需開票客戶 | `approved` 或 `invoiced` |

### 通知方式

- `email`：附帶 PDF 附件，寄送至 `customer.notificationEmail`
- `line`：尚未實作（記錄 log 跳過）
- `both`：Email + LINE

### 寄送失敗處理

- 增加 `sendRetryCount`
- 記錄 `sendError`
- 每日排程自動重試（`sendRetryCount < 3`）

## 明細產出防重複機制

| 已有明細狀態 | 處理方式 |
|-------------|---------|
| `draft` / `approved` / `invoiced` / `sent` | **跳過**，不重複產出 |
| `rejected` | **刪除**舊的，重新產出 |
| `voided` | **不算**，可以重新產出 |

## 軟刪除策略

以下實體支援軟刪除（停用/啟用）**和**硬刪除（永久移除）：
- Site, Item, Customer, CustomerFee, BusinessEntity, User
- 停用：`PATCH /:id/deactivate` 將 `status` 設為 `inactive`
- 啟用：`PATCH /:id/reactivate` 將 `status` 設為 `active`
- 刪除：`DELETE /:id` 從資料庫永久移除（FK 約束失敗回傳 409）

以下實體僅使用硬刪除：
- Trip（先刪 TripItems）, TripItem, ContractItem, Holiday

合約使用特殊處理：DELETE 設為 `terminated` 狀態。

### FK 約束處理

硬刪除時若有 FK 依賴，後端回傳 `409` + 友善中文訊息：

| 實體 | FK 依賴 | 刪除失敗訊息 |
|------|---------|------------|
| Site | Customer, Trip, User | 「無法刪除：此站區下仍有關聯資料」 |
| Item | ContractItem, TripItem | 「無法刪除：此品項仍有關聯的合約或車趟」 |
| BusinessEntity | Customer, Statement | 「無法刪除：此行號仍有關聯的客戶或明細」 |
| Customer | Contract, Fee, Trip, Statement | 「無法刪除：此客戶仍有關聯的合約、車趟或明細」 |
| CustomerFee | — | 可直接刪除 |
| User | Statement (reviewer/voider) | 「無法刪除：此使用者仍有關聯的審核紀錄」 |

### 前端 UX 對應

| 後端行為 | 前端操作 | 按鈕樣式 | 確認文字模板 |
|---------|---------|---------|------------|
| 停用（`PATCH deactivate`） | **停用** | `StopOutlined` warning 色 | 「確定停用此 X？停用後可重新啟用。」 |
| 啟用（`PATCH reactivate`） | **啟用** | `CheckCircleOutlined` 綠色 | 無需確認 |
| 硬刪除（`DELETE`） | **刪除** | `DeleteOutlined` danger 色 | 「確定刪除此 X？此操作無法復原。」 |
| 終止（`DELETE` contract） | **終止** | `CloseCircleOutlined` danger 色 | 「確定終止此合約？終止後無法恢復。」 |

詳見 [操作按鈕語意規範](../ui-specs/README.md#操作按鈕語意規範)。

## 驗收條件

### 狀態機轉換

- [ ] Given: 選擇客戶和月份，該月有車趟但無明細。When: 點擊「產出月結明細」。Then: 建立 `draft` 狀態的明細，金額由計費引擎計算。

- [ ] Given: 一筆 `draft` 明細。When: 執行審核操作。Then: 明細狀態變為 `approved`。

- [ ] Given: 一筆 `approved` 明細，客戶 `invoiceRequired = true`。When: 執行開票操作。Then: 明細狀態變為 `invoiced`。

- [ ] Given: 一筆 `invoiced` 明細。When: 執行寄送操作。Then: 明細狀態變為 `sent`，觸發通知（Email/LINE）。

- [ ] Given: 一筆 `approved` 明細，客戶 `invoiceRequired = false`。When: 執行寄送操作。Then: 明細狀態直接變為 `sent`（跳過 invoiced）。

- [ ] Given: 選擇客戶和月份，該月已有 `draft` 狀態的明細。When: 嘗試再次產出。Then: 跳過不重複產出，提示「該月已有明細紀錄」。

- [ ] Given: 選擇客戶和月份，該月已有 `voided` 狀態的明細。When: 點擊「產出月結明細」。Then: 成功建立新的 `draft` 明細（voided 不阻擋重新產出）。

- [ ] Given: 一筆 `sent` 明細。When: 執行作廢操作。Then: 明細狀態變為 `voided`。

### 寄送失敗重試

- [ ] Given: 一筆明細寄送失敗，`sendRetryCount` = 1。When: 每日排程觸發自動重試。Then: 重新嘗試寄送，`sendRetryCount` 增加為 2。

- [ ] Given: 一筆明細 `sendRetryCount` = 3。When: 每日排程觸發。Then: 跳過不重試（已達上限）。

## 相關規格

- [計費引擎](./billing-engine.md)
- [結算明細頁面 UI 規格](../ui-specs/statement-pages.md)
- [系統頁面 UI 規格](../ui-specs/system-pages.md)

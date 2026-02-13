# 明細寄送規則、防重複機制與軟刪除策略

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §4.4、§4.5、§4.6 抽取

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

以下實體使用軟刪除（`status: 'inactive'`），API 的 DELETE 方法實際上是更新狀態：
- Site, Item, Customer, CustomerFee, BusinessEntity, User

以下實體使用硬刪除：
- Trip（先刪 TripItems）, TripItem, ContractItem, Holiday

合約使用特殊處理：DELETE 設為 `terminated` 狀態。

### 前端 UX 對應

| 後端行為 | 前端操作 | 按鈕樣式 | 確認文字模板 |
|---------|---------|---------|------------|
| 軟刪除（inactive） | **停用** | `StopOutlined` warning 色 | 「確定停用此 X？停用後可重新啟用。」 |
| 重新啟用（active） | **啟用** | `CheckCircleOutlined` 綠色 | 無需確認 |
| 硬刪除（DELETE） | **刪除** | `DeleteOutlined` danger 色 | 「確定刪除此 X？此操作無法復原。」 |
| 終止（terminated） | **終止** | `CloseCircleOutlined` danger 色 | 「確定終止此合約？終止後無法恢復。」 |

詳見 [操作按鈕語意規範](../ui-specs/README.md#操作按鈕語意規範)。

## 相關規格

- [計費引擎](./billing-engine.md)
- [結算明細頁面 UI 規格](../ui-specs/statement-pages.md)
- [系統頁面 UI 規格](../ui-specs/system-pages.md)

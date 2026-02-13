# 外部整合架構

> **版本**：3.0
> **日期**：2026-02-13

---

## 6.1 Adapter 模式設計

使用**策略模式（Strategy Pattern）**實作外部系統整合：

```
Adapter 介面
├── MockAdapter（Mock DB 模擬）  ← MVP 使用
└── RealAdapter（真實 API）      ← 未來擴充
```

環境變數控制切換：
- `POS_ADAPTER_MODE=mock|real`
- `VEHICLE_ADAPTER_MODE=mock|real`

---

## 6.2 POS Adapter 介面

| 方法 | 說明 |
|------|------|
| `getCollectionRecords(params)` | 依日期範圍拉取收運紀錄 |
| `getLatestRecords(since)` | 取得指定時間後的最新紀錄 |
| `syncCustomer(customer)` | 推送客戶資料至 POS |
| `syncContractPrices(items)` | 推送合約定價至 POS |
| `healthCheck()` | 健康檢查 |

詳細同步邏輯請參閱 [POS 同步邏輯](./pos-adapter.md)。

---

## 6.3 Vehicle Adapter 介面

| 方法 | 說明 |
|------|------|
| `getTripRecords(params)` | 依日期範圍拉取車趟紀錄 |
| `getVehicleStatus()` | 取得車輛即時狀態 |
| `syncCustomer(customer)` | 推送客戶資料至車機 |
| `dispatchTrip(dispatch)` | 發送派車指令 |
| `healthCheck()` | 健康檢查 |

詳細同步邏輯請參閱 [車機同步邏輯](./vehicle-adapter.md)。

---

## 6.6 同步鎖定機制

透過 SystemLog 表實作：
- 同步開始時寫入 `sync_start` 事件
- 同步結束時寫入 `sync_end` 事件
- 若有 5 分鐘內的 `sync_start` 無對應 `sync_end` → 進行中，回傳 `409 Conflict`
- 超過 5 分鐘自動解鎖

---

## 6.7 Mock 假資料產生規則

- 產出 3 個月的資料（每天每客戶 1-3 趟）
- 簽約客戶：使用合約品項
- 臨時客戶：從系統品項表隨機挑選，單價隨機產生

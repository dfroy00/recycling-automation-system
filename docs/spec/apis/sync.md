# 同步 `/api/sync`

> **版本**：3.0
> **日期**：2026-02-13

## 端點

| 方法 | 路徑 | 說明 | Request Body |
|------|------|------|-------------|
| POST | `/api/sync/pos/pull` | POS 收運紀錄拉取 | `{ dateFrom, dateTo }` |
| POST | `/api/sync/pos/push-customers` | 推送客戶至 POS | `{ customerId }` |
| POST | `/api/sync/pos/push-prices` | 推送合約定價至 POS | `{ contractId }` |
| POST | `/api/sync/vehicle/pull` | 車機車趟拉取 | `{ dateFrom, dateTo }` |
| POST | `/api/sync/vehicle/push-customers` | 推送客戶至車機 | `{ customerId }` |
| POST | `/api/sync/vehicle/dispatch` | 派車指令 | `{ customerId, tripDate, driver, vehiclePlate }` |
| GET | `/api/sync/vehicle/status` | 車輛即時狀態 | - |
| GET | `/api/sync/status` | Adapter 健康檢查 | - |
| POST | `/api/sync/mock/generate` | 產生 Mock 假資料 | - |

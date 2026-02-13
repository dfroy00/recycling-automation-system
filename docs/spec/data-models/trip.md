# 車趟模型：Trip / TripItem

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §2 抽取

## Trip（車趟紀錄）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| customerId | Int | FK → Customer | |
| siteId | Int | FK → Site | |
| tripDate | Date | | 收運日期 |
| tripTime | String | 選填 | 收運時間（如 "08:30"） |
| driver | String | 選填 | 司機 |
| vehiclePlate | String | 選填 | 車牌 |
| source | String | default: "manual" | `manual` / `pos_sync` / `vehicle_sync` |
| externalId | String | 選填 | 外部系統原始 ID |
| notes | String | 選填 | 備註 |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`customer`, `site`, `items[]`, `statements[]`

---

## TripItem（趟次品項明細 — 快照設計）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| tripId | Int | FK → Trip | |
| itemId | Int | FK → Item | |
| quantity | Decimal(10,2) | | 數量 |
| unit | String | | **快照**：收運當時的計量單位 |
| unitPrice | Decimal(10,2) | | **快照**：收運當時的單價 |
| billingDirection | String | | **快照**：收運當時的方向 |
| amount | Decimal(10,2) | | 計算值（unitPrice × quantity，free 為 0） |

**關聯**：`trip`, `item`

### 快照設計要點

> 合約變動不影響已記錄的車趟品項。新增品項時從合約取得當時的單價和方向存入 TripItem，後續合約價格調整不會回溯修改歷史紀錄。

---

## 相關索引

| 資料表 | 索引欄位 | 目的 |
|--------|---------|------|
| trips | (customerId, tripDate) | 月結查詢加速 |
| trips | (siteId, tripDate) | 站區報表加速 |
| tripItems | (tripId) | 車趟品項查詢 |

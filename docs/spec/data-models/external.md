# 外部整合模型：MockPosCollection / MockVehicleTrip

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §2 抽取

## MockPosCollection（模擬 POS 收運紀錄）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| externalId | String | unique | 外部 ID |
| siteName | String | | 站區名稱（文字比對） |
| customerName | String | | 客戶名稱（文字比對） |
| collectionDate | Date | | 收運日期 |
| itemName | String | | 品項名稱 |
| quantity | Decimal | | 數量 |
| unit | String | | 單位 |
| unitPrice | Decimal | | POS 端單價 |
| imported | Boolean | default: false | 是否已匯入 |

---

## MockVehicleTrip（模擬車機車趟紀錄）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| externalId | String | unique | 外部 ID |
| siteName | String | | 站區名稱 |
| customerName | String | | 客戶名稱 |
| tripDate | Date | | 車趟日期 |
| tripTime | String | 選填 | 車趟時間 |
| driver | String | | 司機 |
| vehiclePlate | String | | 車牌 |
| status | String | | `pending` / `in_progress` / `completed` |
| imported | Boolean | default: false | 是否已匯入 |

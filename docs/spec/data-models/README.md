# 資料模型總覽

> **版本**：3.0
> **日期**：2026-02-13

## ERD

```
Site 1──* Customer 1──* Trip 1──* TripItem *──1 Item
  │                │              │
  │                │              └──* Statement
  │                │
  │                ├──* CustomerFee
  │                │
  │                ├──* Contract 1──* ContractItem *──1 Item
  │                │
  │                └──* Statement
  │
  └──* Trip

BusinessEntity 1──* Customer
               1──* Statement

User *──1 Site（站區綁定，super_admin 為 null）
     1──* SystemLog
     1──* Statement (reviewedBy / voidedBy)

Holiday（獨立）
MockPosCollection（獨立）
MockVehicleTrip（獨立）
```

## Model 索引

| Model | 分類 | Spec 檔案 |
|-------|------|-----------|
| Site | 基礎資料 | [base-data.md](./base-data.md) |
| Item | 基礎資料 | [base-data.md](./base-data.md) |
| BusinessEntity | 基礎資料 | [base-data.md](./base-data.md) |
| Customer | 客戶與合約 | [customer-contract.md](./customer-contract.md) |
| CustomerFee | 客戶與合約 | [customer-contract.md](./customer-contract.md) |
| Contract | 客戶與合約 | [customer-contract.md](./customer-contract.md) |
| ContractItem | 客戶與合約 | [customer-contract.md](./customer-contract.md) |
| Trip | 車趟 | [trip.md](./trip.md) |
| TripItem | 車趟 | [trip.md](./trip.md) |
| Statement | 結算明細 | [statement.md](./statement.md) |
| User | 系統 | [system.md](./system.md) |
| Holiday | 系統 | [system.md](./system.md) |
| SystemLog | 系統 | [system.md](./system.md) |
| MockPosCollection | 外部整合 | [external.md](./external.md) |
| MockVehicleTrip | 外部整合 | [external.md](./external.md) |

## 型別慣例

- 所有狀態 / 類型欄位使用 `String` 型別，驗證在應用層實作（不使用資料庫 enum）。
- 「必填」欄位不可為 null；「選填」欄位可為 null。
- Decimal 精度標示如 `Decimal(10,2)` 表示總共 10 位、小數 2 位。

## 關鍵關聯說明

- **Site ↔ Customer**：一個站區擁有多個客戶，客戶必須歸屬於一個站區。
- **Customer ↔ Trip**：一個客戶擁有多筆車趟紀錄。
- **Trip ↔ TripItem ↔ Item**：一筆車趟包含多個品項明細，每個明細對應一個品項主檔。
- **Customer ↔ Contract ↔ ContractItem ↔ Item**：客戶可擁有多份合約，合約內含多個品項定價。
- **Customer ↔ Statement**：客戶擁有多筆結算明細。
- **BusinessEntity ↔ Customer**：行號對應多個客戶（開票用途）。
- **BusinessEntity ↔ Statement**：行號對應多筆結算明細（快照）。
- **User ↔ Site**：使用者綁定站區，`super_admin` 的 `siteId` 為 null 代表全站區。
- **User ↔ Statement**：使用者可作為審核者（`reviewedBy`）或作廢者（`voidedBy`）。
- **User ↔ SystemLog**：使用者操作產生系統日誌。

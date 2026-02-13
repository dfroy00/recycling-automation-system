# 基礎資料模型：Site / Item / BusinessEntity

> **版本**：3.0
> **日期**：2026-02-13

## Site（站區主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| name | String | unique | 站區名稱 |
| address | String | 選填 | 地址 |
| phone | String | 選填 | 電話 |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | 建立時間 |
| updatedAt | DateTime | auto | 更新時間 |

**關聯**：`customers[]`, `trips[]`

---

## Item（品項主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | 同時作為品項編號 |
| name | String | unique | 品項名稱（全公司統一） |
| category | String | 選填 | 分類（紙類 / 鐵類 / 五金類 / 塑膠類 / 雜項） |
| unit | String | | 計量單位（kg / 件 / 袋） |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`contractItems[]`, `tripItems[]`

---

## BusinessEntity（行號主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| name | String | unique | 行號名稱 |
| taxId | String | unique | 統一編號 |
| bizItems | String | 選填 | 營業項目說明 |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`customers[]`, `statements[]`

---

## 相關索引

| 資料表 | 索引欄位 | 目的 |
|--------|---------|------|
| customers | (siteId, status) | 站區客戶篩選 |

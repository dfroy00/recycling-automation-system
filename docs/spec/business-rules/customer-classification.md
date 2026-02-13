# 客戶分類

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §4.1 抽取

## 客戶類型

| 類型 | 說明 | 計費方式 |
|------|------|---------|
| `contracted`（簽約） | 正式簽約客戶，有合約品項定價 | 依合約品項單價和方向 |
| `temporary`（臨時） | 臨時叫車收運，無合約 | 每次手動輸入單價和方向 |

## 合約到期降級

簽約客戶的所有有效合約全部到期時，新增車趟品項時改為手動輸入模式（等同臨時客戶），UI 提示「無有效合約」，但不阻止建立。

## 合約與客戶類型聯動

- 新增合約（`POST /api/contracts`）成功後，若客戶 `type` 為 `temporary`，自動更新為 `contracted`
- 終止/刪除合約後，若該客戶已無任何 `active` 合約，自動將 `type` 改回 `temporary`
- 前端 hooks 在合約 mutation 成功後需同時 invalidate `contracts` 和 `customers` cache

## 相關規格

- [車趟品項快照邏輯](./pricing-snapshot.md)
- [計費引擎](./billing-engine.md)
- [客戶頁面 UI 規格](../ui-specs/customer-pages.md)

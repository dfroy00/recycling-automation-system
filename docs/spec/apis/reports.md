# 報表 `/api/reports`

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.9 抽取

## 端點

| 方法 | 路徑 | 說明 | 回傳 |
|------|------|------|------|
| GET | `/api/reports/customers/:customerId` | 客戶月結 PDF | `?yearMonth` → application/pdf |
| GET | `/api/reports/statements/:statementId/pdf` | 明細 PDF | application/pdf |
| GET | `/api/reports/sites/:siteId` | 站區彙總 Excel | `?yearMonth` → application/xlsx |

## 限制

**速率限制**：10 次 / 分鐘 / IP

**並發控制**：最多 5 個報表同時產出，超過回傳 `503`

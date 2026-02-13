# 假日 `/api/holidays`

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.12 抽取

## 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/holidays` | 列表（`?year`，**不分頁**，回傳純陣列） |
| POST | `/api/holidays` | 新增單筆 |
| POST | `/api/holidays/import` | 批次匯入（upsert） |
| DELETE | `/api/holidays/:id` | **硬刪除** |

## 批次匯入 Request Body

```json
{
  "holidays": [
    { "date": "2026-01-01", "name": "元旦", "year": 2026 },
    { "date": "2026-01-29", "name": "除夕", "year": 2026 }
  ]
}
```

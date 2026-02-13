# 排程 `/api/schedule`

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §3.13 抽取

## 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/schedule` | 排程狀態列表 |
| POST | `/api/schedule/:name/trigger` | 手動觸發排程 |

## GET Response

```json
[
  { "name": "monthly-statement", "cron": "0 9 5 * *", "description": "月結明細產出", "enabled": true },
  { "name": "daily-send", "cron": "0 9 * * *", "description": "每日寄送檢查", "enabled": true }
]
```

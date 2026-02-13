# 環境設定

> **版本**：3.0
> **日期**：2026-02-13

---

## 9.1 Docker Compose

- PostgreSQL 16-alpine，port 5432
- Volume 持久化資料

---

## 9.2 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://postgres:postgres123@localhost:5432/recycle_db` | 資料庫連線字串 |
| `JWT_SECRET` | （必須設定） | JWT 簽章金鑰 |
| `JWT_EXPIRES_IN` | `8h` | Token 有效期 |
| `PORT` | `3000` | 後端服務端口 |
| `CORS_ORIGIN` | `http://localhost:5173` | 前端來源 |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 主機 |
| `SMTP_PORT` | `587` | SMTP 端口 |
| `SMTP_USER` | | SMTP 帳號 |
| `SMTP_PASS` | | SMTP 密碼 |
| `SMTP_FROM` | | 寄件人地址 |
| `ADMIN_EMAIL` | | 管理員通知信箱 |
| `FINANCE_EMAIL` | | 財務通知信箱 |
| `ENABLE_SCHEDULER` | `false` | 排程開關 |
| `POS_ADAPTER_MODE` | `mock` | POS Adapter 模式 |
| `VEHICLE_ADAPTER_MODE` | `mock` | 車機 Adapter 模式 |

---

## 9.3 前端環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `VITE_API_URL` | `/api` | API 基礎路徑（透過 Vite proxy 轉發） |

---

## 9.4 開發環境 Port 配置

| 服務 | Port |
|------|------|
| 後端 API | 3000 |
| 前端開發伺服器 | 5173 |
| PostgreSQL | 5432 |

---

相關文件：
- [種子資料](./seed-data.md)
- [排程規格](./schedules.md)
- [Adapter 模式設計](../integrations/README.md)

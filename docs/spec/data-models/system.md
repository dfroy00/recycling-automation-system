# 系統模型：User / Holiday / SystemLog

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §2 抽取

## User（使用者）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| username | String | unique | 帳號 |
| passwordHash | String | | 密碼雜湊（bcrypt, salt=10） |
| name | String | | 姓名 |
| email | String | 選填 | Email |
| role | String | default: "site_staff" | `super_admin` / `site_manager` / `site_staff` |
| siteId | Int | 選填, FK → Site | 綁定站區（super_admin 為 null 代表全站區） |
| status | String | default: "active" | `active` / `inactive` |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**關聯**：`site?`, `reviewedStatements[]`, `voidedStatements[]`, `systemLogs[]`

### 角色定義

| 角色 | `role` 值 | `siteId` | 可存取範圍 | 操作權限 |
|------|-----------|----------|-----------|----------|
| 系統管理員 | `super_admin` | `null` | 所有站區 | 完整 CRUD + 審核 + 使用者管理 |
| 站區主管 | `site_manager` | 綁定站區 ID | 僅自己站區 | CRUD 客戶/合約/車趟 + 審核明細 |
| 站區人員 | `site_staff` | 綁定站區 ID | 僅自己站區 | 唯讀（查看資料但不能修改） |

---

## Holiday（假日主檔）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| date | Date | unique | 假日日期 |
| name | String | | 假日名稱 |
| year | Int | | 年份 |

---

## SystemLog（系統日誌）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | Int | PK, auto-increment | |
| eventType | String | | 事件類型 |
| eventContent | String | | 事件內容 |
| userId | Int | 選填, FK → User | |
| createdAt | DateTime | auto | |

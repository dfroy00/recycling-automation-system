# 頁面路由表與角色權限對照

> **版本**：3.0
> **日期**：2026-02-13

## 路由總覽

| 路由 | 頁面 | 所屬群組 | 角色存取 | 詳細規格 |
|------|------|---------|---------|---------|
| `/login` | LoginPage | — | 不需認證 | [base-data-pages.md](./base-data-pages.md) |
| `/dashboard` | DashboardPage | 儀表板 | 所有角色 | [system-pages.md](./system-pages.md) |
| `/sites` | SitesPage | 基礎資料 | 所有角色（寫入僅 super_admin） | [base-data-pages.md](./base-data-pages.md) |
| `/items` | ItemsPage | 基礎資料 | 所有角色（寫入僅 super_admin） | [base-data-pages.md](./base-data-pages.md) |
| `/customers` | CustomersPage | 基礎資料 | 所有角色（siteScope 過濾） | [customer-pages.md](./customer-pages.md) |
| `/customers/new` | CustomerDetailPage | 基礎資料 | 可編輯角色 | [customer-pages.md](./customer-pages.md) |
| `/customers/:id` | CustomerDetailPage | 基礎資料 | 所有角色（siteScope 過濾） | [customer-pages.md](./customer-pages.md) |
| `/business-entities` | BusinessEntitiesPage | 基礎資料 | 所有角色（寫入僅 super_admin） | [base-data-pages.md](./base-data-pages.md) |
| `/contracts` | ContractsPage | 基礎資料 | 僅 super_admin | [customer-pages.md](./customer-pages.md) |
| `/trips` | TripsPage | 營運管理 | 所有角色（siteScope 過濾） | [trip-pages.md](./trip-pages.md) |
| `/sync` | SyncPage | 營運管理 | 僅 super_admin | [system-pages.md](./system-pages.md) |
| `/statements` | StatementsPage | 帳務管理 | 所有角色（siteScope 過濾） | [statement-pages.md](./statement-pages.md) |
| `/reports` | ReportsPage | 帳務管理 | 所有角色（siteScope 過濾） | [statement-pages.md](./statement-pages.md) |
| `/users` | UsersPage | 系統 | 僅 super_admin | [system-pages.md](./system-pages.md) |
| `/holidays` | HolidaysPage | 系統 | 僅 super_admin | [system-pages.md](./system-pages.md) |
| `/schedule` | SchedulePage | 系統 | 僅 super_admin | [system-pages.md](./system-pages.md) |

## 角色權限矩陣

| 功能 | `super_admin` | `site_manager` | `site_staff` |
|------|:------------:|:--------------:|:------------:|
| 所有寫入操作 | V | 部分 | X |
| 主檔管理寫入（站區/品項/行號/假日） | V | X | X |
| 合約總覽 | V | X | X |
| 外部同步 | V | X | X |
| 系統管理（使用者/假日/排程） | V | X | X |
| 營運管理（車趟） | V | V | 唯讀 |
| 帳務管理（月結/報表） | V | V | 唯讀 |
| 客戶管理 | V | V（siteScope） | 唯讀（siteScope） |

### 角色動態控制

- `site_staff`：所有寫入按鈕（新增/編輯/刪除/審核）隱藏
- `site_manager`：主檔管理（站區/品項/行號/假日）寫入按鈕隱藏
- `super_admin`：全部功能可見

## 路由守衛規則表

| 路由 | 未登入行為 | 權限不符行為 | 備註 |
|------|----------|------------|------|
| `/login` | 允許存取 | 已登入自動導向 `/dashboard` | 公開路由 |
| `/dashboard` | 導向 `/login` | — | 所有角色可存取 |
| `/sites` | 導向 `/login` | — | 所有角色可讀取 |
| `/items` | 導向 `/login` | — | 所有角色可讀取 |
| `/customers` | 導向 `/login` | — | siteScope 過濾 |
| `/customers/new` | 導向 `/login` | `site_staff` 導向 `/customers` | 需可編輯角色 |
| `/customers/:id` | 導向 `/login` | — | siteScope 過濾 |
| `/business-entities` | 導向 `/login` | — | 所有角色可讀取 |
| `/contracts` | 導向 `/login` | 非 `super_admin` 導向 `/dashboard` | 僅 super_admin |
| `/trips` | 導向 `/login` | — | siteScope 過濾 |
| `/sync` | 導向 `/login` | 非 `super_admin` 導向 `/dashboard` | 僅 super_admin |
| `/statements` | 導向 `/login` | — | siteScope 過濾 |
| `/reports` | 導向 `/login` | — | siteScope 過濾 |
| `/users` | 導向 `/login` | 非 `super_admin` 導向 `/dashboard` | 僅 super_admin |
| `/holidays` | 導向 `/login` | 非 `super_admin` 導向 `/dashboard` | 僅 super_admin |
| `/schedule` | 導向 `/login` | 非 `super_admin` 導向 `/dashboard` | 僅 super_admin |
| `/*`（其他） | 導向 `/login` | 顯示 404 頁面 | 不存在的路由 |

### 實作規則

1. **AuthGuard**：檢查 localStorage 是否有有效 token，無則導向 `/login` 並記錄目標路由
2. **RoleGuard**：從 token 解析角色，不符合路由要求則導向 `/dashboard` + Toast 提示
3. **登入後回跳**：登入成功後，優先跳回被攔截前的目標路由（`redirectUrl`），無則跳 `/dashboard`

## 相關規格

- [UI 規格索引](./README.md)
- [業務規則索引](../business-rules/README.md)

# 回收業務自動化系統 — Claude Code 開發規範

## 專案概述

回收業務自動化系統，整合 CRM / POS / 車機三套系統，自動化月結帳務流程。

- **前端**：React 18 + TypeScript + Vite + Ant Design 5
- **後端**：Express.js 5 + TypeScript + Prisma 7 + PostgreSQL 16
- **容器化**：Docker Compose（dev + prod 多階段建構）

## 語言與溝通

- 回覆使用**繁體中文**
- 程式碼註解使用**繁體中文**
- Commit message 使用**繁體中文**

## SDD 變更流程（強制遵守）

**所有功能變更、行為修改都必須遵循五階段流程**，完整規範見 [SDD-WORKFLOW.md](docs/spec/SDD-WORKFLOW.md)。

```
Design → Spec Update → Implementation Plan → Test → Code
（設計）  （更新規格）   （實作計畫）          （測試） （寫程式碼）
```

### 階段一：Design

- 建立 `docs/plans/designs/YYYY-MM-DD-<topic>.md`
- 分析需求、列出方案、做出決策
- 標明影響哪些 Spec 文件

### 階段二：Spec Update

- 更新 `docs/spec/` 下對應的領域 Spec 文件
- 遞增版本號、更新日期
- 新增內容標記 `> [!NOTE] vX.X 新增`

### 階段三：Implementation Plan

- 建立 `docs/plans/implementations/YYYY-MM-DD-<topic>.md`
- 列出任務清單、影響檔案、測試計畫

### 階段四：Test

- 從 Spec 驗收條件（Given/When/Then）轉化為測試案例
- 測試先行（TDD）：先寫測試，確認全部為紅燈
- 測試分類：單元測試（業務規則）、整合測試（API）、E2E 測試（UI 流程）

### 階段五：Code

- 按照 Plan 逐一實作，使測試從紅燈轉為綠燈
- 發現 Spec 有誤 → **先改 Spec 再改 Code**
- 不做 Spec 未定義的功能

### 快速修復例外

Bug 修復、錯字修正、依賴升級可跳過 Design，但仍需更新 Spec（如有影響）並撰寫測試。

## Spec 檔案結構

入口：[docs/spec/overview.md](docs/spec/overview.md)

```
docs/spec/
├── overview.md              # 導航入口
├── architecture.md          # 技術架構、非功能需求
├── SDD-WORKFLOW.md          # 變更流程
├── data-models/             # 資料模型（7 檔）
├── apis/                    # API 契約（13 檔）
├── business-rules/          # 業務規則（5 檔）
├── ui-specs/                # UI 規格（7 檔）
├── integrations/            # 外部整合（3 檔）
└── operations/              # 營運配置（3 檔）
```

### 修改 Spec 的查找指引

| 要改什麼 | 去哪改 |
|---------|--------|
| 資料表欄位 | `data-models/<對應模組>.md` |
| API 端點 | `apis/<對應模組>.md` |
| 計費邏輯 | `business-rules/billing-engine.md` |
| 客戶分類/合約聯動 | `business-rules/customer-classification.md` |
| 快照邏輯 | `business-rules/pricing-snapshot.md` |
| 結算流程/寄送/防重複 | `business-rules/settlement-flow.md` |
| 頁面 UI | `ui-specs/<對應頁面>.md` |
| 路由/權限 | `ui-specs/pages-overview.md` |
| POS/車機整合 | `integrations/<對應>.md` |
| 環境變數/Docker | `operations/environment.md` |
| 排程 | `operations/schedules.md` |
| 種子資料 | `operations/seed-data.md` |

## Plans 管理

詳見 [docs/plans/README.md](docs/plans/README.md)。

```
docs/plans/
├── designs/           # 設計文件
├── implementations/   # 實作計畫
└── archive/           # 已完成歸檔
```

- 檔名格式：`YYYY-MM-DD-<簡短描述>.md`
- 完成後移至 `archive/`

## 程式碼規範

### 通用

- 2 空格縮排
- 優先使用 TypeScript
- 修改前先讀取檔案，不做未要求的重構
- 不主動新增 docstring、註解、型別標註到未修改的程式碼

### 前端 (`frontend/`)

- 元件放 `src/components/`，頁面放 `src/pages/`
- API 呼叫封裝為 React Query hooks，放 `src/hooks/`
- Hook 命名：`use{Entity}s()` / `use{Entity}(id)` / `useCreate{Entity}()` / `useUpdate{Entity}()` / `useDelete{Entity}()`
- 型別放 `src/types/`
- mutation 成功後 invalidate 對應的 queryKey
- UI 元件使用 Ant Design 5，不引入其他 UI 庫

### 後端 (`backend/`)

- 路由放 `src/routes/`，業務邏輯放 `src/services/`
- 中介層放 `src/middleware/`
- Adapter 模式放 `src/adapters/`
- 資料庫操作統一透過 Prisma
- 錯誤處理：P2025 → 404、P2002 → 409、P2003 → 400
- 密碼永遠排除 `passwordHash` 回傳

### 資料庫 (`backend/prisma/`)

- Schema 位於 `backend/prisma/schema.prisma`
- 種子資料位於 `backend/prisma/seed.ts`
- 變更 schema 後執行 `npx prisma migrate dev --name <描述>`

### 測試

- 後端測試：`backend/src/__tests__/`，使用 Jest + Supertest
- 執行：`cd backend && npm test`
- 瀏覽器測試：使用 `/browser-testing` skill，PORT 3300

## 開發環境

```bash
# 啟動所有服務
docker compose up -d

# 前端：http://localhost:5173
# 後端：http://localhost:3000
# 資料庫：localhost:5432
```

| 服務 | Port | 說明 |
|------|------|------|
| 前端 | 5173 | Vite dev server |
| 後端 | 3000 | Express API |
| PostgreSQL | 5432 | 資料庫 |
| 測試用 | 33xx | 保留給 VSCode 測試 |

## 三層權限系統

| 角色 | 讀取 | 寫入 | 特殊 |
|------|------|------|------|
| `super_admin` | 全站區 | 全部 CRUD | 使用者管理、同步、排程 |
| `site_manager` | 自己站區 | 客戶/合約/車趟/明細 | 審核明細 |
| `site_staff` | 自己站區 | 無 | 唯讀 |

## 關鍵約束（容易遺忘）

- 客戶 `per_trip` 結算不允許 `per_trip` 付款方式
- 新增合約自動更新客戶類型為 `contracted`，刪除合約需檢查是否降回 `temporary`
- TripItem 使用快照設計，合約價格變動不影響歷史記錄
- 三層操作實體（停用/啟用/硬刪除）：Site, Item, Customer, CustomerFee, BusinessEntity, User
  - `PATCH /:id/deactivate` → 停用（status 設為 inactive）
  - `PATCH /:id/reactivate` → 啟用（status 恢復 active）
  - `DELETE /:id` → 硬刪除（永久移除，有外鍵關聯時回傳 409）
- 直接硬刪除實體：Trip, TripItem, ContractItem, Holiday
- 合約 DELETE = 設為 `terminated`（非硬刪除）
- JWT_SECRET 必須設定，禁止 fallback 預設值

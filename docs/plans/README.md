# Plans 管理規範

> **版本**：1.0
> **日期**：2026-02-13

---

## 目錄結構

```
docs/plans/
├── README.md               # 本文件：管理規範
├── designs/                # 設計文件（Design 階段產出）
├── implementations/        # 實作計畫（Plan 階段產出）
└── archive/                # 已完成歸檔
```

## 命名規則

所有文件遵循格式：`YYYY-MM-DD-<簡短描述>.md`

- 日期使用建立日期
- 描述使用英文短語，以 `-` 分隔
- 不加多餘後綴（如 `-design`、`-plan`），目錄已區分用途

**範例**：
- `designs/2026-02-10-mvp-full-rewrite.md`
- `implementations/2026-02-10-mvp-implementation.md`

## 變更流程

詳見 [SDD 四階段變更流程](../spec/SDD-WORKFLOW.md)。

```
Design → Spec Update → Implementation Plan → Code
```

## 歸檔規則

- 設計文件：對應的 Spec 更新完成後，移至 `archive/`
- 實作計畫：所有任務完成後，移至 `archive/`
- 歸檔時保持原始檔名不變

---

## 現有文件盤點

### 設計文件 (`designs/`)

| 文件 | 說明 |
|------|------|
| [2026-02-10-mvp-full-rewrite.md](./designs/2026-02-10-mvp-full-rewrite.md) | MVP 全重寫設計 |
| [2026-02-11-system-optimization.md](./designs/2026-02-11-system-optimization.md) | 系統優化設計 |
| [2026-02-11-trips-ui-refactor.md](./designs/2026-02-11-trips-ui-refactor.md) | 車趟 UI 重構設計 |
| [2026-02-13-customer-detail-permissions.md](./designs/2026-02-13-customer-detail-permissions.md) | 客戶詳情頁 + 權限設計 |

### 實作計畫 (`implementations/`)

| 文件 | 說明 |
|------|------|
| [2026-02-10-mvp-implementation.md](./implementations/2026-02-10-mvp-implementation.md) | MVP 實作計畫 |
| [2026-02-12-bugfix-enhancements.md](./implementations/2026-02-12-bugfix-enhancements.md) | Bug 修復與增強 |
| [2026-02-13-customer-detail-permissions-impl.md](./implementations/2026-02-13-customer-detail-permissions-impl.md) | 客戶詳情頁 + 權限實作 |

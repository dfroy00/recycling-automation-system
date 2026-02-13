# 刪除/停用/啟用 UX 對齊 — 實作計畫

> **日期**：2026-02-13
> **設計文件**：[delete-ux-alignment.md](../designs/2026-02-13-delete-ux-alignment.md)
> **Spec 更新**：ui-specs/README.md, base-data-pages.md, customer-pages.md, system-pages.md, trip-pages.md, business-rules/settlement-flow.md

---

## 實作項目

### A. 後端 — 新增 reactivate API（啟用端點）

- [x] A1. 新增 `PATCH /api/sites/:id/reactivate` → 設 `status = 'active'`
- [x] A2. 新增 `PATCH /api/items/:id/reactivate` → 設 `status = 'active'`
- [x] A3. 新增 `PATCH /api/business-entities/:id/reactivate` → 設 `status = 'active'`
- [x] A4. 新增 `PATCH /api/customers/:id/reactivate` → 設 `status = 'active'`
- [x] A5. 新增 `PATCH /api/customers/:customerId/fees/:id/reactivate` → 設 `status = 'active'`
- [x] A6. 新增 `PATCH /api/users/:id/reactivate` → 設 `status = 'active'`

### B. 後端 — 列表查詢預設過濾 inactive

- [x] B1. 所有軟刪除實體的 GET list API 支援 `status` 查詢參數（`active` / `inactive` / 不傳=全部）
- [x] B2. 確認現有 DELETE API 回應訊息正確（軟刪除回「已停用」、硬刪除回「已刪除」、合約回「已終止」）

### C. 前端 — API Hooks 新增

- [x] C1. `frontend/src/api/hooks.ts`：新增 `useReactivateSite()`
- [x] C2. `frontend/src/api/hooks.ts`：新增 `useReactivateItem()`
- [x] C3. `frontend/src/api/hooks.ts`：新增 `useReactivateBusinessEntity()`
- [x] C4. `frontend/src/api/hooks.ts`：新增 `useReactivateCustomer()`
- [x] C5. `frontend/src/api/hooks.ts`：新增 `useReactivateCustomerFee()`
- [x] C6. `frontend/src/api/hooks.ts`：新增 `useReactivateUser()`
- [x] C7. 更新所有 `useDelete*` hooks 的成功訊息（軟刪除→「已停用」、硬刪除→「已刪除」、合約→「已終止」）

### D. 前端 — 軟刪除頁面改為停用/啟用

- [x] D1. `SitesPage.tsx`：刪除按鈕改停用（StopOutlined warning）+ 啟用按鈕 + 狀態篩選器
- [x] D2. `ItemsPage.tsx`：刪除按鈕改停用（StopOutlined warning）+ 啟用按鈕 + 狀態篩選器
- [x] D3. `BusinessEntitiesPage.tsx`：刪除按鈕改停用（StopOutlined warning）+ 啟用按鈕 + 狀態篩選器
- [x] D4. `CustomersPage.tsx`：刪除按鈕改停用（StopOutlined warning）+ 啟用按鈕 + 狀態篩選器
- [x] D5. `CustomerFeesTab.tsx`：刪除按鈕改停用（StopOutlined warning）+ 啟用按鈕
- [x] D6. `UsersPage.tsx`：刪除按鈕改停用（StopOutlined warning）+ 啟用按鈕 + 狀態篩選器

### E. 前端 — 合約終止按鈕

- [x] E1. `CustomerContractsTab.tsx`：刪除按鈕改終止（CloseCircleOutlined danger）+ 確認文字更新
- [x] E2. `ContractsPage.tsx`：刪除按鈕改終止（CloseCircleOutlined danger）+ 確認文字更新

### F. 前端 — 硬刪除頁面確認文字更新

- [x] F1. `HolidaysPage.tsx`：確認文字改為「確定刪除此假日？此操作無法復原。」
- [x] F2. `SiteTripsTab.tsx`：確認文字改為「確定刪除此車趟？此操作無法復原。」
- [x] F3. `TripItemsExpand.tsx`：確認文字改為「確定刪除此品項？此操作無法復原。」

### G. 前端 — 成功訊息統一

- [x] G1. 確認所有軟刪除 hooks 成功訊息為「X 已停用」
- [x] G2. 確認所有硬刪除 hooks 成功訊息為「X 已刪除」
- [x] G3. 確認合約終止 hook 成功訊息為「合約已終止」
- [x] G4. 啟用操作成功訊息為「X 已啟用」

---

## 執行順序

```
A（後端 reactivate API）→ B（列表查詢支援 status）
        ↓
C（前端 hooks）→ D（停用/啟用頁面）+ E（合約終止）+ F（硬刪除確認文字）+ G（成功訊息）
```

## 預估影響檔案

| 層 | 檔案 | 數量 |
|----|------|------|
| 後端 routes | `backend/src/routes/*.ts` | ~6 |
| 前端 hooks | `frontend/src/api/hooks.ts` | 1 |
| 前端頁面 | `frontend/src/pages/*.tsx` | ~11 |
| **合計** | | ~18 |

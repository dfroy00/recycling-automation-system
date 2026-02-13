# 系統優化設計文件

**日期**: 2026-02-11
**狀態**: 已驗證

## 概述

針對回收業務自動化系統 MVP 進行全面優化，涵蓋安全性、效能、錯誤處理、UX 四大面向。

---

## 區塊 1：安全性強化

### 1.1 JWT 密鑰保護
- 啟動時檢查 `JWT_SECRET` 環境變數，未設定直接拋錯終止
- 移除所有 `|| 'dev-secret'` fallback

### 1.2 Rate Limiting
- 登入端點：5 次/分鐘/IP
- 一般 API：100 次/分鐘/IP
- 報表下載：10 次/分鐘/IP
- 使用 `express-rate-limit` 套件

### 1.3 密碼策略
- 最少 8 字元，至少包含 1 個數字
- 建立/更新使用者時驗證

### 1.4 Helmet 安全標頭
- 加入 `helmet` 套件

### 1.5 全域錯誤處理中介層
- 統一攔截未處理錯誤
- 統一回傳格式 `{ error: string }`
- 生產模式隱藏堆疊追蹤

---

## 區塊 2：效能優化

### 2.1 資料庫索引
- `trips`: `@@index([customerId, tripDate])`, `@@index([siteId, tripDate])`
- `statements`: `@@index([customerId, yearMonth, status])`
- `contract_items`: `@@index([contractId])`
- `trip_items`: `@@index([tripId])`
- `customers`: `@@index([siteId, status])`

### 2.2 批次月結 N+1 修復
- 先一次查出所有月結客戶
- `Promise.allSettled` 並行處理（並行數上限 5）

### 2.3 分頁安全限制
- `?all=true` 最大回傳 1000 筆

### 2.4 React Query 快取策略
- 站區/品項：`staleTime: 5 分鐘`
- 儀表板：`staleTime: 30 秒`

---

## 區塊 3：錯誤處理 + 穩定性

### 3.1 Express 全域錯誤中介層
### 3.2 Async 路由包裝器 `asyncHandler(fn)`
### 3.3 Prisma 錯誤轉換 `handlePrismaError(e)`
### 3.4 前端 Error Boundary
### 3.5 統一 API 錯誤回傳 `{ error: '...' }`

---

## 區塊 4：UX 改善

### 4.1 空狀態提示（Table locale）
### 4.2 TypeScript 型別加強（減少 any）

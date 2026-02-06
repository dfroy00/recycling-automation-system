# 階段五：測試與部署 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立完整的自動化測試套件（單元測試、整合測試、E2E 測試），撰寫部署腳本和操作文件，確保系統在正式環境中穩定運行

**Architecture:** 測試分三層：單元測試（已有基礎，補強覆蓋率）、整合測試（API 端對端 + 資料庫）、E2E 測試（Playwright 前端流程）。部署使用 Docker Compose 打包前後端 + 資料庫，搭配 PM2 進程管理。

**Tech Stack:** Vitest, Supertest, Playwright (E2E), Docker Compose, PM2

**前置條件:** 階段四已完成（所有功能模組就緒）

**參考文件:** 設計文檔「階段五：測試與上線」章節

---

### Task 1: 補強單元測試覆蓋率

**Files:**
- Create: `backend/tests/billing.service.test.ts`
- Create: `backend/tests/anomaly.service.test.ts`
- Create: `backend/tests/monthly-statement.service.test.ts`

**Step 1: 撰寫計費引擎完整測試**

```typescript
// backend/tests/billing.service.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  calculateTypeA,
  calculateTypeB,
  calculateTypeC,
  calculateTypeD,
} from '../src/services/billing.service'

// Mock Prisma
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    trip: { findMany: vi.fn() },
    itemCollected: { findMany: vi.fn() },
    contractPrice: { findMany: vi.fn() },
    itemPrice: { findFirst: vi.fn() },
  },
}))

describe('計費引擎', () => {
  describe('A 類客戶（回收物費 + 車趟費）', () => {
    it('應正確計算品項費 + 車趟費', async () => {
      const result = await calculateTypeA({
        customerId: 'C001',
        yearMonth: '2026-02',
        tripPrice: 300,
        items: [
          { itemName: '紙類', totalWeight: 450.5, unitPrice: 5.0 },
          { itemName: '塑膠', totalWeight: 220.3, unitPrice: 3.5 },
        ],
        tripCount: 8,
      })

      expect(result.tripFee).toBe(2400) // 8 * 300
      expect(result.itemFee).toBeCloseTo(3023.55) // 450.5*5 + 220.3*3.5
      expect(result.totalAmount).toBeCloseTo(5423.55)
    })

    it('無品項時品項費應為 0', async () => {
      const result = await calculateTypeA({
        customerId: 'C001',
        yearMonth: '2026-02',
        tripPrice: 300,
        items: [],
        tripCount: 3,
      })

      expect(result.itemFee).toBe(0)
      expect(result.totalAmount).toBe(900)
    })
  })

  describe('B 類客戶（僅車趟費）', () => {
    it('應只計算車趟費', async () => {
      const result = await calculateTypeB({
        customerId: 'C002',
        yearMonth: '2026-02',
        tripPrice: 500,
        tripCount: 3,
      })

      expect(result.tripFee).toBe(1500)
      expect(result.itemFee).toBe(0)
      expect(result.totalAmount).toBe(1500)
    })

    it('零車趟時金額應為 0', async () => {
      const result = await calculateTypeB({
        customerId: 'C002',
        yearMonth: '2026-02',
        tripPrice: 500,
        tripCount: 0,
      })

      expect(result.totalAmount).toBe(0)
    })
  })

  describe('C 類客戶（合約 + 牌價混合）', () => {
    it('有合約品項用合約價，無合約品項用牌價', async () => {
      const result = await calculateTypeC({
        customerId: 'C003',
        yearMonth: '2026-02',
        items: [
          { itemName: '紙類', totalWeight: 100, contractPrice: 4.5, standardPrice: 5.0 },
          { itemName: '金屬', totalWeight: 50, contractPrice: null, standardPrice: 8.0 },
        ],
      })

      expect(result.itemDetails[0].unitPrice).toBe(4.5) // 合約價
      expect(result.itemDetails[0].priceType).toBe('contract')
      expect(result.itemDetails[1].unitPrice).toBe(8.0) // 牌價
      expect(result.itemDetails[1].priceType).toBe('standard')
      expect(result.totalAmount).toBeCloseTo(850) // 100*4.5 + 50*8
    })
  })

  describe('D 類客戶（全牌價）', () => {
    it('所有品項都用牌價', async () => {
      const result = await calculateTypeD({
        customerId: 'C004',
        yearMonth: '2026-02',
        items: [
          { itemName: '紙類', totalWeight: 200, standardPrice: 5.0 },
          { itemName: '塑膠', totalWeight: 150, standardPrice: 3.5 },
        ],
      })

      expect(result.totalAmount).toBeCloseTo(1525) // 200*5 + 150*3.5
      expect(result.itemDetails.every(d => d.priceType === 'standard')).toBe(true)
    })
  })
})
```

**Step 2: 撰寫異常偵測測試**

```typescript
// backend/tests/anomaly.service.test.ts
import { describe, it, expect, vi } from 'vitest'
import { detectAnomalies, type AnomalyResult } from '../src/services/anomaly.service'

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    monthlyStatement: {
      findFirst: vi.fn(),
    },
  },
}))

describe('異常偵測', () => {
  it('金額差異 >30% 應標記為警告', async () => {
    const result = await detectAnomalies({
      customerId: 'C001',
      currentAmount: 13000,
      lastMonthAmount: 10000, // +30%
      lastYearAmount: 10000,
    })

    expect(result.anomaly).toBe(true)
    expect(result.level).toBe('warning')
  })

  it('與去年同期差異 >50% 應標記為重大異常', async () => {
    const result = await detectAnomalies({
      customerId: 'C001',
      currentAmount: 16000,
      lastMonthAmount: 10000,
      lastYearAmount: 10000, // +60%
    })

    expect(result.anomaly).toBe(true)
    expect(result.level).toBe('critical')
  })

  it('金額為 0 應標記為零金額', async () => {
    const result = await detectAnomalies({
      customerId: 'C001',
      currentAmount: 0,
      lastMonthAmount: 10000,
      lastYearAmount: 10000,
    })

    expect(result.anomaly).toBe(true)
    expect(result.level).toBe('zero')
  })

  it('正常金額不應標記異常', async () => {
    const result = await detectAnomalies({
      customerId: 'C001',
      currentAmount: 10500,
      lastMonthAmount: 10000,
      lastYearAmount: 10000,
    })

    expect(result.anomaly).toBe(false)
  })
})
```

**Step 3: 執行所有單元測試**

Run: `cd backend && npm test`
Expected: 所有測試通過

注意：部分測試函式的參數簽名可能與實際服務不完全一致，執行時需根據實際函式簽名調整。

**Step 4: Commit**

```bash
git add backend/tests/billing.service.test.ts backend/tests/anomaly.service.test.ts
git commit -m "test: 補強計費引擎和異常偵測單元測試 (A/B/C/D 類 + 30%/50%/零金額)"
```

---

### Task 2: 整合測試（API 端對端）

**Files:**
- Create: `backend/tests/integration/auth.integration.test.ts`
- Create: `backend/tests/integration/import-billing-flow.integration.test.ts`
- Create: `backend/tests/integration/setup.ts`

**Step 1: 建立整合測試基礎設施**

```typescript
// backend/tests/integration/setup.ts
import { prisma } from '../../src/lib/prisma'
import { hashPassword, generateToken } from '../../src/services/auth.service'

// 建立測試用管理員並取得 token
export async function getAdminToken(): Promise<string> {
  // 嘗試找到或建立測試管理員
  let admin = await prisma.user.findUnique({ where: { username: 'test_admin' } })

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        username: 'test_admin',
        password: await hashPassword('test123'),
        name: '測試管理員',
        role: 'system_admin',
        siteId: 'S001',
        email: 'admin@test.com',
        status: 'active',
      },
    })
  }

  return generateToken(admin)
}

// 清理測試資料
export async function cleanupTestData() {
  // 只清理測試資料，不影響 seed 資料
  await prisma.systemLog.deleteMany({ where: { eventContent: { contains: '[test]' } } })
}
```

**Step 2: 撰寫認證整合測試**

```typescript
// backend/tests/integration/auth.integration.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('認證 API 整合測試', () => {
  it('POST /api/auth/login - 正確帳密應回傳 token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body).toHaveProperty('user')
    expect(res.body.user.role).toBe('system_admin')
  })

  it('POST /api/auth/login - 錯誤密碼應回傳 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' })

    expect(res.status).toBe(401)
  })

  it('GET /api/sites - 無 token 應回傳 401', async () => {
    const res = await request(app).get('/api/sites')
    expect(res.status).toBe(401)
  })

  it('GET /api/sites - 有效 token 應回傳 200', async () => {
    // 先登入取得 token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })

    const res = await request(app)
      .get('/api/sites')
      .set('Authorization', `Bearer ${loginRes.body.token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
```

**Step 3: 撰寫匯入→計費完整流程整合測試**

```typescript
// backend/tests/integration/import-billing-flow.integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import path from 'path'
import fs from 'fs'

describe('匯入→計費完整流程', () => {
  let token: string

  beforeAll(async () => {
    // 登入取得 admin token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
    token = res.body.token
  })

  it('Step 1: 查詢客戶清單應有 seed 資料', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('Step 2: 查詢品項單價應有 seed 資料', async () => {
    const res = await request(app)
      .get('/api/item-prices')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('Step 3: 儀表板統計 API 應回傳正確結構', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('todayTrips')
    expect(res.body).toHaveProperty('todayItems')
    expect(res.body).toHaveProperty('monthlyTrips')
  })

  it('Step 4: 月結明細產生 API 應成功', async () => {
    const res = await request(app)
      .post('/api/reports/monthly/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ yearMonth: '2026-01' }) // 用過去的月份避免衝突

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('total')
  })

  it('Step 5: 查詢月結明細應有資料', async () => {
    const res = await request(app)
      .get('/api/reports/monthly')
      .set('Authorization', `Bearer ${token}`)
      .query({ yearMonth: '2026-01' })

    expect(res.status).toBe(200)
  })

  it('Step 6: 排程狀態 API 應回傳正確結構', async () => {
    const res = await request(app)
      .get('/api/schedule/status')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('schedulerEnabled')
    expect(res.body).toHaveProperty('schedules')
  })
})
```

**Step 4: 執行整合測試**

Run:
```bash
cd backend && npm test -- integration
```
Expected: 所有整合測試通過

注意：整合測試需要實際的 PostgreSQL 資料庫連線。確保 Docker Compose 正在運行且 seed 資料已匯入。

**Step 5: Commit**

```bash
git add backend/tests/integration/
git commit -m "test: 新增整合測試 (認證流程 + 匯入→計費完整流程)"
```

---

### Task 3: 前端 E2E 測試

**Files:**
- Create: `frontend/e2e/login.spec.ts`
- Create: `frontend/e2e/dashboard.spec.ts`
- Create: `frontend/playwright.config.ts`
- Modify: `frontend/package.json`

**Step 1: 安裝 Playwright**

Run:
```bash
cd frontend
npm install -D @playwright/test
npx playwright install chromium
```

**Step 2: 建立 Playwright 配置**

```typescript
// frontend/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
})
```

**Step 3: 撰寫登入頁面 E2E 測試**

```typescript
// frontend/e2e/login.spec.ts
import { test, expect } from '@playwright/test'

test.describe('登入頁面', () => {
  test('應顯示登入表單', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading')).toContainText('登入')
    await expect(page.getByPlaceholder('使用者帳號')).toBeVisible()
    await expect(page.getByPlaceholder('密碼')).toBeVisible()
  })

  test('空白表單提交應顯示錯誤', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /登入/ }).click()
    // Ant Design 表單驗證應顯示錯誤訊息
    await expect(page.locator('.ant-form-item-explain')).toBeVisible()
  })

  test('錯誤密碼應顯示錯誤訊息', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('使用者帳號').fill('admin')
    await page.getByPlaceholder('密碼').fill('wrongpassword')
    await page.getByRole('button', { name: /登入/ }).click()
    // 應顯示錯誤提示
    await expect(page.locator('.ant-message-error')).toBeVisible({ timeout: 10000 })
  })

  test('正確帳密應跳轉到儀表板', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('使用者帳號').fill('admin')
    await page.getByPlaceholder('密碼').fill('admin123')
    await page.getByRole('button', { name: /登入/ }).click()
    // 應跳轉到首頁（儀表板）
    await expect(page).toHaveURL('/', { timeout: 10000 })
  })
})
```

**Step 4: 撰寫儀表板 E2E 測試**

```typescript
// frontend/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

// 共用登入步驟
async function login(page: any) {
  await page.goto('/login')
  await page.getByPlaceholder('使用者帳號').fill('admin')
  await page.getByPlaceholder('密碼').fill('admin123')
  await page.getByRole('button', { name: /登入/ }).click()
  await expect(page).toHaveURL('/', { timeout: 10000 })
}

test.describe('儀表板', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('應顯示統計卡片', async ({ page }) => {
    // 應有統計數字卡片
    await expect(page.locator('.ant-card')).toHaveCount(4, { timeout: 10000 })
  })

  test('側邊欄應包含所有選單項目', async ({ page }) => {
    await expect(page.getByText('儀表板')).toBeVisible()
    await expect(page.getByText('站點管理')).toBeVisible()
    await expect(page.getByText('客戶管理')).toBeVisible()
  })

  test('點擊客戶管理應跳轉', async ({ page }) => {
    await page.getByText('客戶管理').click()
    await expect(page).toHaveURL('/customers', { timeout: 5000 })
  })
})
```

**Step 5: 在 package.json 加入 E2E 測試 script**

在 `frontend/package.json` 的 scripts 加入：

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Step 6: 執行 E2E 測試**

Run:
```bash
cd frontend && npx playwright test
```

注意：E2E 測試需要後端服務和前端開發伺服器同時運行。

**Step 7: Commit**

```bash
git add frontend/e2e/ frontend/playwright.config.ts frontend/package.json
git commit -m "test: 新增前端 E2E 測試 (Playwright - 登入 + 儀表板)"
```

---

### Task 4: Docker 正式環境部署配置

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Create: `nginx.conf`

**Step 1: 建立 Backend Dockerfile**

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/output ./output

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Step 2: 建立 Frontend Dockerfile**

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Step 3: 建立 Nginx 配置**

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # React Router - SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 靜態檔案快取
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Step 4: 建立正式環境 Docker Compose**

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-recycle_db}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-recycle_db}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-8h}
      PORT: 3000
      ENABLE_SCHEDULER: "true"
      ENABLE_FILE_WATCHER: "true"
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM: ${SMTP_FROM}
      LINE_CHANNEL_ACCESS_TOKEN: ${LINE_CHANNEL_ACCESS_TOKEN}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      FINANCE_EMAIL: ${FINANCE_EMAIL}
    volumes:
      - ./data:/app/data
      - ./output:/app/output

  frontend:
    build: ./frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "${APP_PORT:-80}:80"

volumes:
  postgres_data:
```

**Step 5: 在 backend 加入 build script**

在 `backend/package.json` 的 scripts 確認有：

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 6: 測試 Docker Build**

Run:
```bash
docker compose -f docker-compose.prod.yml build
```

Expected: 前後端映像檔建置成功

**Step 7: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile docker-compose.prod.yml nginx.conf
git commit -m "chore: 新增 Docker 正式環境部署配置 (Backend + Frontend + Nginx + PostgreSQL)"
```

---

### Task 5: 部署啟動腳本

**Files:**
- Create: `scripts/deploy.sh`
- Create: `scripts/backup-db.sh`
- Create: `scripts/restore-db.sh`

**Step 1: 建立部署腳本**

```bash
#!/bin/bash
# scripts/deploy.sh
# 回收自動化系統部署腳本

set -e

echo "=========================================="
echo "  回收自動化系統 - 部署腳本"
echo "=========================================="

# 檢查 .env 是否存在
if [ ! -f .env ]; then
  echo "錯誤：找不到 .env 檔案，請先複製 .env.example 並填寫設定"
  exit 1
fi

# 檢查必要環境變數
source .env
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "recycling-system-jwt-secret-2026" ]; then
  echo "警告：請修改 JWT_SECRET 為正式環境的安全密鑰"
fi

if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "postgres123" ]; then
  echo "警告：請修改 POSTGRES_PASSWORD 為正式環境的安全密碼"
fi

echo ""
echo "Step 1: 建置 Docker 映像檔..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "Step 2: 啟動服務..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 3: 等待資料庫就緒..."
sleep 5

echo ""
echo "Step 4: 執行資料庫遷移..."
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

echo ""
echo "Step 5: 匯入初始資料（如首次部署）..."
read -p "是否執行 seed（首次部署請選 y）？[y/N] " answer
if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
  docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
  echo "Seed 完成"
fi

echo ""
echo "=========================================="
echo "  部署完成！"
echo "  前端：http://localhost:${APP_PORT:-80}"
echo "  後端 API：http://localhost:3000/api"
echo "=========================================="
echo ""
echo "常用命令："
echo "  查看日誌：docker compose -f docker-compose.prod.yml logs -f"
echo "  停止服務：docker compose -f docker-compose.prod.yml down"
echo "  備份資料庫：bash scripts/backup-db.sh"
```

**Step 2: 建立資料庫備份腳本**

```bash
#!/bin/bash
# scripts/backup-db.sh
# 資料庫備份腳本

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/recycle_db_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "正在備份資料庫到 ${BACKUP_FILE}..."

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U postgres recycle_db > "$BACKUP_FILE"

# 壓縮
gzip "$BACKUP_FILE"
echo "備份完成：${BACKUP_FILE}.gz"

# 保留最近 30 天的備份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "已清理 30 天前的備份"
```

**Step 3: 建立資料庫還原腳本**

```bash
#!/bin/bash
# scripts/restore-db.sh
# 資料庫還原腳本

set -e

if [ -z "$1" ]; then
  echo "用法：bash scripts/restore-db.sh <backup_file.sql.gz>"
  echo ""
  echo "可用備份："
  ls -la backups/*.sql.gz 2>/dev/null || echo "  （無備份檔案）"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "錯誤：找不到備份檔案 $BACKUP_FILE"
  exit 1
fi

echo "警告：此操作將覆蓋現有資料庫！"
read -p "確定要還原嗎？[y/N] " answer
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
  echo "已取消"
  exit 0
fi

echo "正在還原資料庫..."
gunzip -c "$BACKUP_FILE" | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres recycle_db

echo "還原完成"
```

**Step 4: 設定執行權限、Commit**

Run:
```bash
chmod +x scripts/deploy.sh scripts/backup-db.sh scripts/restore-db.sh
```

```bash
git add scripts/
git commit -m "chore: 新增部署和資料庫備份/還原腳本"
```

---

### Task 6: 環境變數驗證與健康檢查增強

**Files:**
- Create: `backend/src/utils/env-validator.ts`
- Modify: `backend/src/index.ts`

**Step 1: 建立環境變數驗證**

```typescript
// backend/src/utils/env-validator.ts

interface EnvVar {
  name: string
  required: boolean
  defaultValue?: string
  description: string
}

const ENV_VARS: EnvVar[] = [
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL 連線字串' },
  { name: 'JWT_SECRET', required: true, description: 'JWT 簽發密鑰' },
  { name: 'JWT_EXPIRES_IN', required: false, defaultValue: '8h', description: 'JWT 過期時間' },
  { name: 'PORT', required: false, defaultValue: '3000', description: '伺服器埠號' },
  { name: 'CORS_ORIGIN', required: false, defaultValue: 'http://localhost:5173', description: 'CORS 允許來源' },
  { name: 'SMTP_HOST', required: false, description: 'SMTP 主機' },
  { name: 'SMTP_USER', required: false, description: 'SMTP 帳號' },
  { name: 'SMTP_PASS', required: false, description: 'SMTP 密碼' },
  { name: 'LINE_CHANNEL_ACCESS_TOKEN', required: false, description: 'LINE Channel Token' },
  { name: 'ADMIN_EMAIL', required: false, description: '管理員 Email' },
  { name: 'ENABLE_SCHEDULER', required: false, defaultValue: 'false', description: '啟用排程' },
  { name: 'ENABLE_FILE_WATCHER', required: false, defaultValue: 'false', description: '啟用檔案監控' },
]

export function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  for (const v of ENV_VARS) {
    const value = process.env[v.name]

    if (v.required && !value) {
      errors.push(`缺少必要環境變數: ${v.name} (${v.description})`)
    }

    if (!v.required && !value && v.defaultValue) {
      process.env[v.name] = v.defaultValue
      warnings.push(`使用預設值: ${v.name}=${v.defaultValue}`)
    }
  }

  // 安全性檢查
  if (process.env.JWT_SECRET === 'recycling-system-jwt-secret-2026') {
    warnings.push('JWT_SECRET 使用預設值，正式環境請修改')
  }

  return { valid: errors.length === 0, errors, warnings }
}
```

**Step 2: 在 index.ts 加入啟動驗證**

在 `backend/src/index.ts` 伺服器啟動前加入：

```typescript
import { validateEnv } from './utils/env-validator'

// 在 app.listen 之前
const envResult = validateEnv()
if (!envResult.valid) {
  console.error('環境變數驗證失敗：')
  envResult.errors.forEach(e => console.error(`  ❌ ${e}`))
  process.exit(1)
}
if (envResult.warnings.length > 0) {
  console.warn('環境變數警告：')
  envResult.warnings.forEach(w => console.warn(`  ⚠️ ${w}`))
}
```

**Step 3: Commit**

```bash
git add backend/src/utils/env-validator.ts backend/src/index.ts
git commit -m "feat: 新增啟動時環境變數驗證 (必要變數 + 安全性檢查)"
```

---

### Task 7: 更新 .env.example 與最終整合驗證

**Files:**
- Modify: `.env.example`
- Modify: `backend/package.json` (scripts)

**Step 1: 完整的 .env.example**

```bash
# ===== 資料庫 =====
POSTGRES_DB=recycle_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=請修改為安全密碼
DB_PORT=5432
DATABASE_URL=postgresql://postgres:請修改為安全密碼@localhost:5432/recycle_db

# ===== JWT =====
JWT_SECRET=請修改為安全的隨機字串
JWT_EXPIRES_IN=8h

# ===== 伺服器 =====
PORT=3000
CORS_ORIGIN=http://localhost:5173

# ===== 檔案監控 =====
ENABLE_FILE_WATCHER=true
TRIP_WATCH_DIR=./data/trips
ITEM_WATCH_DIR=./data/items
DEFAULT_SITE_ID=S001

# ===== 排程 =====
ENABLE_SCHEDULER=true
SCHEDULE_FILE_WATCH=0 * * * *
SCHEDULE_DATA_INTEGRITY=0 23 * * *
SCHEDULE_CONTRACT_SCAN=0 10 * * *
SCHEDULE_MONTHLY_BILLING=0 9 30 * *
SCHEDULE_INVOICE=0 9 15 * *
SCHEDULE_RETRY_NOTIFICATION=0 9 * * *

# ===== Email (SMTP) =====
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com

# ===== LINE =====
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# ===== 通知 =====
ADMIN_EMAIL=admin@example.com
FINANCE_EMAIL=finance@example.com
FRONTEND_URL=http://localhost:5173

# ===== Docker 正式環境 =====
APP_PORT=80
```

**Step 2: 確認 backend package.json scripts 完整**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 3: 執行所有測試驗證**

Run:
```bash
cd backend && npm test
```

Expected: 所有單元測試和整合測試通過

Run:
```bash
cd frontend && npm run build
```

Expected: 前端建置成功

**Step 4: Commit**

```bash
git add .env.example backend/package.json
git commit -m "chore: 更新完整環境變數範例與建置腳本"
```

---

## 階段五完成標準

- [ ] 計費引擎完整單元測試（A/B/C/D 四種類型）
- [ ] 異常偵測單元測試（30%/50%/零金額）
- [ ] 認證 API 整合測試（登入/權限/Token）
- [ ] 匯入→計費完整流程整合測試
- [ ] 前端 E2E 測試（Playwright - 登入/儀表板/導航）
- [ ] Backend Dockerfile
- [ ] Frontend Dockerfile + Nginx 配置
- [ ] 正式環境 Docker Compose（多容器編排）
- [ ] 部署腳本（deploy + backup + restore）
- [ ] 環境變數驗證器
- [ ] 完整 .env.example
- [ ] 所有測試通過

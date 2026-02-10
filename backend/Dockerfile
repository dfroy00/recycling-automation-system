# ============================
# 階段 1: 基礎依賴安裝
# ============================
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate

# ============================
# 階段 2: 開發環境（含 hot-reload）
# ============================
FROM base AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
# 啟動時執行 migration 並啟動開發伺服器
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx watch src/index.ts"]

# ============================
# 階段 3: 建置
# ============================
FROM base AS build
COPY . .
RUN npm run build

# ============================
# 階段 4: 生產環境（精簡映像）
# ============================
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# 只複製生產依賴
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# 複製 Prisma schema 與編譯後的程式碼
COPY --from=build /app/prisma ./prisma/
COPY --from=build /app/dist ./dist/

# 產生 Prisma Client
RUN npx prisma generate

EXPOSE 3000
# 啟動時執行 migration 並啟動伺服器
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

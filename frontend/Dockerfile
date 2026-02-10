# ============================
# 階段 1: 基礎依賴安裝
# ============================
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ============================
# 階段 2: 開發環境（Vite HMR）
# ============================
FROM base AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

# ============================
# 階段 3: 建置靜態檔案
# ============================
FROM base AS build
COPY . .
RUN npm run build

# ============================
# 階段 4: 生產環境（nginx 提供靜態檔案）
# ============================
FROM nginx:alpine AS production
# 複製 nginx 設定
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 複製建置產出
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

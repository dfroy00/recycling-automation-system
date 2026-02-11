// backend/src/index.ts
import dotenv from 'dotenv'
dotenv.config()

// 啟動前檢查必要環境變數
if (!process.env.JWT_SECRET) {
  console.error('錯誤：JWT_SECRET 環境變數未設定，伺服器無法啟動')
  console.error('請在 .env 檔案中設定 JWT_SECRET=<你的密鑰>')
  process.exit(1)
}

import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`)
})

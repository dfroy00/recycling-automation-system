import dotenv from 'dotenv'
dotenv.config()

import app from './app'
import { startFileWatcher } from './services/file-watcher'
import { startScheduler } from './services/scheduler.service'
import path from 'path'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`)

  // 啟動檔案監控（可透過環境變數開關）
  if (process.env.ENABLE_FILE_WATCHER === 'true') {
    startFileWatcher({
      tripDir: process.env.TRIP_WATCH_DIR || path.join(__dirname, '../data/trips'),
      itemDir: process.env.ITEM_WATCH_DIR || path.join(__dirname, '../data/items'),
      defaultSiteId: process.env.DEFAULT_SITE_ID || 'S001',
    })
  }

  // 啟動排程服務
  startScheduler()
})

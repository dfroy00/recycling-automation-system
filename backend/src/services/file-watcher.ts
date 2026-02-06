// backend/src/services/file-watcher.ts
import chokidar from 'chokidar'
import path from 'path'
import { importTrips, importItems } from './import.service'
import { prisma } from '../lib/prisma'

// 已處理過的檔案記錄（防止重複匯入）
const processedFiles = new Set<string>()

// 啟動檔案監控
export function startFileWatcher(config: {
  tripDir: string
  itemDir: string
  defaultSiteId: string
}) {
  console.log(`啟動檔案監控...`)
  console.log(`  車趟資料夾: ${config.tripDir}`)
  console.log(`  品項資料夾: ${config.itemDir}`)

  // 監控車趟資料夾
  const tripWatcher = chokidar.watch(config.tripDir, {
    ignored: /(^|[\/\\])\./, // 忽略隱藏檔
    persistent: true,
    ignoreInitial: true, // 不處理已存在的檔案
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
  })

  tripWatcher.on('add', async (filePath) => {
    if (processedFiles.has(filePath)) return
    const ext = path.extname(filePath).toLowerCase()
    if (ext !== '.xlsx' && ext !== '.xls') return

    console.log(`偵測到新車趟檔案: ${filePath}`)
    processedFiles.add(filePath)

    try {
      const result = await importTrips(filePath, config.defaultSiteId)
      console.log(`車趟匯入完成: ${result.imported}/${result.total} 筆成功`)
    } catch (error: any) {
      console.error(`車趟匯入失敗: ${error.message}`)
      await prisma.systemLog.create({
        data: {
          eventType: 'error',
          eventContent: `檔案監控匯入失敗: ${filePath} - ${error.message}`,
        },
      })
    }
  })

  // 監控品項資料夾
  const itemWatcher = chokidar.watch(config.itemDir, {
    ignored: /(^|[\/\\])\./,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
  })

  itemWatcher.on('add', async (filePath) => {
    if (processedFiles.has(filePath)) return
    const ext = path.extname(filePath).toLowerCase()
    if (ext !== '.xlsx' && ext !== '.xls') return

    console.log(`偵測到新品項檔案: ${filePath}`)
    processedFiles.add(filePath)

    try {
      const result = await importItems(filePath, config.defaultSiteId)
      console.log(`品項匯入完成: ${result.imported}/${result.total} 筆成功`)
    } catch (error: any) {
      console.error(`品項匯入失敗: ${error.message}`)
      await prisma.systemLog.create({
        data: {
          eventType: 'error',
          eventContent: `檔案監控匯入失敗: ${filePath} - ${error.message}`,
        },
      })
    }
  })

  return { tripWatcher, itemWatcher }
}

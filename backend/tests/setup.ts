import { prisma } from '../src/lib/prisma'
import { afterAll } from 'vitest'

// 測試結束後斷開資料庫連線
afterAll(async () => {
  await prisma.$disconnect()
})

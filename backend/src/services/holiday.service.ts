// backend/src/services/holiday.service.ts
import prisma from '../lib/prisma'

// 檢查指定日期是否為假日（週六日 + 國定假日）
export async function isHoliday(date: Date): Promise<boolean> {
  const day = date.getDay()
  // 週六(6) 或 週日(0)
  if (day === 0 || day === 6) return true

  // 檢查國定假日
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const holiday = await prisma.holiday.findUnique({ where: { date: startOfDay } })
  return !!holiday
}

// 取得最近的前一個工作日（若當天是工作日則回傳當天）
export async function getWorkday(targetDate: Date): Promise<Date> {
  let current = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  // 最多往前推 14 天（避免無窮迴圈）
  for (let i = 0; i < 14; i++) {
    if (!(await isHoliday(current))) {
      return current
    }
    current.setDate(current.getDate() - 1)
  }
  return current
}

// 計算指定月份的工作日天數
export async function getWorkdaysInMonth(year: number, month: number): Promise<number> {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // 當月最後一天
  let count = 0

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!(await isHoliday(new Date(d)))) {
      count++
    }
  }
  return count
}

// backend/src/__tests__/holiday.service.test.ts
import prisma from '../lib/prisma'
import { isHoliday, getWorkday, getWorkdaysInMonth } from '../services/holiday.service'

beforeAll(async () => {
  // 使用 2028 年避免與 seed 國定假日衝突
  // 用本地時間建構日期（與 isHoliday 服務一致）
  const holiday1 = new Date(2028, 2, 15) // 2028-03-15 星期三
  const holiday2 = new Date(2028, 2, 16) // 2028-03-16 星期四
  await prisma.holiday.upsert({
    where: { date: holiday1 },
    update: {},
    create: { date: holiday1, name: '測試假日A', year: 2028 },
  })
  await prisma.holiday.upsert({
    where: { date: holiday2 },
    update: {},
    create: { date: holiday2, name: '測試假日B', year: 2028 },
  })
})

afterAll(async () => {
  // 清理測試假日
  await prisma.holiday.deleteMany({ where: { year: 2028 } })
  await prisma.$disconnect()
})

describe('假日服務 isHoliday', () => {
  // 2028-03-01 是星期三（工作日，DB 中無此日的假日）
  test('一般工作日不是假日', async () => {
    const result = await isHoliday(new Date(2028, 2, 1))
    expect(result).toBe(false)
  })

  // 2028-03-04 是星期六
  test('星期六是假日', async () => {
    const result = await isHoliday(new Date(2028, 2, 4))
    expect(result).toBe(true)
  })

  // 2028-03-05 是星期日
  test('星期日是假日', async () => {
    const result = await isHoliday(new Date(2028, 2, 5))
    expect(result).toBe(true)
  })

  // 2028-03-15 是測試假日A（星期三，工作日但在 DB 中標記為假日）
  test('國定假日是假日', async () => {
    const result = await isHoliday(new Date(2028, 2, 15))
    expect(result).toBe(true)
  })

  // 2028-03-17 星期五，不是假日
  test('假日前後的工作日不受影響', async () => {
    const result = await isHoliday(new Date(2028, 2, 17))
    expect(result).toBe(false)
  })
})

describe('假日服務 getWorkday', () => {
  // 2028-03-01 星期三 -> 回傳當天
  test('工作日回傳當天', async () => {
    const result = await getWorkday(new Date(2028, 2, 1))
    expect(result.getDate()).toBe(1)
    expect(result.getMonth()).toBe(2) // 0-indexed: March = 2
  })

  // 2028-03-04 星期六 -> 回傳 2028-03-03 星期五
  test('星期六往前推到星期五', async () => {
    const result = await getWorkday(new Date(2028, 2, 4))
    expect(result.getDate()).toBe(3)
  })

  // 2028-03-05 星期日 -> 回傳 2028-03-03 星期五
  test('星期日往前推到星期五', async () => {
    const result = await getWorkday(new Date(2028, 2, 5))
    expect(result.getDate()).toBe(3)
  })

  // 2028-03-15 假日A（週三）-> 回傳 2028-03-14 星期二
  test('國定假日往前推到工作日', async () => {
    const result = await getWorkday(new Date(2028, 2, 15))
    expect(result.getDate()).toBe(14)
  })

  // 2028-03-16 假日B（週四），3/15 也是假日 -> 回傳 2028-03-14 星期二
  test('連續國定假日往前推到工作日', async () => {
    const result = await getWorkday(new Date(2028, 2, 16))
    expect(result.getDate()).toBe(14)
  })
})

describe('假日服務 getWorkdaysInMonth', () => {
  test('有國定假日的月份正確扣除', async () => {
    // 2028 年 3 月：31 天
    // 週末：4,5,11,12,18,19,25,26 = 8 天
    // 工作日（無假日）：31 - 8 = 23
    // 國定假日落在工作日：3/15 (Wed), 3/16 (Thu) = 2 天
    // 實際工作日：23 - 2 = 21
    const count = await getWorkdaysInMonth(2028, 3)
    expect(count).toBe(21)
  })

  test('無國定假日的月份正確計算', async () => {
    // 2028 年 8 月：31 天
    // 8/1 Tue, 週末: 5,6,12,13,19,20,26,27 = 8 天
    // 無國定假日 -> 23 工作日
    const count = await getWorkdaysInMonth(2028, 8)
    expect(count).toBe(23)
  })
})

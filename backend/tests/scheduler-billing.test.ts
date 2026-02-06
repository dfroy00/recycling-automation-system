import { describe, it, expect } from 'vitest'
import { adjustForHoliday, getWorkingDay } from '../src/services/scheduler.service'
import dayjs from 'dayjs'

describe('例假日調整', () => {
  it('平日應回傳同一天', () => {
    // 2026-02-06 是星期五
    const result = getWorkingDay(dayjs('2026-02-06'))
    expect(result.format('YYYY-MM-DD')).toBe('2026-02-06')
  })

  it('週六應回傳上一個星期五', () => {
    // 2026-02-07 是星期六
    const result = getWorkingDay(dayjs('2026-02-07'))
    expect(result.format('YYYY-MM-DD')).toBe('2026-02-06')
  })

  it('週日應回傳上一個星期五', () => {
    // 2026-02-08 是星期日
    const result = getWorkingDay(dayjs('2026-02-08'))
    expect(result.format('YYYY-MM-DD')).toBe('2026-02-06')
  })

  it('30 號遇例假日應提前到最近工作日', () => {
    const result = adjustForHoliday(2026, 5, 30) // 2026-05-30 是星期六
    expect(result.day()).not.toBe(0) // 不是星期日
    expect(result.day()).not.toBe(6) // 不是星期六
  })

  it('15 號遇例假日應提前到最近工作日', () => {
    const result = adjustForHoliday(2026, 2, 15) // 2026-02-15 是星期日
    expect(result.day()).not.toBe(0)
    expect(result.day()).not.toBe(6)
  })
})

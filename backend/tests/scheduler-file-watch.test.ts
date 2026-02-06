import { describe, it, expect, vi } from 'vitest'
import { checkForNewFiles } from '../src/services/scheduler.service'
import fs from 'fs'

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      readdirSync: vi.fn().mockReturnValue(['trip_2026-02-05.xlsx', 'item_2026-02-05.xlsx']),
      statSync: vi.fn().mockReturnValue({ mtime: new Date() }),
    },
  }
})

describe('檔案監控排程', () => {
  it('應掃描指定目錄並回傳新檔案清單', async () => {
    const result = await checkForNewFiles('/fake/watch/dir')
    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
  })

  it('目錄不存在時應回傳空陣列', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false)
    const result = await checkForNewFiles('/nonexistent')
    expect(result).toEqual([])
  })
})

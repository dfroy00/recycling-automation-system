// backend/src/__tests__/mock-pos-adapter.test.ts
// Mock POS Adapter 測試
import prisma from '../lib/prisma'
import { MockPosAdapter } from '../adapters/mock/mock-pos.adapter'

let adapter: MockPosAdapter
let testSiteId: number
let testCustomerId: number
let testMockRecordId: number

beforeAll(async () => {
  adapter = new MockPosAdapter()

  // 建立測試站區
  const site = await prisma.site.create({
    data: { name: '測試站_pos_adapter', status: 'active' },
  })
  testSiteId = site.id

  // 建立測試客戶
  const customer = await prisma.customer.create({
    data: {
      siteId: testSiteId,
      name: '測試客戶_pos_adapter',
      type: 'contracted',
      notificationMethod: 'email',
    },
  })
  testCustomerId = customer.id

  // 建立測試 mock POS 紀錄
  const record = await prisma.mockPosCollection.create({
    data: {
      externalId: 'POS-TEST-001',
      siteName: '測試站_pos_adapter',
      customerName: '測試客戶_pos_adapter',
      collectionDate: new Date('2099-06-15'),
      itemName: '總紙',
      quantity: 100,
      unit: 'kg',
      unitPrice: 3.5,
    },
  })
  testMockRecordId = record.id
})

afterAll(async () => {
  // 清理測試資料
  await prisma.mockPosCollection.deleteMany({
    where: { externalId: { startsWith: 'POS-TEST' } },
  }).catch(() => {})
  await prisma.systemLog.deleteMany({
    where: { eventType: { startsWith: 'mock_sync' } },
  }).catch(() => {})
  await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {})
  await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('MockPosAdapter.getCollectionRecords', () => {
  it('依日期範圍查詢未匯入的收運紀錄', async () => {
    const records = await adapter.getCollectionRecords({
      dateFrom: new Date('2099-06-01'),
      dateTo: new Date('2099-06-30'),
    })

    expect(Array.isArray(records)).toBe(true)
    const found = records.find((r) => r.externalId === 'POS-TEST-001')
    expect(found).toBeDefined()
    expect(found!.siteName).toBe('測試站_pos_adapter')
    expect(found!.customerName).toBe('測試客戶_pos_adapter')
    expect(found!.quantity).toBe(100)
  })

  it('依站區 ID 篩選', async () => {
    const records = await adapter.getCollectionRecords({
      siteId: testSiteId,
      dateFrom: new Date('2099-06-01'),
      dateTo: new Date('2099-06-30'),
    })

    records.forEach((r) => {
      expect(r.siteName).toBe('測試站_pos_adapter')
    })
  })

  it('不在日期範圍內不回傳', async () => {
    const records = await adapter.getCollectionRecords({
      dateFrom: new Date('2099-01-01'),
      dateTo: new Date('2099-01-31'),
    })

    const found = records.find((r) => r.externalId === 'POS-TEST-001')
    expect(found).toBeUndefined()
  })
})

describe('MockPosAdapter.getLatestRecords', () => {
  it('回傳指定時間之後建立的紀錄', async () => {
    const records = await adapter.getLatestRecords(new Date('2020-01-01'))
    expect(Array.isArray(records)).toBe(true)
    // 應包含我們的測試紀錄
    const found = records.find((r) => r.externalId === 'POS-TEST-001')
    expect(found).toBeDefined()
  })
})

describe('MockPosAdapter.syncCustomer', () => {
  it('同步客戶至 POS（mock 記錄到 system_logs）', async () => {
    await adapter.syncCustomer({
      id: testCustomerId,
      name: '測試客戶_pos_adapter',
      siteName: '測試站_pos_adapter',
    })

    // 檢查 system_logs 是否有記錄
    const log = await prisma.systemLog.findFirst({
      where: {
        eventType: 'mock_sync_customer_to_pos',
        eventContent: { contains: '測試客戶_pos_adapter' },
      },
    })
    expect(log).not.toBeNull()
  })
})

describe('MockPosAdapter.syncContractPrices', () => {
  it('同步合約品項定價至 POS（mock 記錄到 system_logs）', async () => {
    await adapter.syncContractPrices([
      { customerName: '測試客戶_pos_adapter', itemName: '總紙', unitPrice: 3.5, billingDirection: 'payable' },
    ])

    const log = await prisma.systemLog.findFirst({
      where: {
        eventType: 'mock_sync_prices_to_pos',
        eventContent: { contains: '1 筆合約品項' },
      },
    })
    expect(log).not.toBeNull()
  })
})

describe('MockPosAdapter.healthCheck', () => {
  it('健康檢查回傳 ok', async () => {
    const result = await adapter.healthCheck()
    expect(result.status).toBe('ok')
    expect(result.mode).toBe('mock')
  })
})

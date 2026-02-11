// backend/src/__tests__/mock-vehicle-adapter.test.ts
// Mock Vehicle Adapter 測試
import prisma from '../lib/prisma'
import { MockVehicleAdapter } from '../adapters/mock/mock-vehicle.adapter'

let adapter: MockVehicleAdapter
let testSiteId: number
let testCustomerId: number

beforeAll(async () => {
  adapter = new MockVehicleAdapter()

  // 建立測試站區
  const site = await prisma.site.create({
    data: { name: '測試站_vehicle_adapter', status: 'active' },
  })
  testSiteId = site.id

  // 建立測試客戶
  const customer = await prisma.customer.create({
    data: {
      siteId: testSiteId,
      name: '測試客戶_vehicle_adapter',
      type: 'contracted',
      notificationMethod: 'email',
    },
  })
  testCustomerId = customer.id

  // 建立測試 mock 車機紀錄
  await prisma.mockVehicleTrip.create({
    data: {
      externalId: 'VT-TEST-001',
      siteName: '測試站_vehicle_adapter',
      customerName: '測試客戶_vehicle_adapter',
      tripDate: new Date('2099-07-15'),
      tripTime: '09:30',
      driver: '測試司機',
      vehiclePlate: 'TEST-1234',
      status: 'completed',
    },
  })
})

afterAll(async () => {
  // 清理測試資料
  await prisma.mockVehicleTrip.deleteMany({
    where: { externalId: { startsWith: 'VT-TEST' } },
  }).catch(() => {})
  await prisma.systemLog.deleteMany({
    where: {
      eventType: { in: ['mock_sync_customer_to_vehicle', 'mock_dispatch_trip'] },
    },
  }).catch(() => {})
  await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {})
  await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('MockVehicleAdapter.getTripRecords', () => {
  it('依日期範圍查詢未匯入的車趟紀錄', async () => {
    const records = await adapter.getTripRecords({
      dateFrom: new Date('2099-07-01'),
      dateTo: new Date('2099-07-31'),
    })

    expect(Array.isArray(records)).toBe(true)
    const found = records.find((r) => r.externalId === 'VT-TEST-001')
    expect(found).toBeDefined()
    expect(found!.driver).toBe('測試司機')
    expect(found!.vehiclePlate).toBe('TEST-1234')
    expect(found!.tripTime).toBe('09:30')
  })

  it('依站區 ID 篩選', async () => {
    const records = await adapter.getTripRecords({
      siteId: testSiteId,
      dateFrom: new Date('2099-07-01'),
      dateTo: new Date('2099-07-31'),
    })

    records.forEach((r) => {
      expect(r.siteName).toBe('測試站_vehicle_adapter')
    })
  })

  it('不在日期範圍內不回傳', async () => {
    const records = await adapter.getTripRecords({
      dateFrom: new Date('2099-01-01'),
      dateTo: new Date('2099-01-31'),
    })

    const found = records.find((r) => r.externalId === 'VT-TEST-001')
    expect(found).toBeUndefined()
  })
})

describe('MockVehicleAdapter.getVehicleStatus', () => {
  it('回傳模擬車輛狀態列表', async () => {
    const statuses = await adapter.getVehicleStatus()
    expect(Array.isArray(statuses)).toBe(true)
    expect(statuses.length).toBeGreaterThanOrEqual(1)
    statuses.forEach((s) => {
      expect(s).toHaveProperty('vehiclePlate')
      expect(s).toHaveProperty('driver')
      expect(s).toHaveProperty('status')
      expect(s).toHaveProperty('lastUpdate')
      expect(['idle', 'on_route', 'loading']).toContain(s.status)
    })
  })
})

describe('MockVehicleAdapter.syncCustomer', () => {
  it('同步客戶至車機系統（mock 記錄到 system_logs）', async () => {
    await adapter.syncCustomer({
      id: testCustomerId,
      name: '測試客戶_vehicle_adapter',
      siteName: '測試站_vehicle_adapter',
    })

    const log = await prisma.systemLog.findFirst({
      where: {
        eventType: 'mock_sync_customer_to_vehicle',
        eventContent: { contains: '測試客戶_vehicle_adapter' },
      },
    })
    expect(log).not.toBeNull()
  })
})

describe('MockVehicleAdapter.dispatchTrip', () => {
  it('模擬派車（記錄到 system_logs）', async () => {
    await adapter.dispatchTrip({
      siteName: '測試站_vehicle_adapter',
      customerName: '測試客戶_vehicle_adapter',
      tripDate: new Date('2099-07-20'),
      driver: '測試司機',
      vehiclePlate: 'TEST-1234',
    })

    const log = await prisma.systemLog.findFirst({
      where: {
        eventType: 'mock_dispatch_trip',
        eventContent: { contains: '測試司機' },
      },
    })
    expect(log).not.toBeNull()
  })
})

describe('MockVehicleAdapter.healthCheck', () => {
  it('健康檢查回傳 ok', async () => {
    const result = await adapter.healthCheck()
    expect(result.status).toBe('ok')
    expect(result.mode).toBe('mock')
  })
})

// backend/src/__tests__/sync.test.ts
// 同步服務測試（直接呼叫 service 層）
import prisma from '../lib/prisma'
import { syncPosRecords, syncVehicleRecords } from '../services/sync.service'

let testSiteId: number
let testCustomerId: number
let testItemId: number
let testContractId: number

beforeAll(async () => {
  // 清理上次殘留的測試資料（按 FK 依賴順序）
  await prisma.mockPosCollection.deleteMany({ where: { externalId: { startsWith: 'POS-SYNC-TEST' } } }).catch(() => {})
  await prisma.mockVehicleTrip.deleteMany({ where: { externalId: { startsWith: 'VT-SYNC-TEST' } } }).catch(() => {})
  await prisma.systemLog.deleteMany({ where: { eventType: { startsWith: 'sync_' } } }).catch(() => {})
  await prisma.statement.deleteMany({ where: { customer: { name: '同步測試客戶_sync' } } }).catch(() => {})
  await prisma.tripItem.deleteMany({ where: { trip: { customer: { name: '同步測試客戶_sync' } } } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { customer: { name: '同步測試客戶_sync' } } }).catch(() => {})
  await prisma.contractItem.deleteMany({ where: { contract: { contractNumber: 'SYNC-TEST-001' } } }).catch(() => {})
  await prisma.contract.deleteMany({ where: { contractNumber: 'SYNC-TEST-001' } }).catch(() => {})
  await prisma.customerFee.deleteMany({ where: { customer: { name: '同步測試客戶_sync' } } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { name: '同步測試客戶_sync' } }).catch(() => {})
  await prisma.site.deleteMany({ where: { name: '同步測試站_sync' } }).catch(() => {})
  await prisma.item.deleteMany({ where: { name: '同步測試品項_sync' } }).catch(() => {})

  // 建立測試站區
  const site = await prisma.site.create({
    data: { name: '同步測試站_sync', status: 'active' },
  })
  testSiteId = site.id

  // 建立測試品項
  const item = await prisma.item.create({
    data: { name: '同步測試品項_sync', unit: 'kg', category: '測試' },
  })
  testItemId = item.id

  // 建立測試客戶
  const customer = await prisma.customer.create({
    data: {
      siteId: testSiteId,
      name: '同步測試客戶_sync',
      type: 'contracted',
      notificationMethod: 'email',
    },
  })
  testCustomerId = customer.id

  // 建立測試合約 + 合約品項
  const contract = await prisma.contract.create({
    data: {
      customerId: testCustomerId,
      contractNumber: 'SYNC-TEST-001',
      startDate: new Date('2099-01-01'),
      endDate: new Date('2099-12-31'),
      status: 'active',
    },
  })
  testContractId = contract.id

  await prisma.contractItem.create({
    data: {
      contractId: contract.id,
      itemId: testItemId,
      unitPrice: 5.0,
      billingDirection: 'payable',
    },
  })
}, 15000)

afterAll(async () => {
  // 清理測試資料（依序刪除以避免外鍵衝突）
  await prisma.tripItem.deleteMany({
    where: { trip: { customerId: testCustomerId } },
  }).catch(() => {})
  await prisma.trip.deleteMany({
    where: { customerId: testCustomerId },
  }).catch(() => {})
  await prisma.mockPosCollection.deleteMany({
    where: { externalId: { startsWith: 'POS-SYNC-TEST' } },
  }).catch(() => {})
  await prisma.mockVehicleTrip.deleteMany({
    where: { externalId: { startsWith: 'VT-SYNC-TEST' } },
  }).catch(() => {})
  await prisma.systemLog.deleteMany({
    where: { eventType: { startsWith: 'sync_' } },
  }).catch(() => {})
  await prisma.contractItem.deleteMany({ where: { contractId: testContractId } }).catch(() => {})
  await prisma.contract.delete({ where: { id: testContractId } }).catch(() => {})
  await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {})
  await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {})
  await prisma.item.delete({ where: { id: testItemId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('syncPosRecords - POS 同步', () => {
  beforeEach(async () => {
    // 清除之前的同步鎖定日誌
    await prisma.systemLog.deleteMany({
      where: { eventType: { in: ['sync_start', 'sync_end'] } },
    })
  })

  it('成功從 mock POS 拉取並建立 trip + trip_items', async () => {
    // 先建立 mock POS 紀錄
    await prisma.mockPosCollection.create({
      data: {
        externalId: 'POS-SYNC-TEST-001-0',
        siteName: '同步測試站_sync',
        customerName: '同步測試客戶_sync',
        collectionDate: new Date('2099-08-15'),
        itemName: '同步測試品項_sync',
        quantity: 200,
        unit: 'kg',
        unitPrice: 3.0,
      },
    })

    const result = await syncPosRecords(
      new Date('2099-08-01'),
      new Date('2099-08-31'),
    )

    expect(result.created).toBeGreaterThanOrEqual(1)

    // 確認 trip 已建立
    const trips = await prisma.trip.findMany({
      where: {
        customerId: testCustomerId,
        source: 'pos_sync',
        tripDate: new Date('2099-08-15'),
      },
      include: { items: true },
    })
    expect(trips.length).toBeGreaterThanOrEqual(1)

    // 確認使用合約價而非 POS 端價
    const tripItem = trips[0].items.find((ti) => ti.itemId === testItemId)
    if (tripItem) {
      expect(Number(tripItem.unitPrice)).toBe(5.0) // 合約價
      expect(tripItem.billingDirection).toBe('payable') // 合約方向
    }
  })

  it('重複的 externalId 不會重複匯入', async () => {
    // 清除同步鎖定
    await prisma.systemLog.deleteMany({
      where: { eventType: { in: ['sync_start', 'sync_end'] } },
    })

    // 建立已存在 externalId 的 mock 紀錄
    await prisma.mockPosCollection.create({
      data: {
        externalId: 'POS-SYNC-TEST-DUP-0',
        siteName: '同步測試站_sync',
        customerName: '同步測試客戶_sync',
        collectionDate: new Date('2099-09-15'),
        itemName: '同步測試品項_sync',
        quantity: 50,
        unit: 'kg',
        unitPrice: 2.0,
        imported: false,
      },
    })

    // 先同步一次
    await syncPosRecords(new Date('2099-09-01'), new Date('2099-09-30'))

    // 清除同步鎖定
    await prisma.systemLog.deleteMany({
      where: { eventType: { in: ['sync_start', 'sync_end'] } },
    })

    // 解除 imported 狀態以模擬重複拉取
    await prisma.mockPosCollection.updateMany({
      where: { externalId: 'POS-SYNC-TEST-DUP-0' },
      data: { imported: false },
    })

    // 再同步一次
    const result = await syncPosRecords(new Date('2099-09-01'), new Date('2099-09-30'))

    // 應該跳過（去重）
    expect(result.skipped).toBeGreaterThanOrEqual(1)
  })
})

describe('syncVehicleRecords - 車機同步', () => {
  beforeEach(async () => {
    // 清除之前的同步鎖定日誌
    await prisma.systemLog.deleteMany({
      where: { eventType: { in: ['sync_start', 'sync_end'] } },
    })
  })

  it('建立新的車趟紀錄（source=vehicle_sync）', async () => {
    // 建立 mock 車機紀錄
    await prisma.mockVehicleTrip.create({
      data: {
        externalId: 'VT-SYNC-TEST-001',
        siteName: '同步測試站_sync',
        customerName: '同步測試客戶_sync',
        tripDate: new Date('2099-10-15'),
        tripTime: '10:00',
        driver: '同步測試司機',
        vehiclePlate: 'SYNC-1234',
        status: 'completed',
      },
    })

    const result = await syncVehicleRecords(
      new Date('2099-10-01'),
      new Date('2099-10-31'),
    )

    // 應建立或匹配
    expect(result.created + result.matched).toBeGreaterThanOrEqual(1)

    // 確認 trip 存在
    const trip = await prisma.trip.findFirst({
      where: {
        customerId: testCustomerId,
        tripDate: new Date('2099-10-15'),
      },
    })
    expect(trip).not.toBeNull()
    expect(trip!.driver).toBe('同步測試司機')
    expect(trip!.vehiclePlate).toBe('SYNC-1234')
  })

  it('匹配到既有 trip 時補充 driver/vehiclePlate', async () => {
    // 清除同步鎖定
    await prisma.systemLog.deleteMany({
      where: { eventType: { in: ['sync_start', 'sync_end'] } },
    })

    // 先手動建立一個 trip（模擬 POS 同步建立的）
    const existingTrip = await prisma.trip.create({
      data: {
        customerId: testCustomerId,
        siteId: testSiteId,
        tripDate: new Date('2099-11-20'),
        tripTime: '14:00',
        source: 'pos_sync',
      },
    })

    // 建立 mock 車機紀錄（同客戶、同日、時間接近）
    await prisma.mockVehicleTrip.create({
      data: {
        externalId: 'VT-SYNC-TEST-MATCH',
        siteName: '同步測試站_sync',
        customerName: '同步測試客戶_sync',
        tripDate: new Date('2099-11-20'),
        tripTime: '14:15', // 與既有 trip 差 15 分鐘，應匹配
        driver: '匹配司機',
        vehiclePlate: 'MATCH-5678',
        status: 'completed',
      },
    })

    const result = await syncVehicleRecords(
      new Date('2099-11-01'),
      new Date('2099-11-30'),
    )

    expect(result.matched).toBeGreaterThanOrEqual(1)

    // 確認既有 trip 已被更新
    const updated = await prisma.trip.findUnique({ where: { id: existingTrip.id } })
    expect(updated!.driver).toBe('匹配司機')
    expect(updated!.vehiclePlate).toBe('MATCH-5678')
  })
})

describe('同步鎖定機制', () => {
  it('同步結束後會釋放鎖定', async () => {
    // 清除同步鎖定
    await prisma.systemLog.deleteMany({
      where: { eventType: { in: ['sync_start', 'sync_end'] } },
    })

    // 執行一次同步（即使無資料）
    await syncPosRecords(new Date('2088-01-01'), new Date('2088-01-31'))

    // 檢查是否有 sync_end 紀錄
    const endLog = await prisma.systemLog.findFirst({
      where: {
        eventType: 'sync_end',
        eventContent: { contains: 'pos_pull' },
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(endLog).not.toBeNull()
  })
})

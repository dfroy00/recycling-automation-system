// backend/src/services/sync.service.ts
// 同步服務：POS/車機同步邏輯
import prisma from '../lib/prisma'
import { getPosAdapter, getVehicleAdapter } from '../adapters'
import { PosCollectionRecord, VehicleTripRecord } from '../adapters/types'

// 同步鎖定：檢查是否有進行中的同步
async function acquireSyncLock(syncType: string): Promise<boolean> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  // 檢查是否有進行中的同步（5 分鐘內）
  const activeLock = await prisma.systemLog.findFirst({
    where: {
      eventType: 'sync_start',
      eventContent: { contains: syncType },
      createdAt: { gt: fiveMinutesAgo },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (activeLock) {
    // 檢查是否有對應的 sync_end
    const endLog = await prisma.systemLog.findFirst({
      where: {
        eventType: 'sync_end',
        eventContent: { contains: syncType },
        createdAt: { gt: activeLock.createdAt },
      },
    })
    if (!endLog) return false // 仍在鎖定中
  }

  // 取得鎖定
  await prisma.systemLog.create({
    data: {
      eventType: 'sync_start',
      eventContent: `${syncType} 同步開始`,
    },
  })
  return true
}

async function releaseSyncLock(syncType: string, message: string) {
  await prisma.systemLog.create({
    data: {
      eventType: 'sync_end',
      eventContent: `${syncType} 同步結束：${message}`,
    },
  })
}

// POS 同步：拉取收運紀錄並建立 trips + trip_items
export async function syncPosRecords(dateFrom: Date, dateTo: Date) {
  if (!(await acquireSyncLock('pos_pull'))) {
    throw new Error('同步進行中，請稍後再試')
  }

  try {
    const posAdapter = getPosAdapter()
    const records = await posAdapter.getCollectionRecords({ dateFrom, dateTo })

    let created = 0
    let skipped = 0
    let errors: string[] = []

    // 依 externalId 分組（同一 external_id 前綴 = 同一趟）
    // POS 紀錄按客戶+日期+站區分組為趟次
    const tripGroups = new Map<string, PosCollectionRecord[]>()
    for (const record of records) {
      // 用 externalId 的趟次部分作為分組 key
      // POS-YYYY-MM-DD-customerId-tripIndex
      const parts = record.externalId.split('-')
      const tripKey = parts.slice(0, parts.length - 1).join('-')
      if (!tripGroups.has(tripKey)) tripGroups.set(tripKey, [])
      tripGroups.get(tripKey)!.push(record)
    }

    for (const [tripKey, items] of tripGroups) {
      const first = items[0]

      // 比對站區
      const site = await prisma.site.findUnique({ where: { name: first.siteName } })
      if (!site) {
        errors.push(`站區 [${first.siteName}] 不存在`)
        await prisma.systemLog.create({
          data: { eventType: 'sync_error', eventContent: `POS 同步：站區 [${first.siteName}] 不存在` },
        })
        skipped += items.length
        continue
      }

      // 比對客戶
      const customer = await prisma.customer.findFirst({
        where: { name: first.customerName, siteId: site.id },
        include: {
          contracts: {
            where: { status: 'active' },
            include: { items: { include: { item: true } } },
          },
        },
      })
      if (!customer) {
        errors.push(`客戶 [${first.customerName}] 不存在`)
        await prisma.systemLog.create({
          data: { eventType: 'sync_error', eventContent: `POS 同步：客戶 [${first.customerName}] (${first.siteName}) 不存在` },
        })
        skipped += items.length
        continue
      }

      // 去重：檢查是否已存在同 externalId 的 trip
      const existingTrip = await prisma.trip.findFirst({
        where: { externalId: first.externalId.replace(/-\d+$/, '') },
      })
      if (existingTrip) {
        // 已存在，記錄疑似重複
        await prisma.systemLog.create({
          data: {
            eventType: 'sync_duplicate',
            eventContent: `POS 同步：疑似重複 trip (externalId: ${first.externalId})`,
          },
        })
        skipped += items.length
        continue
      }

      // 建立車趟
      const trip = await prisma.trip.create({
        data: {
          customerId: customer.id,
          siteId: site.id,
          tripDate: first.collectionDate,
          source: 'pos_sync',
          externalId: tripKey,
        },
      })

      // 建立車趟品項
      for (const record of items) {
        const item = await prisma.item.findUnique({ where: { name: record.itemName } })
        if (!item) {
          errors.push(`品項 [${record.itemName}] 不存在`)
          skipped++
          continue
        }

        // 定價策略：簽約客戶用合約價，臨時客戶用 POS 端價
        let unitPrice = record.unitPrice
        let billingDirection = 'receivable' // 臨時客戶預設應收
        let unit = item.unit

        if (customer.type === 'contracted') {
          const contractItem = customer.contracts
            .flatMap((c) => c.items)
            .find((ci) => ci.itemId === item.id)
          if (contractItem) {
            unitPrice = Number(contractItem.unitPrice)
            billingDirection = contractItem.billingDirection
          }
        }

        const amount = unitPrice * record.quantity

        await prisma.tripItem.create({
          data: {
            tripId: trip.id,
            itemId: item.id,
            quantity: record.quantity,
            unit,
            unitPrice,
            billingDirection,
            amount,
          },
        })
        created++
      }

      // 標記 mock 紀錄為已匯入
      for (const record of items) {
        await prisma.mockPosCollection.updateMany({
          where: { externalId: record.externalId },
          data: { imported: true },
        })
      }
    }

    const message = `匯入 ${created} 筆品項，跳過 ${skipped} 筆`
    await releaseSyncLock('pos_pull', message)
    return { created, skipped, errors }
  } catch (e: any) {
    await releaseSyncLock('pos_pull', `錯誤: ${e.message}`)
    throw e
  }
}

// 車機同步：拉取車趟紀錄，去重後補充 driver/vehiclePlate 或建立新 trip
export async function syncVehicleRecords(dateFrom: Date, dateTo: Date) {
  if (!(await acquireSyncLock('vehicle_pull'))) {
    throw new Error('同步進行中，請稍後再試')
  }

  try {
    const vehicleAdapter = getVehicleAdapter()
    const records = await vehicleAdapter.getTripRecords({ dateFrom, dateTo })

    let matched = 0
    let created = 0
    let skipped = 0
    let errors: string[] = []

    for (const record of records) {
      // 比對站區
      const site = await prisma.site.findUnique({ where: { name: record.siteName } })
      if (!site) {
        errors.push(`站區 [${record.siteName}] 不存在`)
        skipped++
        continue
      }

      // 比對客戶
      const customer = await prisma.customer.findFirst({
        where: { name: record.customerName, siteId: site.id },
      })
      if (!customer) {
        errors.push(`客戶 [${record.customerName}] 不存在`)
        skipped++
        continue
      }

      // 去重：1. external_id 精確比對
      let existingTrip = await prisma.trip.findFirst({
        where: { externalId: record.externalId },
      })

      // 2. 模糊比對：同客戶 + 同日 + 同站區 + 時間±30分鐘
      if (!existingTrip && record.tripTime) {
        const [hours, minutes] = record.tripTime.split(':').map(Number)
        const allTrips = await prisma.trip.findMany({
          where: {
            customerId: customer.id,
            siteId: site.id,
            tripDate: record.tripDate,
          },
        })

        for (const trip of allTrips) {
          if (trip.tripTime) {
            const [th, tm] = trip.tripTime.split(':').map(Number)
            const diffMinutes = Math.abs((hours * 60 + minutes) - (th * 60 + tm))
            if (diffMinutes <= 30) {
              existingTrip = trip
              break
            }
          }
        }
      }

      if (existingTrip) {
        // 匹配到已存在的 trip → 補充 driver + vehicle_plate
        await prisma.trip.update({
          where: { id: existingTrip.id },
          data: {
            driver: record.driver,
            vehiclePlate: record.vehiclePlate,
            ...(record.tripTime && { tripTime: record.tripTime }),
          },
        })
        matched++
      } else {
        // 未匹配到 → 建立新 trip（source=vehicle_sync，無品項）
        await prisma.trip.create({
          data: {
            customerId: customer.id,
            siteId: site.id,
            tripDate: record.tripDate,
            tripTime: record.tripTime,
            driver: record.driver,
            vehiclePlate: record.vehiclePlate,
            source: 'vehicle_sync',
            externalId: record.externalId,
          },
        })
        created++
      }

      // 標記 mock 紀錄為已匯入
      await prisma.mockVehicleTrip.updateMany({
        where: { externalId: record.externalId },
        data: { imported: true },
      })
    }

    const message = `匹配 ${matched} 筆，新建 ${created} 筆，跳過 ${skipped} 筆`
    await releaseSyncLock('vehicle_pull', message)
    return { matched, created, skipped, errors }
  } catch (e: any) {
    await releaseSyncLock('vehicle_pull', `錯誤: ${e.message}`)
    throw e
  }
}

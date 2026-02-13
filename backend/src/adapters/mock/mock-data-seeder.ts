// backend/src/adapters/mock/mock-data-seeder.ts
// 產生模擬的 POS 收運紀錄和車機車趟紀錄
import 'dotenv/config'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

export async function generateMockData() {
  // 取得現有的站區、客戶、合約品項
  const customers = await prisma.customer.findMany({
    where: { status: 'active' },
    include: {
      site: true,
      contracts: {
        where: { status: 'active' },
        include: { items: { include: { item: true } } },
      },
    },
  })

  if (customers.length === 0) {
    console.log('沒有活躍的客戶，跳過假資料產生')
    return { posRecords: 0, vehicleTrips: 0 }
  }

  // 清除舊的 mock 資料
  await prisma.mockPosCollection.deleteMany({})
  await prisma.mockVehicleTrip.deleteMany({})

  let posCount = 0
  let vehicleCount = 0

  // 產生 3 個月的假資料
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1) // 2 個月前的 1 號

  const drivers = ['王大明', '李小華', '陳志偉', '林美玲']
  const plates = ['ABC-1234', 'DEF-5678', 'GHI-9012', 'JKL-3456']

  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    // 跳過週末
    if (d.getDay() === 0 || d.getDay() === 6) continue

    for (const customer of customers) {
      // 每個客戶每天 1-2 趟
      const tripCount = Math.floor(Math.random() * 2) + 1

      for (let t = 0; t < tripCount; t++) {
        const tripTime = `${8 + t * 2}:${Math.random() > 0.5 ? '00' : '30'}`
        const driverIdx = Math.floor(Math.random() * drivers.length)
        const externalVehicleId = `VT-${d.toISOString().split('T')[0]}-${customer.id}-${t}`

        // 車機紀錄
        await prisma.mockVehicleTrip.create({
          data: {
            externalId: externalVehicleId,
            siteName: customer.site.name,
            customerName: customer.name,
            tripDate: new Date(d),
            tripTime,
            driver: drivers[driverIdx],
            vehiclePlate: plates[driverIdx],
            status: 'completed',
          },
        })
        vehicleCount++

        // POS 收運紀錄（每趟 2-4 個品項）
        const contractItems = customer.contracts.flatMap((c) => c.items)
        const itemCount = Math.min(contractItems.length, Math.floor(Math.random() * 3) + 2)
        const selectedItems = contractItems
          .sort(() => Math.random() - 0.5)
          .slice(0, itemCount)

        for (let i = 0; i < selectedItems.length; i++) {
          const ci = selectedItems[i]
          const quantity = Math.floor(Math.random() * 500 + 50) // 50-550 kg
          const externalPosId = `POS-${d.toISOString().split('T')[0]}-${customer.id}-${t}-${i}`

          await prisma.mockPosCollection.create({
            data: {
              externalId: externalPosId,
              siteName: customer.site.name,
              customerName: customer.name,
              collectionDate: new Date(d),
              itemName: ci.item.name,
              quantity,
              unit: ci.item.unit,
              unitPrice: Number(ci.unitPrice),
            },
          })
          posCount++
        }
      }
    }
  }

  console.log(`Mock 假資料產生完成：${posCount} 筆 POS 紀錄，${vehicleCount} 筆車機紀錄`)
  return { posRecords: posCount, vehicleTrips: vehicleCount }
}

// 直接執行模式
if (require.main === module) {
  generateMockData()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(async () => { await prisma.$disconnect() })
}

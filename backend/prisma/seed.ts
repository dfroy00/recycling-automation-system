import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcrypt'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/recycle_db'
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('開始填入測試資料...')

  // 1. 建立站點
  const sites = [
    { siteId: 'S001', siteName: '台北站', manager: '張三', contactPhone: '02-1234-5678', contactEmail: 'taipei@example.com' },
    { siteId: 'S002', siteName: '新北站', manager: '李四', contactPhone: '02-2345-6789', contactEmail: 'newtaipei@example.com' },
    { siteId: 'S003', siteName: '桃園站', manager: '王五', contactPhone: '03-3456-7890', contactEmail: 'taoyuan@example.com' },
    { siteId: 'S004', siteName: '台中站', manager: '趙六', contactPhone: '04-4567-8901', contactEmail: 'taichung@example.com' },
    { siteId: 'S005', siteName: '台南站', manager: '孫七', contactPhone: '06-5678-9012', contactEmail: 'tainan@example.com' },
    { siteId: 'S006', siteName: '高雄站', manager: '周八', contactPhone: '07-6789-0123', contactEmail: 'kaohsiung@example.com' },
    { siteId: 'S007', siteName: '新竹站', manager: '吳九', contactPhone: '03-7890-1234', contactEmail: 'hsinchu@example.com' },
  ]

  for (const site of sites) {
    await prisma.site.upsert({
      where: { siteId: site.siteId },
      update: site,
      create: site,
    })
  }
  console.log(`已建立 ${sites.length} 個站點`)

  // 2. 建立品項標準單價
  const itemPrices = [
    { itemName: '紙類', standardPrice: 5.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '塑膠', standardPrice: 3.5, effectiveDate: new Date('2026-01-01') },
    { itemName: '金屬', standardPrice: 8.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '鋁罐', standardPrice: 35.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '鐵罐', standardPrice: 12.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '玻璃', standardPrice: 1.5, effectiveDate: new Date('2026-01-01') },
    { itemName: '寶特瓶', standardPrice: 15.0, effectiveDate: new Date('2026-01-01') },
    { itemName: '廢紙箱', standardPrice: 4.0, effectiveDate: new Date('2026-01-01') },
  ]

  // 先清除舊資料再插入
  await prisma.itemPrice.deleteMany()
  for (const item of itemPrices) {
    await prisma.itemPrice.create({
      data: {
        itemName: item.itemName,
        standardPrice: item.standardPrice,
        effectiveDate: item.effectiveDate,
      },
    })
  }
  console.log(`已建立 ${itemPrices.length} 個品項牌價`)

  // 3. 建立範例客戶（每種類型各一個）
  const customers = [
    { customerId: 'C001', siteId: 'S001', customerName: 'ABC 科技股份有限公司', billingType: 'A', tripPrice: 300, notificationMethod: 'Email', email: 'abc@example.com' },
    { customerId: 'C002', siteId: 'S001', customerName: 'XYZ 物流有限公司', billingType: 'B', tripPrice: 500, notificationMethod: 'LINE', lineId: 'U1234567890' },
    { customerId: 'C003', siteId: 'S002', customerName: '大成製造股份有限公司', billingType: 'C', tripPrice: null, notificationMethod: 'Both', lineId: 'U9876543210', email: 'dacheng@example.com' },
    { customerId: 'C004', siteId: 'S002', customerName: '小明商行', billingType: 'D', tripPrice: null, notificationMethod: 'Email', email: 'xiaoming@example.com' },
  ]

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { customerId: customer.customerId },
      update: customer,
      create: customer,
    })
  }
  console.log(`已建立 ${customers.length} 個客戶`)

  // 4. 建立 C 類客戶合約品項
  await prisma.contractPrice.deleteMany()
  const contracts = [
    { customerId: 'C003', itemName: '紙類', contractPrice: 4.5, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
    { customerId: 'C003', itemName: '塑膠', contractPrice: 3.0, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
  ]

  for (const contract of contracts) {
    await prisma.contractPrice.create({ data: contract })
  }
  console.log(`已建立 ${contracts.length} 筆合約品項`)

  // 5. 建立系統管理員帳號
  const adminPassword = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: '系統管理員',
      role: 'system_admin',
      email: 'admin@example.com',
    },
  })
  console.log('已建立系統管理員帳號 (admin / admin123)')

  console.log('測試資料填入完成！')
}

main()
  .catch((e) => {
    console.error('Seed 失敗:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

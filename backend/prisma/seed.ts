// backend/prisma/seed.ts
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. 使用者（三層角色）
  const adminHash = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'super_admin', siteId: null },
    create: {
      username: 'admin',
      passwordHash: adminHash,
      name: '系統管理員',
      email: 'admin@example.com',
      role: 'super_admin',
      siteId: null,
    },
  })

  // 2. 站區（7 個）
  const sites = [
    { name: '新竹站', address: '新竹縣竹北市東興路一段123號', phone: '03 668 4776' },
    { name: '草屯站', address: '南投縣草屯鎮草溪路845之1號', phone: '(049)2381-622' },
    { name: '金馬站', address: '彰化市金馬路三段臨488號', phone: '(04)751-6789' },
    { name: '員林站', address: '彰化縣員林市中山路一段190號', phone: '(04)8383-213' },
    { name: '斗六站', address: '雲林縣斗六市保長路41號', phone: '(05)537-0799' },
    { name: '和美站', address: '彰化縣和美鎮彰和路三段592號', phone: '(04)7562-506' },
    { name: '神岡站', address: '台中市神岡區神林路91-6號', phone: '(04)2567-5299' },
  ]
  for (const site of sites) {
    await prisma.site.upsert({
      where: { name: site.name },
      update: { address: site.address, phone: site.phone },
      create: { ...site, status: 'active' },
    })
  }

  // 2b. 新增站區主管和站區人員帳號
  const site1 = await prisma.site.findUnique({ where: { name: '新竹站' } })
  const managerHash = await bcrypt.hash('manager123', 10)
  await prisma.user.upsert({
    where: { username: 'manager1' },
    update: { role: 'site_manager', siteId: site1?.id },
    create: {
      username: 'manager1',
      passwordHash: managerHash,
      name: '站區一主管',
      email: 'manager1@example.com',
      role: 'site_manager',
      siteId: site1?.id ?? 1,
    },
  })

  const staffHash = await bcrypt.hash('staff123', 10)
  await prisma.user.upsert({
    where: { username: 'staff1' },
    update: { role: 'site_staff', siteId: site1?.id },
    create: {
      username: 'staff1',
      passwordHash: staffHash,
      name: '站區一人員',
      email: 'staff1@example.com',
      role: 'site_staff',
      siteId: site1?.id ?? 1,
    },
  })

  // 3. 行號（4 個）
  const businessEntities = [
    { name: '和東', taxId: '12345601', bizItems: '廢棄物回收、資源再利用' },
    { name: '河北', taxId: '12345602', bizItems: '廢鐵回收、五金買賣' },
    { name: '和南', taxId: '12345603', bizItems: '廢塑膠回收、再生料加工' },
    { name: '和西', taxId: '12345604', bizItems: '廢紙回收、紙類加工' },
  ]
  for (const entity of businessEntities) {
    await prisma.businessEntity.upsert({
      where: { name: entity.name },
      update: { taxId: entity.taxId, bizItems: entity.bizItems },
      create: { ...entity, status: 'active' },
    })
  }

  // 4. 品項（5 大分類，共 46 項）
  const items = [
    // 紙類
    { name: '總紙', unit: 'kg', category: '紙類' },
    { name: '報紙', unit: 'kg', category: '紙類' },
    { name: '雜誌', unit: 'kg', category: '紙類' },
    { name: '廣告紙', unit: 'kg', category: '紙類' },
    { name: '紙袋', unit: 'kg', category: '紙類' },
    // 鐵類
    { name: '沖床鐵THS', unit: 'kg', category: '鐵類' },
    { name: '特工鐵THF', unit: 'kg', category: '鐵類' },
    { name: '鍛造鐵', unit: 'kg', category: '鐵類' },
    { name: '西工鐵', unit: 'kg', category: '鐵類' },
    { name: '總鐵', unit: 'kg', category: '鐵類' },
    { name: '古物鐵', unit: 'kg', category: '鐵類' },
    { name: '大鐵桶', unit: 'kg', category: '鐵類' },
    { name: '鐵罐', unit: 'kg', category: '鐵類' },
    { name: '鐵粉', unit: 'kg', category: '鐵類' },
    { name: '中厚版', unit: 'kg', category: '鐵類' },
    { name: '中古料', unit: 'kg', category: '鐵類' },
    { name: '封閉式容器', unit: 'kg', category: '鐵類' },
    // 五金類
    { name: '青銅', unit: 'kg', category: '五金類' },
    { name: '馬達', unit: 'kg', category: '五金類' },
    { name: '熱水器', unit: 'kg', category: '五金類' },
    { name: '紅銅燒', unit: 'kg', category: '五金類' },
    { name: '紅銅割', unit: 'kg', category: '五金類' },
    { name: '白鐵', unit: 'kg', category: '五金類' },
    { name: '軟鋁(家庭仔)', unit: 'kg', category: '五金類' },
    { name: '軟鋁(厚料)', unit: 'kg', category: '五金類' },
    { name: '硬鋁', unit: 'kg', category: '五金類' },
    { name: '電線', unit: 'kg', category: '五金類' },
    { name: '鋁罐', unit: 'kg', category: '五金類' },
    { name: '銅排', unit: 'kg', category: '五金類' },
    { name: '鉛', unit: 'kg', category: '五金類' },
    { name: '鋅', unit: 'kg', category: '五金類' },
    // 塑膠類
    { name: 'PET', unit: 'kg', category: '塑膠類' },
    { name: 'HDPE', unit: 'kg', category: '塑膠類' },
    { name: 'PVC', unit: 'kg', category: '塑膠類' },
    { name: 'LDPE', unit: 'kg', category: '塑膠類' },
    { name: 'PP', unit: 'kg', category: '塑膠類' },
    { name: 'PS', unit: 'kg', category: '塑膠類' },
    { name: '其他塑膠', unit: 'kg', category: '塑膠類' },
    // 雜項
    { name: '壓克力', unit: 'kg', category: '雜項' },
    { name: '日光燈管', unit: 'kg', category: '雜項' },
    { name: '電瓶', unit: 'kg', category: '雜項' },
    { name: '乾電池', unit: 'kg', category: '雜項' },
    { name: 'CD片', unit: 'kg', category: '雜項' },
    { name: 'PP打包帶', unit: 'kg', category: '雜項' },
    { name: '大青桶', unit: 'kg', category: '雜項' },
    { name: '蘆筍籃', unit: 'kg', category: '雜項' },
  ]
  for (const item of items) {
    await prisma.item.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    })
  }

  // 4. 假日（2026 年台灣國定假日）
  const holidays2026 = [
    { date: '2026-01-01', name: '元旦' },
    { date: '2026-01-29', name: '除夕' },
    { date: '2026-01-30', name: '春節' },
    { date: '2026-01-31', name: '春節' },
    { date: '2026-02-01', name: '春節' },
    { date: '2026-02-02', name: '春節' },
    { date: '2026-02-28', name: '和平紀念日' },
    { date: '2026-04-04', name: '兒童節' },
    { date: '2026-04-05', name: '清明節' },
    { date: '2026-05-01', name: '勞動節' },
    { date: '2026-06-19', name: '端午節' },
    { date: '2026-09-25', name: '中秋節' },
    { date: '2026-10-10', name: '國慶日' },
  ]
  for (const h of holidays2026) {
    await prisma.holiday.upsert({
      where: { date: new Date(h.date) },
      update: {},
      create: { date: new Date(h.date), name: h.name, year: 2026 },
    })
  }

  // 5. 測試客戶（簽約 + 臨時）
  const hsinchu = await prisma.site.findUnique({ where: { name: '新竹站' } })
  const caotun = await prisma.site.findUnique({ where: { name: '草屯站' } })

  const customer1 = await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      siteId: hsinchu!.id,
      name: '大明企業',
      contactPerson: '陳大明',
      phone: '03-1234567',
      address: '新竹市東區光復路100號',
      type: 'contracted',
      tripFeeEnabled: true,
      tripFeeType: 'per_trip',
      tripFeeAmount: 500,
      statementType: 'monthly',
      paymentType: 'lump_sum',
      invoiceRequired: true,
      invoiceType: 'net',
      notificationMethod: 'email',
      notificationEmail: 'daming@example.com',
    },
  })

  const customer2 = await prisma.customer.upsert({
    where: { id: 2 },
    update: {},
    create: {
      siteId: hsinchu!.id,
      name: '小華工廠',
      contactPerson: '林小華',
      phone: '03-7654321',
      address: '新竹市香山區中華路200號',
      type: 'contracted',
      tripFeeEnabled: true,
      tripFeeType: 'per_month',
      tripFeeAmount: 3000,
      statementType: 'monthly',
      paymentType: 'lump_sum',
      invoiceRequired: false,
      notificationMethod: 'email',
      notificationEmail: 'xiaohua@example.com',
    },
  })

  await prisma.customer.upsert({
    where: { id: 3 },
    update: {},
    create: {
      siteId: caotun!.id,
      name: '王先生',
      phone: '0912-345678',
      type: 'temporary',
      tripFeeEnabled: false,
      statementType: 'per_trip',
      paymentType: 'lump_sum',
      invoiceRequired: false,
      notificationMethod: 'email',
    },
  })

  // 6. 測試合約 + 合約品項
  const zongzhi = await prisma.item.findUnique({ where: { name: '總紙' } })
  const zongtie = await prisma.item.findUnique({ where: { name: '總鐵' } })
  const pet = await prisma.item.findUnique({ where: { name: 'PET' } })
  const hongtongsao = await prisma.item.findUnique({ where: { name: '紅銅燒' } })

  // 清除舊的合約品項（避免重複 seed 時累積）
  await prisma.contractItem.deleteMany({})

  const contract1 = await prisma.contract.upsert({
    where: { contractNumber: 'C-2026-001' },
    update: {},
    create: {
      customerId: customer1.id,
      contractNumber: 'C-2026-001',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
    },
  })

  // 大明企業合約品項：總紙(應付)、總鐵(應付)、PET(應收)
  const contractItems1 = [
    { contractId: contract1.id, itemId: zongzhi!.id, unitPrice: 3.5, billingDirection: 'payable' },
    { contractId: contract1.id, itemId: zongtie!.id, unitPrice: 8.0, billingDirection: 'payable' },
    { contractId: contract1.id, itemId: pet!.id, unitPrice: 2.0, billingDirection: 'receivable' },
  ]
  for (const ci of contractItems1) {
    await prisma.contractItem.create({ data: ci })
  }

  const contract2 = await prisma.contract.upsert({
    where: { contractNumber: 'C-2026-002' },
    update: {},
    create: {
      customerId: customer2.id,
      contractNumber: 'C-2026-002',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
    },
  })

  // 小華工廠合約品項：總鐵(應付)、紅銅燒(應付)
  const contractItems2 = [
    { contractId: contract2.id, itemId: zongtie!.id, unitPrice: 7.5, billingDirection: 'payable' },
    { contractId: contract2.id, itemId: hongtongsao!.id, unitPrice: 150.0, billingDirection: 'payable' },
  ]
  for (const ci of contractItems2) {
    await prisma.contractItem.create({ data: ci })
  }

  // 7. 測試附加費用
  // 先清除舊資料避免重複
  await prisma.customerFee.deleteMany({})
  await prisma.customerFee.create({
    data: {
      customerId: customer1.id,
      name: '處理費',
      amount: 1000,
      billingDirection: 'receivable',
      frequency: 'monthly',
    },
  })

  console.log('種子資料建立完成')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

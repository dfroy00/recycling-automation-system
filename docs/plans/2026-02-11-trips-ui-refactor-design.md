# 車趟介面重構 + Bug 修復 + 行號功能

> 設計日期：2026-02-11

---

## 一、車趟管理介面重構

### 現況問題
車趟列表是平鋪的，站區只是篩選條件之一，不符合「站區 > 車趟」的業務邏輯。

### 改為
頂部用 **Tabs 頁籤切換站區**，每個 Tab 下顯示該站區的車趟列表。

### 整體架構
- 只顯示 `status = 'active'` 的站區
- 預設選中第一個站區
- 每個 Tab 標題顯示站區名稱
- 原本的「篩選站區」下拉移除，改由 Tab 控制

### 新增車趟 Modal
- 站區自動帶入當前 Tab，不顯示站區選擇欄
- 客戶下拉只顯示當前站區的客戶

### Tab 內車趟列表
- 篩選條件：客戶下拉（只含該站客戶）+ 日期範圍選擇器
- 表格欄位：收運日期、客戶、司機、車牌、來源標籤、操作按鈕
- 站區欄位從表格中移除（已由 Tab 代表）
- 展開列：點擊展開顯示品項明細（保持現有邏輯）
- 分頁：每頁 20 筆，各 Tab 獨立分頁
- 手機版：維持卡片式呈現，Tab 改為可橫向滑動

### 元件拆分
- `TripsPage` — 負責載入站區列表、渲染 Tabs
- `SiteTripsTab` — 每個 Tab 內容，接收 `siteId`，負責該站的車趟列表、篩選、新增/編輯
- `TripItemsExpand` — 保持不變，展開列顯示品項明細

### API 呼叫調整
- 切換 Tab 時，以 `siteId` 篩選車趟（已有 `useTrips({ siteId })` 支援）
- 客戶下拉改用 `useCustomers({ siteId })` 篩選該站客戶
- 各 Tab 的分頁狀態獨立，切換 Tab 不影響其他 Tab 的頁碼

---

## 二、Bug 修復

### Bug 1：`all=true` 下拉空白（5 處）

**根因**：後端 `all=true` 時回傳純陣列 `T[]`，但前端 hook 型別宣告為 `PaginatedResponse<T>`，導致 `.data` 為 `undefined`。

**受影響的後端路由**：
- `routes/sites.ts` — 第 12-15 行
- `routes/items.ts` — 第 17-20 行
- `routes/customers.ts` — 第 18-26 行
- `routes/trips.ts` — 第 29-35 行
- `routes/contracts.ts` — 第 25-31 行

**受影響的前端頁面**：
- `CustomersPage.tsx` — 站區下拉空的
- `TripsPage.tsx` — 站區下拉 + 品項下拉空的
- `ContractsPage.tsx` — 品項下拉空的
- `ReportsPage.tsx` — 站區下拉空的

**修正方式**：在前端 hooks 中處理兩種回傳格式（純陣列或分頁物件），統一轉為一致的結構。

### Bug 2：Dashboard 欄位名稱不匹配（6 處）

**後端回傳 vs 前端期望**：
| 後端回傳 | 前端期望 |
|---------|---------|
| `tripCount` | `monthlyTrips` |
| `activeCustomerCount` | `customerCount` |
| `pendingReviewCount` | `pendingReviews` |
| `contractAlerts` | `expiringContracts` |
| `contractAlerts[].daysLeft` | `expiringContracts[].daysRemaining` |
| 未實作 | `pendingItems` |

**修正方式**：統一後端回傳欄位名稱，使其與前端 `DashboardStats` 型別一致。新增 `pendingItems` 組裝邏輯。

### Bug 3：Users / Holidays 回傳格式不匹配

- 後端 `GET /users` 回傳純陣列，前端 hook 型別宣告 `PaginatedResponse<User>`
- 後端 `GET /holidays` 回傳純陣列，前端 hook 型別宣告 `PaginatedResponse<Holiday>`

**修正方式**：前端 hook 型別改為 `User[]` / `Holiday[]`，頁面端對應調整。

---

## 三、新增行號（BusinessEntity）功能

### 業務背景
公司底下有多個行號，每個行號有不同的營業項目。開立發票時需要對應到正確的行號。在建立客戶時應指定用哪個行號開票。

### 資料庫變更

**新增 `BusinessEntity` 表**：
```
- id              Int       @id @default(autoincrement())
- name            String    @unique    -- 行號名稱
- taxId           String    @unique    -- 統一編號
- bizItems        String?              -- 營業項目說明
- status          String    @default("active")
- createdAt       DateTime  @default(now())
- updatedAt       DateTime  @updatedAt
```

**Customer 表新增欄位**：
```
- businessEntityId  Int?  -- 關聯到行號（開票時使用的行號）
```

**Statement 表新增欄位**：
```
- businessEntityId  Int?  -- 快照：產出明細當下記錄用哪個行號開票
```

### 前端變更
- 新增「行號管理」頁面（CRUD）
- 客戶新增/編輯 Modal 的「發票與通知」區塊新增「開票行號」下拉選單
- 側邊選單新增「行號管理」入口

### 後端變更
- 新增 `routes/business-entities.ts`（CRUD API）
- 修改 `routes/customers.ts` — 支援 `businessEntityId` 欄位
- 修改 `routes/statements.ts` — 產出明細時快照行號資訊

---

## 四、月結明細頁面 — 車趟預覽功能

### 現況問題
目前在月結管理頁面，選擇客戶和月份後，必須點擊「產出月結明細」才能看到資料。使用者無法事先確認該月有哪些車趟和品項，容易產出錯誤的明細。

### 改為
選擇客戶 + 月份後，**自動預覽**該客戶該月的所有車趟紀錄及品項明細，讓使用者確認無誤後再產出明細。

### UI 設計

**預覽區塊**（在篩選列下方、明細列表上方）：
- 當「月份」和「客戶」都選定時，自動查詢並顯示預覽
- 任一未選，顯示提示文字「請選擇月份和客戶以預覽車趟」

**預覽內容**：
- 摘要列：共 N 趟、品項總筆數、日期範圍
- 車趟表格（可展開）：
  - 欄位：收運日期、司機、車牌、來源、品項數
  - 展開列：品項名稱、數量、單位、單價、方向、金額
- 預覽區底部顯示「產出月結明細」按鈕（從頂部移下來，語意更清楚）

### API 呼叫
- 使用現有 `useTrips({ customerId, dateFrom, dateTo })` hook
- `dateFrom` = 月份第一天，`dateTo` = 月份最後一天
- 已有的 trips 回傳包含 `items`，無需額外 API

### 元件變更
- `StatementsPage.tsx` — 新增預覽區塊，條件渲染
- 無需新增後端 API（現有 trips 查詢已足夠）

### 注意事項
- 預覽資料量可能較大（某客戶該月可能有數十趟），需設合理的 `pageSize` 或使用 `all=true`
- 預覽僅為唯讀展示，不可在此編輯車趟或品項
- 如果該客戶該月已有明細（非 voided），應在預覽區提示「該月已有明細紀錄」

---

## 五、PDF 中文亂碼修復

### 現況問題
PDFKit 預設使用 Helvetica 字型，不支援 CJK 字元，導致產出的月結明細 PDF 全部顯示為亂碼。

### 根因
`pdf-generator.ts` 中 `new PDFDocument()` 未指定中文字型，所有 `doc.text()` 寫入的中文都無法正確渲染。

### 修正方式
下載 Google 免費字型 **Noto Sans TC**（Regular + Bold），放在 `backend/assets/fonts/` 目錄，PDF 產出時註冊並使用該字型。

### 變更內容

**新增檔案**：
- `backend/assets/fonts/NotoSansTC-Regular.ttf`
- `backend/assets/fonts/NotoSansTC-Bold.ttf`

**修改 `pdf-generator.ts`**：
```typescript
// 註冊中文字型
const fontPath = path.join(__dirname, '../../assets/fonts/NotoSansTC-Regular.ttf')
const fontBoldPath = path.join(__dirname, '../../assets/fonts/NotoSansTC-Bold.ttf')
doc.registerFont('NotoSansTC', fontPath)
doc.registerFont('NotoSansTC-Bold', fontBoldPath)
doc.font('NotoSansTC')
```

- 標題使用 `NotoSansTC-Bold`，內文使用 `NotoSansTC`
- 數字和英文同樣使用此字型（Noto Sans TC 含 Latin 字元）

### 注意事項
- 字型檔約 8MB，應加入 `.gitignore` 或 Git LFS（視團隊偏好）
- 部署時需確保 `assets/fonts/` 目錄隨專案一起部署
- 若未來需支援簡體中文，可額外加入 Noto Sans SC

---

## 六、Mock Seeder 修正 — 臨時客戶缺少 POS 紀錄

### 現況問題
`mock-data-seeder.ts` 產生 POS 收運紀錄時，品項來源是 `customer.contracts.items`。臨時客戶沒有合約，`contractItems` 為空陣列，導致不會產生任何 POS 紀錄。但實際業務中臨時客戶也會有 POS 收運紀錄。

### 影響
- 臨時客戶只有車機紀錄、沒有 POS 紀錄，無法測試臨時客戶的完整同步流程
- 車機同步會建立空車趟（無品項），不符合實際業務場景

### 修正方式

**修改 `mock-data-seeder.ts`**：

```typescript
// 品項來源：簽約客戶用合約品項，臨時客戶從系統品項表隨機挑
let availableItems: { itemName: string; unit: string; unitPrice: number }[]

if (contractItems.length > 0) {
  // 簽約客戶：用合約品項+合約價
  availableItems = contractItems.map(ci => ({
    itemName: ci.item.name,
    unit: ci.item.unit,
    unitPrice: Number(ci.unitPrice),
  }))
} else {
  // 臨時客戶：從系統品項隨機挑，單價隨機產生
  const allItems = await prisma.item.findMany({ where: { status: 'active' } })
  availableItems = allItems.map(item => ({
    itemName: item.name,
    unit: item.unit,
    unitPrice: Math.floor(Math.random() * 10 + 1), // 隨機 1-10 元
  }))
}
```

### 注意事項
- 需在迴圈外預先查詢一次 `allItems`，避免每個客戶每天重複查詢
- 臨時客戶的單價為隨機值，同步後會直接使用 POS 端價格（因為無合約可覆蓋）

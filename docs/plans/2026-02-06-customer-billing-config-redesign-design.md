# 客戶計費設定重新設計

> 日期：2026-02-06
> 狀態：設計完成
> 分支：待建立

## 問題描述

現有的客戶分類系統使用 A/B/C/D 四種固定類型來決定計費邏輯，但實際業務場景中，計費規則由多個**獨立維度**組成，各種排列組合都可能出現。A/B/C/D 僅能表達 4 種組合，無法涵蓋所有實際情境（如：有合約價 + 收車趟費 + 收附加費用）。

### 計費維度分析

| 維度 | 選項 | 說明 |
|------|------|------|
| 品項計費 | 收 / 不收 / 付 | 收=應收（客戶付你），付=應付（你付客戶） |
| 車趟費 | 收 / 不收 / 付 | 同上 |
| 附加費用 | 收 / 不收 / 付 | 同上 |

共 3 × 3 × 3 = **27 種組合**，遠超現有 4 種分類。

### 各費用類型特性

| 費用類型 | 計算方式 | 金額來源 | 方向 |
|---------|---------|---------|------|
| 品項計費 | 單價 × 重量，按趟計算 | 合約價（優先）> 客戶牌價 | 由品項單價正負決定（可混合） |
| 車趟費 | 固定金額，算趟或算月 | 每客戶設定 | 客戶層級設定 |
| 附加費用 | 固定金額，算趟或算月 | 每客戶 × 每品項設定 | 客戶層級設定 |

### 關鍵業務規則

1. **品項計費方向是每品項不同的** — 同一客戶可同時有「你付他的品項」（廢鐵）和「他付你的品項」（保麗龍），由單價正負決定
2. **品項計費的 收/付 是帳單呈現** — 決定帳單標示為「應收」或「應付」，實際金額由品項單價加總決定
3. **車趟費/附加費用的 收/付 是實際金錢方向** — 收=客戶付你，付=你付客戶
4. **客戶牌價是每客戶專屬的** — 沒有系統預設牌價，每個客戶的每個品項都需手動設定
5. **合約價有期限** — 合約期間內覆蓋客戶牌價，到期自動失效回到客戶牌價
6. **合約只涵蓋部分品項** — 合約內品項用合約價，合約外品項用客戶牌價
7. **附加費用品項的金額每客戶可不同** — 王老闆冷盤 500 元，李老闆冷盤 800 元
8. **一個客戶固定屬於一個站點**

---

## 需求清單

1. 移除 A/B/C/D 客戶類型分類
2. 每位客戶可獨立設定品項計費/車趟費/附加費用的 收/不收/付
3. 車趟費支援算趟和算月兩種計算方式
4. 附加費用支援算趟和算月，每客戶每品項金額可不同
5. 每位客戶有專屬牌價表（客戶 × 品項 → 單價）
6. 品項單價支援正負值（正=客戶付，負=你付）
7. 品項查價邏輯：合約價 > 客戶牌價
8. 帳單正確標示應收/應付
9. 使用 JSON 欄位儲存計費設定，保留未來擴充彈性
10. 舊 A/B/C/D 資料可遷移至新格式

---

## 資料結構變更

### 修改 `customers` 表

```prisma
model Customer {
  // 既有欄位保留（name, site_id, contact 等）

  // ❌ 移除
  // billing_type  String  // A/B/C/D

  // ✅ 新增
  billing_config  Json    // 計費設定（JSON）

  // 關聯
  customer_prices      CustomerPrice[]
  customer_surcharges  CustomerSurcharge[]
}
```

### 新增 `customer_prices` 表（客戶牌價）

```prisma
model CustomerPrice {
  id           Int      @id @default(autoincrement())
  customer_id  Int
  item_id      Int
  unit_price   Decimal  @db.Decimal(10, 2)  // 正=客戶付，負=你付

  customer     Customer @relation(fields: [customer_id], references: [id])

  @@unique([customer_id, item_id])
  @@index([customer_id])
}
```

### 新增 `customer_surcharges` 表（客戶附加費用）

```prisma
model CustomerSurcharge {
  id           Int      @id @default(autoincrement())
  customer_id  Int
  item_name    String   // 附加品項名稱（冷盤、保麗龍等）
  amount       Decimal  @db.Decimal(10, 2)
  calc_type    String   // "per_trip" | "per_month"

  customer     Customer @relation(fields: [customer_id], references: [id])

  @@index([customer_id])
}
```

### `billing_config` JSON 結構

```typescript
interface BillingConfig {
  // 品項計費
  item: {
    mode: "charge" | "none" | "pay"
  }

  // 車趟費
  trip: {
    mode: "charge" | "none" | "pay"
    amount?: number                    // 金額
    calc?: "per_trip" | "per_month"    // 算趟或算月
  }

  // 附加費用
  surcharge: {
    mode: "charge" | "none" | "pay"
  }
}
```

### 範例資料

```jsonc
// 王老闆：品項應收 + 每趟車趟費 1500 + 有附加費用
{
  "item":      { "mode": "charge" },
  "trip":      { "mode": "charge", "amount": 1500, "calc": "per_trip" },
  "surcharge": { "mode": "charge" }
}

// 李老闆：不計品項 + 每月固定車趟費 5000 + 無附加
{
  "item":      { "mode": "none" },
  "trip":      { "mode": "charge", "amount": 5000, "calc": "per_month" },
  "surcharge": { "mode": "none" }
}

// 張老闆：品項應付 + 不收車趟 + 附加費用由你付他
{
  "item":      { "mode": "pay" },
  "trip":      { "mode": "none" },
  "surcharge": { "mode": "pay" }
}

// 陳老闆：全部不收（免費客戶）
{
  "item":      { "mode": "none" },
  "trip":      { "mode": "none" },
  "surcharge": { "mode": "none" }
}
```

### 舊分類遷移對照

| 舊類型 | 新 billing_config |
|--------|------------------|
| A類 | `item: charge` + `trip: charge, per_trip` + `surcharge: none` |
| B類 | `item: none` + `trip: charge, per_trip` + `surcharge: none` |
| C類 | `item: charge` + `trip: none` + `surcharge: none`（有合約） |
| D類 | `item: charge` + `trip: none` + `surcharge: none`（沒合約） |

> C 和 D 在新模型中設定相同，差別只在有沒有合約資料。

---

## 資料流程

```
客戶設定                    價格資料                    計費引擎
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│ billing_config│       │ CustomerPrice    │       │              │
│  - item.mode │       │  客戶 × 品項     │──────→│ 品項費計算   │
│  - trip.mode │       │  → 單價/kg       │       │              │
│  - surcharge │       ├──────────────────┤       │ 車趟費計算   │
│    .mode     │──────→│ ContractPrice    │──────→│              │
└──────────────┘       │  合約 × 品項     │       │ 附加費用計算 │
                       │  → 單價/kg（覆蓋）│       │              │
                       ├──────────────────┤       │      ↓       │
                       │ CustomerSurcharge│──────→│ 組合帳單     │
                       │  客戶 × 附加品項 │       │ (應收/應付)  │
                       │  → 金額 + 算法   │       └──────────────┘
                       └──────────────────┘
```

### 品項查價邏輯

```
某客戶某品項的單價？
│
├─ 有生效合約 且 品項在合約內？
│   └─ 是 → 合約價
│
└─ 否 → 客戶牌價
    └─ 沒有設定 → 拋出錯誤（必須手動設定）
```

---

## 計費引擎邏輯

```typescript
function calculateMonthlyBill(customerId: string, yearMonth: string) {
  const customer = getCustomer(customerId)
  const config: BillingConfig = customer.billing_config
  const trips = getMonthlyTrips(customerId, yearMonth)

  let itemTotal = 0
  let tripTotal = 0
  let surchargeTotal = 0

  // ========== 1. 品項計費 ==========
  if (config.item.mode !== "none") {
    for (const trip of trips) {
      for (const item of trip.items) {
        const price = lookupPrice(customerId, item.id)
        // 合約價 > 客戶牌價
        itemTotal += price * item.weight
      }
    }
  }

  // ========== 2. 車趟費 ==========
  if (config.trip.mode !== "none") {
    if (config.trip.calc === "per_trip") {
      tripTotal = config.trip.amount * trips.length
    } else { // per_month
      tripTotal = config.trip.amount
    }
  }

  // ========== 3. 附加費用 ==========
  if (config.surcharge.mode !== "none") {
    const surcharges = getCustomerSurcharges(customerId)

    for (const sc of surcharges) {
      if (sc.calc_type === "per_month") {
        // 算月：該品項當月有出現就收一次
        if (hasItemInMonth(trips, sc.item_name)) {
          surchargeTotal += sc.amount
        }
      } else { // per_trip
        // 算趟：每趟出現就收一次
        const count = countTripsWithItem(trips, sc.item_name)
        surchargeTotal += sc.amount * count
      }
    }
  }

  // ========== 4. 組合帳單 ==========
  return {
    item:      { mode: config.item.mode, total: itemTotal },
    trip:      { mode: config.trip.mode, total: tripTotal },
    surcharge: { mode: config.surcharge.mode, total: surchargeTotal },
  }
}

function lookupPrice(customerId: string, itemId: string): number {
  // 1. 查合約價（有生效合約且品項在合約內）
  const contractPrice = findActiveContractPrice(customerId, itemId)
  if (contractPrice !== null) return contractPrice

  // 2. 查客戶牌價
  const customerPrice = findCustomerPrice(customerId, itemId)
  if (customerPrice !== null) return customerPrice

  // 3. 都沒有 → 錯誤
  throw new Error(`客戶 ${customerId} 缺少品項 ${itemId} 的牌價設定`)
}
```

---

## UI 變更

### 客戶編輯表單

```
┌─ 客戶資料編輯 ──────────────────────────────────────────┐
│                                                          │
│  基本資料                                                │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │ 客戶名稱       │  │ 所屬站點  [▼]  │                  │
│  └────────────────┘  └────────────────┘                  │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │ 聯絡人         │  │ 電話           │                  │
│  └────────────────┘  └────────────────┘                  │
│                                                          │
│  ─── 計費設定 ──────────────────────────────────────     │
│                                                          │
│  品項計費    (○) 收（應收）  (○) 不收  (○) 付（應付）    │
│                                                          │
│  車趟費      (○) 收（應收）  (○) 不收  (○) 付（應付）    │
│  ┌──────────────────────────────────────┐                │
│  │ 金額 [=====1500=====]  (○)算趟 (○)算月│ ← 車趟費≠不收 │
│  └──────────────────────────────────────┘                │
│                                                          │
│  附加費用    (○) 收（應收）  (○) 不收  (○) 付（應付）    │
│                                                          │
│                              [ 取消 ]  [ 儲存 ]          │
└──────────────────────────────────────────────────────────┘
```

### 客戶詳情頁 — 分頁設計

```
┌─ 王老闆 ────────────────────────────────────────────────┐
│                                                          │
│  [基本資料]  [客戶牌價]  [附加費用]  [合約]              │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  === 「客戶牌價」分頁 ===                                │
│                                                          │
│  [ + 新增品項價格 ]                    [搜尋===]          │
│  ┌──────────┬──────────┬──────────┬────────┐            │
│  │ 品項名稱  │ 單價/kg  │ 方向     │ 操作    │            │
│  ├──────────┼──────────┼──────────┼────────┤            │
│  │ 廢鐵     │ 12.00    │ 應付     │ [編輯] │            │
│  │ 廢紙     │  8.50    │ 應付     │ [編輯] │            │
│  │ 保麗龍   │  3.00    │ 應收     │ [編輯] │            │
│  └──────────┴──────────┴──────────┴────────┘            │
│                                                          │
│  === 「附加費用」分頁 ===（surcharge ≠ 不收時顯示）      │
│                                                          │
│  [ + 新增附加費用 ]                                      │
│  ┌──────────┬──────────┬──────────┬────────┐            │
│  │ 品項名稱  │ 金額     │ 計算方式  │ 操作    │            │
│  ├──────────┼──────────┼──────────┼────────┤            │
│  │ 冷盤     │ 500      │ 每趟     │ [編輯] │            │
│  │ 保麗龍   │ 300      │ 每月     │ [編輯] │            │
│  └──────────┴──────────┴──────────┴────────┘            │
│                                                          │
│  === 「合約」分頁 ===                                    │
│                                                          │
│  ┌──────────┬────────────┬──────────┬────────┐          │
│  │ 合約編號  │ 期間        │ 狀態     │ 操作    │          │
│  ├──────────┼────────────┼──────────┼────────┤          │
│  │ C-2026-01│ 2026/1~12  │ 生效     │ [檢視] │          │
│  └──────────┴────────────┴──────────┴────────┘          │
└──────────────────────────────────────────────────────────┘
```

### 客戶列表頁 — 篩選與顯示

```
┌─ 客戶管理 ──────────────────────────────────────────────┐
│                                                          │
│  篩選：站點[▼全部]  品項[▼全部]  車趟[▼全部]  附加[▼全部]│
│                                                          │
│  ┌──────┬──────┬──────┬──────────┬──────┬──────┬──────┐│
│  │ 名稱  │ 站點 │ 品項  │ 車趟      │ 附加  │ 合約  │ 操作 ││
│  ├──────┼──────┼──────┼──────────┼──────┼──────┼──────┤│
│  │ 王老闆│ A站  │ 應收  │ $1500/趟 │ 有   │ 有   │[編輯]││
│  │ 李老闆│ B站  │ 不收  │ $5000/月 │ 無   │ —    │[編輯]││
│  │ 張老闆│ A站  │ 應付  │ 不收     │ 應付  │ 有   │[編輯]││
│  └──────┴──────┴──────┴──────────┴──────┴──────┴──────┘│
└──────────────────────────────────────────────────────────┘
```

### Ant Design 元件對應

| UI 元素 | 元件 |
|--------|------|
| 收/不收/付 | `Radio.Group` |
| 金額輸入 | `InputNumber` |
| 算趟/算月 | `Radio.Group` |
| 分頁 | `Tabs` |
| 價格表格 | `Table` + 行內編輯 |
| 篩選下拉 | `Select` |

---

## 修改檔案清單

| 檔案 | 修改內容 | 複雜度 |
|------|---------|--------|
| **資料庫層** | | |
| `backend/prisma/schema.prisma` | 新增 `billing_config` JSON 欄位、`CustomerPrice`、`CustomerSurcharge` 模型，移除 `billing_type` | 中 |
| `backend/prisma/seed.ts` | 更新種子資料用新格式 | 低 |
| **後端 API** | | |
| `backend/src/routes/customers.ts` | 客戶 CRUD 支援新 billing_config | 中 |
| `backend/src/routes/customer-prices.ts` | 客戶牌價 CRUD API（新增） | 中 |
| `backend/src/routes/customer-surcharges.ts` | 客戶附加費用 CRUD API（新增） | 中 |
| `backend/src/routes/contracts.ts` | 移除 billing_type 相關邏輯 | 低 |
| `backend/src/routes/reports.ts` | 帳單呈現改用 mode 判斷應收/應付 | 中 |
| `backend/src/routes/dashboard.ts` | 統計邏輯改用新欄位 | 低 |
| **後端服務** | | |
| `backend/src/services/billing.service.ts` | **核心重寫**：A/B/C/D switch → 三段式計算 | 高 |
| `backend/src/services/monthly-statement.service.ts` | 配合新計費結構調整明細格式 | 中 |
| `backend/src/services/pdf-generator.ts` | PDF 帳單加入附加費用區塊、應收/應付標示 | 中 |
| **新增後端檔案** | | |
| `backend/src/types/billing.ts` | BillingConfig TypeScript 介面（新增） | 低 |
| **前端** | | |
| `frontend/src/pages/CustomersPage.tsx` | 列表頁加入新篩選欄位、顯示計費設定 | 中 |
| `frontend/src/pages/CustomerDetailPage.tsx` | 客戶詳情頁 — 分頁設計（新增） | 高 |
| `frontend/src/components/BillingConfigForm.tsx` | 計費設定表單元件（新增） | 中 |
| `frontend/src/components/CustomerPriceTable.tsx` | 客戶牌價表格元件（新增） | 中 |
| `frontend/src/components/CustomerSurchargeTable.tsx` | 附加費用表格元件（新增） | 中 |
| `frontend/src/services/api.ts` | 新增牌價/附加費用 API 呼叫 | 低 |
| `frontend/src/App.tsx` | 新增客戶詳情頁路由 | 低 |

---

## 遷移方案

### SQL 遷移腳本

```sql
-- 1. 新增 billing_config 欄位
ALTER TABLE customers ADD COLUMN billing_config JSONB;

-- 2. 依舊 billing_type 填入新設定
UPDATE customers SET billing_config =
  CASE billing_type
    WHEN 'A' THEN '{"item":{"mode":"charge"},"trip":{"mode":"charge","amount":0,"calc":"per_trip"},"surcharge":{"mode":"none"}}'
    WHEN 'B' THEN '{"item":{"mode":"none"},"trip":{"mode":"charge","amount":0,"calc":"per_trip"},"surcharge":{"mode":"none"}}'
    WHEN 'C' THEN '{"item":{"mode":"charge"},"trip":{"mode":"none"},"surcharge":{"mode":"none"}}'
    WHEN 'D' THEN '{"item":{"mode":"charge"},"trip":{"mode":"none"},"surcharge":{"mode":"none"}}'
  END;

-- 3. 設為必填
ALTER TABLE customers ALTER COLUMN billing_config SET NOT NULL;

-- 4. 確認資料正確後，移除舊欄位
-- ALTER TABLE customers DROP COLUMN billing_type;
```

### 需手動補齊的資料

| 資料 | 說明 | 來源 |
|------|------|------|
| 車趟費金額 | 每位客戶的實際金額 | 向營運確認 |
| 客戶牌價表 | 每位客戶 × 每品項的單價 | 現有報價單 / Excel |
| 附加費用設定 | 哪些客戶收、品項、金額、算法 | 向營運確認 |

---

## 實作順序

```
第 1 步：資料庫 + 型別定義
  schema.prisma + billing.ts + migration
       ↓
第 2 步：後端 API
  customer-prices + customer-surcharges + customers 修改
       ↓
第 3 步：計費引擎重寫
  billing.service.ts + monthly-statement + pdf
       ↓
第 4 步：前端頁面
  CustomerDetailPage + BillingConfigForm + 表格元件
       ↓
第 5 步：遷移 + 驗證
  資料遷移腳本 + 舊資料轉換 + 驗算比對
```

---

## 驗收標準

- [ ] 客戶可設定品項計費/車趟費/附加費用各自的 收/不收/付
- [ ] 車趟費支援算趟和算月兩種模式
- [ ] 附加費用支援算趟和算月，且每客戶每品項金額可不同
- [ ] 品項查價優先用合約價，無合約時用客戶牌價
- [ ] 品項單價支援正負值（正=客戶付，負=你付）
- [ ] 帳單正確標示應收/應付
- [ ] 前端客戶詳情頁有四個分頁：基本資料、客戶牌價、附加費用、合約
- [ ] 客戶列表可依計費設定篩選
- [ ] 舊 A/B/C/D 資料成功遷移至新格式
- [ ] 遷移後帳單計算結果與舊系統一致（驗算）

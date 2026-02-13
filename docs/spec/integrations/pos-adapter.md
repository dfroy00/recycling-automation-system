# POS 同步邏輯

> **版本**：3.0
> **日期**：2026-02-13

---

## 6.4 POS 同步邏輯

1. 從 POS Adapter 拉取未匯入的收運紀錄
2. 按 `externalId` 分組為趟次
3. **名稱比對**：站區名稱 → Site、客戶名稱 → Customer（精確比對，失敗記 SystemLog）
4. **去重**：檢查 `externalId` 是否已存在於 Trip
5. 建立 Trip + TripItems
6. **定價策略**：
   - 簽約客戶 → 使用本系統合約價（忽略 POS 端 unitPrice）
   - 臨時客戶 → 使用 POS 端 unitPrice
7. 標記 MockPosCollection.imported = true

---

相關文件：
- [Adapter 模式設計與介面](./README.md)
- [車機同步邏輯](./vehicle-adapter.md)

# 車機同步邏輯

> **版本**：3.0
> **日期**：2026-02-13
> **來源**：從 system-spec.md §6.5 抽取

---

## 6.5 車機同步邏輯

1. 從車機 Adapter 拉取車趟紀錄
2. **去重策略**：
   - 精確比對：`externalId`
   - 模糊比對：同客戶 + 同日 + 同站區 + 時間差 ≤ 30 分鐘
3. 匹配到已存在 Trip → 補充 `driver` + `vehiclePlate`
4. 未匹配到 → 建立新 Trip（`source=vehicle_sync`，無品項）

---

相關文件：
- [Adapter 模式設計與介面](./README.md)
- [POS 同步邏輯](./pos-adapter.md)

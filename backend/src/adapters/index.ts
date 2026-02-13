// backend/src/adapters/index.ts
// Adapter 工廠函數：依環境變數切換 mock/real 模式
import { IPosAdapter } from './pos.adapter'
import { IVehicleAdapter } from './vehicle.adapter'
import { MockPosAdapter } from './mock/mock-pos.adapter'
import { MockVehicleAdapter } from './mock/mock-vehicle.adapter'

let posAdapter: IPosAdapter
let vehicleAdapter: IVehicleAdapter

export function getPosAdapter(): IPosAdapter {
  if (!posAdapter) {
    const mode = process.env.POS_ADAPTER_MODE || 'mock'
    if (mode === 'real') {
      // 未來實作 RealPosAdapter
      throw new Error('Real POS Adapter 尚未實作')
    }
    posAdapter = new MockPosAdapter()
  }
  return posAdapter
}

export function getVehicleAdapter(): IVehicleAdapter {
  if (!vehicleAdapter) {
    const mode = process.env.VEHICLE_ADAPTER_MODE || 'mock'
    if (mode === 'real') {
      // 未來實作 RealVehicleAdapter
      throw new Error('Real Vehicle Adapter 尚未實作')
    }
    vehicleAdapter = new MockVehicleAdapter()
  }
  return vehicleAdapter
}

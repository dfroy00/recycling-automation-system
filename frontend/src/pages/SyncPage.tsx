import { useState } from 'react'
import {
  Card, Button, Typography, Space, Tag, Descriptions, Alert, DatePicker,
} from 'antd'
import {
  SyncOutlined, CloudServerOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import {
  useSyncStatus, useSyncPosPull, useSyncVehiclePull, useMockGenerate,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function SyncPage() {
  const { isMobile } = useResponsive()

  // 預設日期範圍：最近 3 個月
  const [posRange, setPosRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(3, 'month').startOf('month'),
    dayjs(),
  ])
  const [vehicleRange, setVehicleRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(3, 'month').startOf('month'),
    dayjs(),
  ])

  const { data: syncStatus, isLoading: statusLoading } = useSyncStatus()
  const posPull = useSyncPosPull()
  const vehiclePull = useSyncVehiclePull()
  const mockGenerate = useMockGenerate()

  // 判斷是否為 mock 模式
  const isMockMode = syncStatus?.pos?.mode === 'mock' || syncStatus?.vehicle?.mode === 'mock'

  // 執行 POS 同步
  const handlePosPull = () => {
    posPull.mutate({
      dateFrom: posRange[0].format('YYYY-MM-DD'),
      dateTo: posRange[1].format('YYYY-MM-DD'),
    })
  }

  // 執行車機同步
  const handleVehiclePull = () => {
    vehiclePull.mutate({
      dateFrom: vehicleRange[0].format('YYYY-MM-DD'),
      dateTo: vehicleRange[1].format('YYYY-MM-DD'),
    })
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>外部系統同步</Title>

      {/* Adapter 狀態 */}
      <Card title="Adapter 連線狀態" style={{ marginBottom: 16 }} loading={statusLoading}>
        {syncStatus ? (
          <Descriptions column={isMobile ? 1 : 3} size="small">
            <Descriptions.Item label="POS Adapter">
              <Space>
                <Tag color={syncStatus.pos?.status === 'ok' ? 'green' : 'red'}>
                  {syncStatus.pos?.status === 'ok' ? '已連線' : '未連線'}
                </Tag>
                <Tag color={syncStatus.pos?.mode === 'mock' ? 'orange' : 'blue'}>
                  {syncStatus.pos?.mode === 'mock' ? 'Mock 模式' : '正式模式'}
                </Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="車機 Adapter">
              <Space>
                <Tag color={syncStatus.vehicle?.status === 'ok' ? 'green' : 'red'}>
                  {syncStatus.vehicle?.status === 'ok' ? '已連線' : '未連線'}
                </Tag>
                <Tag color={syncStatus.vehicle?.mode === 'mock' ? 'orange' : 'blue'}>
                  {syncStatus.vehicle?.mode === 'mock' ? 'Mock 模式' : '正式模式'}
                </Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      {/* Mock 資料產生（僅 mock 模式顯示） */}
      {isMockMode && (
        <Card
          title={<><DatabaseOutlined /> Mock 假資料產生</>}
          style={{ marginBottom: 16 }}
        >
          <p style={{ color: '#666', marginBottom: 16 }}>
            產生模擬的 POS 收運紀錄和車機車趟紀錄（近 3 個月），用於測試同步功能。產生後再點下方同步按鈕拉取。
          </p>
          <Button
            icon={<DatabaseOutlined />}
            onClick={() => mockGenerate.mutate()}
            loading={mockGenerate.isPending}
          >
            產生 Mock 資料
          </Button>
          {mockGenerate.isSuccess && mockGenerate.data && (
            <Alert
              style={{ marginTop: 12 }}
              type="success"
              message="Mock 資料產生完成"
              description={`POS 收運 ${mockGenerate.data.posRecords ?? 0} 筆，車機車趟 ${mockGenerate.data.vehicleTrips ?? 0} 筆`}
              showIcon
            />
          )}
        </Card>
      )}

      {/* 同步操作區 */}
      <Space direction={isMobile ? 'vertical' : 'horizontal'} size="middle" style={{ width: '100%' }}>
        {/* POS 同步 */}
        <Card
          title={<><CloudServerOutlined /> POS 收運同步</>}
          style={{ flex: 1, minWidth: isMobile ? '100%' : 360 }}
        >
          <p style={{ color: '#666', marginBottom: 16 }}>
            從 POS 系統拉取收運紀錄，自動比對客戶與品項名稱後建立車趟。
          </p>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>同步日期範圍：</div>
            <RangePicker
              value={posRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setPosRange([dates[0], dates[1]])
                }
              }}
              style={{ width: '100%' }}
            />
          </div>
          <Button
            type="primary"
            icon={<SyncOutlined spin={posPull.isPending} />}
            onClick={handlePosPull}
            loading={posPull.isPending}
            block
          >
            執行 POS 同步
          </Button>
          {posPull.isSuccess && posPull.data && (
            <Alert
              style={{ marginTop: 12 }}
              type="success"
              message="POS 同步完成"
              description={`新增 ${posPull.data.created ?? 0} 筆，略過 ${posPull.data.skipped ?? 0} 筆`}
              showIcon
            />
          )}
          {posPull.isError && (
            <Alert
              style={{ marginTop: 12 }}
              type="error"
              message="POS 同步失敗"
              description="請確認已產生 Mock 資料，並檢查後端日誌"
              showIcon
            />
          )}
        </Card>

        {/* 車機同步 */}
        <Card
          title={<><CloudServerOutlined /> 車機車趟同步</>}
          style={{ flex: 1, minWidth: isMobile ? '100%' : 360 }}
        >
          <p style={{ color: '#666', marginBottom: 16 }}>
            從車機系統拉取車趟紀錄，自動比對站區與客戶名稱後建立車趟。
          </p>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>同步日期範圍：</div>
            <RangePicker
              value={vehicleRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setVehicleRange([dates[0], dates[1]])
                }
              }}
              style={{ width: '100%' }}
            />
          </div>
          <Button
            type="primary"
            icon={<SyncOutlined spin={vehiclePull.isPending} />}
            onClick={handleVehiclePull}
            loading={vehiclePull.isPending}
            block
          >
            執行車機同步
          </Button>
          {vehiclePull.isSuccess && vehiclePull.data && (
            <Alert
              style={{ marginTop: 12 }}
              type="success"
              message="車機同步完成"
              description={`新增 ${vehiclePull.data.created ?? 0} 筆，略過 ${vehiclePull.data.skipped ?? 0} 筆`}
              showIcon
            />
          )}
          {vehiclePull.isError && (
            <Alert
              style={{ marginTop: 12 }}
              type="error"
              message="車機同步失敗"
              description="請確認已產生 Mock 資料，並檢查後端日誌"
              showIcon
            />
          )}
        </Card>
      </Space>
    </div>
  )
}

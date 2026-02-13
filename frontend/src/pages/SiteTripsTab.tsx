import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, InputNumber, Select, Space, DatePicker,
  Popconfirm, Typography, List, Tag,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ExpandOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip,
  useCustomers,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import TripItemsExpand from './TripItemsExpand'
import type { Trip, TripFormData } from '../types'

const { Text } = Typography

// 資料來源標籤
const sourceLabelMap: Record<string, string> = {
  manual: '手動',
  pos_sync: 'POS 同步',
  vehicle_sync: '車機同步',
}
const sourceColorMap: Record<string, string> = {
  manual: 'blue',
  pos_sync: 'green',
  vehicle_sync: 'purple',
}

interface SiteTripsTabProps {
  siteId: number
  siteName: string
}

/**
 * 站區車趟頁籤內容元件
 * 顯示指定站區的車趟列表，含篩選、新增、編輯、刪除功能
 */
export default function SiteTripsTab({ siteId, siteName }: SiteTripsTabProps) {
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [filterCustomerId, setFilterCustomerId] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null)
  const [form] = Form.useForm()

  // 查詢該站區的車趟
  const { data, isLoading } = useTrips({
    page,
    pageSize: 20,
    siteId,
    customerId: filterCustomerId,
    dateFrom: dateRange?.[0],
    dateTo: dateRange?.[1],
  })

  // 僅載入該站區的客戶作為篩選選項
  const { data: customersData } = useCustomers({ siteId, pageSize: 999 })
  const createTrip = useCreateTrip()
  const updateTrip = useUpdateTrip()
  const deleteTrip = useDeleteTrip()

  const customerOptions = (customersData?.data ?? []).map(c => ({
    value: c.id,
    label: c.name,
  }))

  const openModal = (trip?: Trip) => {
    if (trip) {
      setEditingTrip(trip)
      form.setFieldsValue({
        customerId: trip.customerId,
        tripDate: dayjs(trip.tripDate),
        tripTime: trip.tripTime,
        driver: trip.driver,
        vehiclePlate: trip.vehiclePlate,
        notes: trip.notes,
      })
    } else {
      setEditingTrip(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    // siteId 自動帶入，不需要表單填寫
    const formData: TripFormData = {
      customerId: values.customerId,
      siteId,
      tripDate: values.tripDate.format('YYYY-MM-DD'),
      tripTime: values.tripTime || null,
      driver: values.driver || null,
      vehiclePlate: values.vehiclePlate || null,
      notes: values.notes || null,
    }
    if (editingTrip) {
      await updateTrip.mutateAsync({ id: editingTrip.id, ...formData })
    } else {
      await createTrip.mutateAsync(formData)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingTrip(null)
  }

  // 表格欄位定義（不含站區欄，因為頁籤本身就代表站區）
  const columns = [
    {
      title: '收運日期',
      dataIndex: 'tripDate',
      key: 'tripDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '客戶',
      key: 'customer',
      render: (_: unknown, record: Trip) => record.customer?.name ?? '-',
    },
    {
      title: '司機',
      dataIndex: 'driver',
      key: 'driver',
      responsive: ['md' as const],
    },
    {
      title: '來源',
      dataIndex: 'source',
      key: 'source',
      render: (v: string) => (
        <Tag color={sourceColorMap[v] ?? 'default'}>
          {sourceLabelMap[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: Trip) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除此車趟？此操作無法復原。" onConfirm={() => deleteTrip.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 工具列：篩選器與新增按鈕 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Select
            allowClear placeholder="篩選客戶" style={{ width: isMobile ? '100%' : 200 }}
            options={customerOptions} onChange={v => { setFilterCustomerId(v); setPage(1) }}
            showSearch optionFilterProp="label"
          />
          <DatePicker.RangePicker
            style={{ width: isMobile ? '100%' : 260 }}
            onChange={(_, dateStrings) => {
              if (dateStrings[0] && dateStrings[1]) {
                setDateRange([dateStrings[0], dateStrings[1]])
              } else {
                setDateRange(undefined)
              }
              setPage(1)
            }}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {!isMobile && '新增車趟'}
        </Button>
      </div>

      {/* 桌面：表格（展開品項）/ 手機：卡片 */}
      {isMobile ? (
        <List
          loading={isLoading}
          dataSource={data?.data ?? []}
          pagination={{
            current: page, pageSize: 20,
            total: data?.pagination?.total ?? 0, onChange: setPage,
          }}
          renderItem={(trip: Trip) => (
            <Card
              size="small" style={{ marginBottom: 8 }}
              extra={
                <Space>
                  <Button type="link" size="small" icon={<ExpandOutlined />} onClick={() => setDetailTrip(trip)} />
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(trip)} />
                  <Popconfirm title="確定刪除此車趟？此操作無法復原。" onConfirm={() => deleteTrip.mutate(trip.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {dayjs(trip.tripDate).format('YYYY-MM-DD')}
                <Tag color={sourceColorMap[trip.source] ?? 'default'} style={{ marginLeft: 8 }}>
                  {sourceLabelMap[trip.source] ?? trip.source}
                </Tag>
              </div>
              <div style={{ color: '#666', fontSize: 12 }}>
                客戶：{trip.customer?.name ?? '-'}
                {trip.driver && ` | 司機：${trip.driver}`}
              </div>
            </Card>
          )}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={data?.data ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page, pageSize: 20,
            total: data?.pagination?.total ?? 0, onChange: setPage,
          }}
          expandable={{
            expandedRowRender: (record: Trip) => <TripItemsExpand tripId={record.id} />,
          }}
        />
      )}

      {/* 手機版品項明細 Modal */}
      <Modal
        title={detailTrip ? `品項明細 - ${dayjs(detailTrip.tripDate).format('YYYY-MM-DD')}` : '品項明細'}
        open={!!detailTrip}
        onCancel={() => setDetailTrip(null)}
        footer={null}
        width="95%"
      >
        {detailTrip && <TripItemsExpand tripId={detailTrip.id} />}
      </Modal>

      {/* 新增/編輯車趟 Modal（siteId 自動帶入，不在表單中顯示） */}
      <Modal
        title={editingTrip ? '編輯車趟' : `新增車趟 - ${siteName}`}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingTrip(null); form.resetFields() }}
        confirmLoading={createTrip.isPending || updateTrip.isPending}
        width={isMobile ? '95%' : 560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customerId" label="客戶" rules={[{ required: true, message: '請選擇客戶' }]}>
            <Select options={customerOptions} placeholder="請選擇客戶" showSearch optionFilterProp="label" />
          </Form.Item>
          <Space style={{ width: '100%' }} direction={isMobile ? 'vertical' : 'horizontal'}>
            <Form.Item name="tripDate" label="收運日期" rules={[{ required: true, message: '請選擇日期' }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="tripTime" label="收運時間" style={{ flex: 1 }}>
              <Input placeholder="例：08:30" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} direction={isMobile ? 'vertical' : 'horizontal'}>
            <Form.Item name="driver" label="司機" style={{ flex: 1 }}>
              <Input placeholder="司機姓名" />
            </Form.Item>
            <Form.Item name="vehiclePlate" label="車牌" style={{ flex: 1 }}>
              <Input placeholder="車牌號碼" />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} placeholder="備註（選填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

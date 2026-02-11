import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, InputNumber, Select, Space, DatePicker,
  Popconfirm, Typography, List, Tag, Divider,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ExpandOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip,
  useTripItems, useCreateTripItem, useDeleteTripItem,
  useCustomers, useSites, useItems,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { Trip, TripFormData, TripItem, TripItemFormData } from '../types'

const { Title, Text } = Typography

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

// 計費方向
const directionLabelMap: Record<string, string> = {
  receivable: '應收',
  payable: '應付',
  free: '免費',
}
const directionColorMap: Record<string, string> = {
  receivable: 'blue',
  payable: 'orange',
  free: 'default',
}

// ==================== 車趟品項展開列 ====================
function TripItemsExpand({ tripId }: { tripId: number }) {
  const { isMobile } = useResponsive()
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemForm] = Form.useForm<TripItemFormData>()

  const { data: tripItems, isLoading } = useTripItems(tripId)
  const { data: itemsData } = useItems({ all: true })
  const createItem = useCreateTripItem(tripId)
  const deleteItem = useDeleteTripItem(tripId)

  const itemOptions = (itemsData?.data ?? []).map(i => ({
    value: i.id,
    label: `${i.name}（${i.unit}）`,
  }))

  const handleItemSubmit = async () => {
    const values = await itemForm.validateFields()
    await createItem.mutateAsync(values)
    setItemModalOpen(false)
    itemForm.resetFields()
  }

  const columns = [
    {
      title: '品項',
      key: 'item',
      render: (_: unknown, record: TripItem) => record.item?.name ?? `#${record.itemId}`,
    },
    {
      title: '數量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v: string, record: TripItem) => `${Number(v).toLocaleString()} ${record.unit}`,
    },
    {
      title: '單價',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '方向',
      dataIndex: 'billingDirection',
      key: 'billingDirection',
      render: (v: string) => (
        <Tag color={directionColorMap[v] ?? 'default'}>
          {directionLabelMap[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '金額',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: TripItem) => (
        <Popconfirm title="確定刪除？" onConfirm={() => deleteItem.mutate(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>品項明細</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => { itemForm.resetFields(); setItemModalOpen(true) }}>
          新增品項
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={tripItems ?? []}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={isMobile ? { x: 500 } : undefined}
      />
      <Modal
        title="新增車趟品項"
        open={itemModalOpen}
        onOk={handleItemSubmit}
        onCancel={() => { setItemModalOpen(false); itemForm.resetFields() }}
        confirmLoading={createItem.isPending}
        width={isMobile ? '95%' : 480}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="itemId" label="品項" rules={[{ required: true, message: '請選擇品項' }]}>
            <Select options={itemOptions} placeholder="請選擇品項" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="quantity" label="數量" rules={[{ required: true, message: '請輸入數量' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="數量" />
          </Form.Item>
          <Form.Item name="manualPrice" label="手動單價（臨時客戶或無合約品項時必填）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="留空則自動帶入合約價" />
          </Form.Item>
          <Form.Item name="manualDirection" label="手動方向（臨時客戶或無合約品項時必填）">
            <Select
              allowClear
              placeholder="留空則自動帶入合約方向"
              options={[
                { value: 'receivable', label: '應收' },
                { value: 'payable', label: '應付' },
                { value: 'free', label: '免費' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ==================== 車趟管理主頁面 ====================
export default function TripsPage() {
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [filterCustomerId, setFilterCustomerId] = useState<number | undefined>()
  const [filterSiteId, setFilterSiteId] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useTrips({
    page,
    pageSize: 20,
    customerId: filterCustomerId,
    siteId: filterSiteId,
    dateFrom: dateRange?.[0],
    dateTo: dateRange?.[1],
  })
  const { data: customersData } = useCustomers({ pageSize: 999 })
  const { data: sitesData } = useSites({ all: true })
  const createTrip = useCreateTrip()
  const updateTrip = useUpdateTrip()
  const deleteTrip = useDeleteTrip()

  const customerOptions = (customersData?.data ?? []).map(c => ({
    value: c.id,
    label: `${c.name}${c.site?.name ? ` (${c.site.name})` : ''}`,
  }))
  const siteOptions = (sitesData?.data ?? []).map(s => ({ value: s.id, label: s.name }))

  const openModal = (trip?: Trip) => {
    if (trip) {
      setEditingTrip(trip)
      form.setFieldsValue({
        customerId: trip.customerId,
        siteId: trip.siteId,
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
    const formData: TripFormData = {
      customerId: values.customerId,
      siteId: values.siteId,
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
      title: '站區',
      key: 'site',
      responsive: ['lg' as const],
      render: (_: unknown, record: Trip) => record.site?.name ?? '-',
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
          <Popconfirm title="確定刪除此車趟？" onConfirm={() => deleteTrip.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>刪除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>車趟管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {!isMobile && '新增車趟'}
        </Button>
      </div>

      {/* 篩選列 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear placeholder="篩選客戶" style={{ width: isMobile ? '100%' : 200 }}
          options={customerOptions} onChange={v => { setFilterCustomerId(v); setPage(1) }}
          showSearch optionFilterProp="label"
        />
        <Select
          allowClear placeholder="篩選站區" style={{ width: 140 }}
          options={siteOptions} onChange={v => { setFilterSiteId(v); setPage(1) }}
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
                  <Popconfirm title="確定刪除？" onConfirm={() => deleteTrip.mutate(trip.id)}>
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
                客戶：{trip.customer?.name ?? '-'} | 站區：{trip.site?.name ?? '-'}
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

      {/* 新增/編輯車趟 Modal */}
      <Modal
        title={editingTrip ? '編輯車趟' : '新增車趟'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingTrip(null); form.resetFields() }}
        confirmLoading={createTrip.isPending || updateTrip.isPending}
        width={isMobile ? '95%' : 560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="customerId" label="客戶" rules={[{ required: true, message: '請選擇客戶' }]}>
            <Select options={customerOptions} placeholder="請選擇客戶" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="siteId" label="站區" rules={[{ required: true, message: '請選擇站區' }]}>
            <Select options={siteOptions} placeholder="請選擇站區" />
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

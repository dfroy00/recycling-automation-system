import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, InputNumber, Select, Switch, Space,
  Popconfirm, Typography, List, Tag, Divider, Row, Col,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
  useCustomerFees, useCreateCustomerFee, useUpdateCustomerFee, useDeleteCustomerFee,
  useSites,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { Customer, CustomerFormData, CustomerFee, CustomerFeeFormData } from '../types'

const { Title } = Typography

export default function CustomersPage() {
  const { isMobile, isDesktop } = useResponsive()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState<number | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [form] = Form.useForm<CustomerFormData>()

  // 附加費用相關
  const [feeModalOpen, setFeeModalOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<CustomerFee | null>(null)
  const [feeForm] = Form.useForm<CustomerFeeFormData>()

  const { data, isLoading } = useCustomers({ page, pageSize: 20, search, siteId: siteFilter, type: typeFilter })
  const { data: sitesData } = useSites({ all: true })
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  // 附加費用 hooks（僅在編輯客戶時使用）
  const { data: fees, refetch: refetchFees } = useCustomerFees(editingCustomer?.id ?? null)
  const createFee = useCreateCustomerFee(editingCustomer?.id ?? 0)
  const updateFee = useUpdateCustomerFee(editingCustomer?.id ?? 0)
  const deleteFee = useDeleteCustomerFee(editingCustomer?.id ?? 0)

  // 監聽車趟費啟用狀態
  const tripFeeEnabled = Form.useWatch('tripFeeEnabled', form)

  // 開啟新增/編輯 Modal
  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      form.setFieldsValue({
        ...customer,
        tripFeeAmount: customer.tripFeeAmount ? Number(customer.tripFeeAmount) : null,
      })
    } else {
      setEditingCustomer(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  // 送出客戶表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingCustomer) {
      await updateCustomer.mutateAsync({ id: editingCustomer.id, ...values })
    } else {
      await createCustomer.mutateAsync(values)
    }
    setModalOpen(false)
    form.resetFields()
    setEditingCustomer(null)
  }

  // 附加費用操作
  const openFeeModal = (fee?: CustomerFee) => {
    if (fee) {
      setEditingFee(fee)
      feeForm.setFieldsValue({ ...fee, amount: Number(fee.amount) })
    } else {
      setEditingFee(null)
      feeForm.resetFields()
    }
    setFeeModalOpen(true)
  }

  const handleFeeSubmit = async () => {
    const values = await feeForm.validateFields()
    if (editingFee) {
      await updateFee.mutateAsync({ id: editingFee.id, ...values })
    } else {
      await createFee.mutateAsync(values)
    }
    setFeeModalOpen(false)
    feeForm.resetFields()
    setEditingFee(null)
    refetchFees()
  }

  // 站區選項
  const siteOptions = (sitesData?.data ?? []).map((s) => ({ value: s.id, label: s.name }))

  // 類型標籤
  const typeLabel = (type: string) => type === 'contracted' ? '簽約' : '臨時'

  // 表格欄位
  const columns = [
    { title: '客戶名稱', dataIndex: 'name', key: 'name' },
    {
      title: '站區',
      key: 'site',
      responsive: ['md' as const],
      render: (_: unknown, record: Customer) => record.site?.name ?? '-',
    },
    {
      title: '類型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'contracted' ? 'blue' : 'orange'}>{typeLabel(type)}</Tag>
      ),
    },
    {
      title: '車趟費',
      key: 'tripFee',
      width: 80,
      responsive: ['lg' as const],
      render: (_: unknown, record: Customer) =>
        record.tripFeeEnabled
          ? record.tripFeeType === 'per_trip' ? '按次' : '按月'
          : '不收',
    },
    {
      title: '明細',
      dataIndex: 'statementType',
      key: 'statementType',
      width: 80,
      responsive: ['lg' as const],
      render: (v: string) => v === 'monthly' ? '月結' : '按趟',
    },
    {
      title: '付款',
      dataIndex: 'paymentType',
      key: 'paymentType',
      width: 80,
      responsive: ['lg' as const],
      render: (v: string) => v === 'lump_sum' ? '一次付' : '按趟付',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Customer) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除此客戶？" onConfirm={() => deleteCustomer.mutate(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>客戶管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {!isMobile && '新增客戶'}
        </Button>
      </div>

      {/* 篩選列 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜尋客戶名稱"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          allowClear
          placeholder="站區"
          style={{ width: 120 }}
          value={siteFilter}
          onChange={(val) => { setSiteFilter(val); setPage(1) }}
          options={siteOptions}
        />
        <Select
          allowClear
          placeholder="類型"
          style={{ width: 100 }}
          value={typeFilter}
          onChange={(val) => { setTypeFilter(val); setPage(1) }}
          options={[
            { value: 'contracted', label: '簽約' },
            { value: 'temporary', label: '臨時' },
          ]}
        />
      </Space>

      {/* 桌面：表格 / 手機：卡片 */}
      {isMobile ? (
        <List
          loading={isLoading}
          dataSource={data?.data ?? []}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.pagination?.total ?? 0,
            onChange: setPage,
          }}
          renderItem={(customer: Customer) => (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(customer)} />
                  <Popconfirm title="確定刪除？" onConfirm={() => deleteCustomer.mutate(customer.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {customer.name}
                <Tag color={customer.type === 'contracted' ? 'blue' : 'orange'} style={{ marginLeft: 8 }}>
                  {typeLabel(customer.type)}
                </Tag>
              </div>
              <div style={{ color: '#666', fontSize: 12 }}>
                {customer.site?.name ?? '-'}
                {' | '}車趟費:{customer.tripFeeEnabled ? (customer.tripFeeType === 'per_trip' ? '按次' : '按月') : '不收'}
                {' | '}{customer.statementType === 'monthly' ? '月結' : '按趟'}
                {' | '}{customer.paymentType === 'lump_sum' ? '一次付' : '按趟付'}
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
            current: page,
            pageSize: 20,
            total: data?.pagination?.total ?? 0,
            onChange: setPage,
          }}
        />
      )}

      {/* 客戶新增/編輯 Modal */}
      <Modal
        title={editingCustomer ? '編輯客戶' : '新增客戶'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingCustomer(null); form.resetFields() }}
        confirmLoading={createCustomer.isPending || updateCustomer.isPending}
        width={isMobile ? '95%' : 720}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="name" label="客戶名稱" rules={[{ required: true, message: '請輸入客戶名稱' }]}>
                <Input placeholder="請輸入客戶名稱" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="siteId" label="所屬站區" rules={[{ required: true, message: '請選擇站區' }]}>
                <Select placeholder="請選擇站區" options={siteOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="type" label="客戶類型" rules={[{ required: true, message: '請選擇類型' }]}>
                <Select
                  placeholder="請選擇類型"
                  options={[
                    { value: 'contracted', label: '簽約客戶' },
                    { value: 'temporary', label: '臨時客戶' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="contactPerson" label="聯絡人">
                <Input placeholder="請輸入聯絡人" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="phone" label="電話">
                <Input placeholder="請輸入電話" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="address" label="地址">
                <Input placeholder="請輸入地址" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>車趟費設定</Divider>
          <Row gutter={16}>
            <Col xs={24} lg={8}>
              <Form.Item name="tripFeeEnabled" label="是否收車趟費" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            {tripFeeEnabled && (
              <>
                <Col xs={24} lg={8}>
                  <Form.Item name="tripFeeType" label="車趟費類型">
                    <Select
                      options={[
                        { value: 'per_trip', label: '按次' },
                        { value: 'per_month', label: '按月' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={8}>
                  <Form.Item name="tripFeeAmount" label="車趟費金額">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="金額" />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          <Divider>結算與付款</Divider>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="statementType" label="明細產出方式" initialValue="monthly">
                <Select
                  options={[
                    { value: 'monthly', label: '月結' },
                    { value: 'per_trip', label: '按趟' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="paymentType" label="付款方式" initialValue="lump_sum">
                <Select
                  options={[
                    { value: 'lump_sum', label: '一次付清' },
                    { value: 'per_trip', label: '按趟分次付款' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="statementSendDay" label="明細寄送日（每月幾號）" initialValue={15}>
                <InputNumber style={{ width: '100%' }} min={1} max={28} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="paymentDueDay" label="付款到期日（每月幾號）" initialValue={15}>
                <InputNumber style={{ width: '100%' }} min={1} max={28} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>發票與通知</Divider>
          <Row gutter={16}>
            <Col xs={24} lg={8}>
              <Form.Item name="invoiceRequired" label="是否開立發票" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="invoiceType" label="開票方式" initialValue="net">
                <Select
                  options={[
                    { value: 'net', label: '淨額一張' },
                    { value: 'separate', label: '應收應付分開' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="notificationMethod" label="通知方式" initialValue="email">
                <Select
                  options={[
                    { value: 'email', label: 'Email' },
                    { value: 'line', label: 'LINE' },
                    { value: 'both', label: 'Email + LINE' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="notificationEmail" label="通知 Email">
                <Input placeholder="請輸入 Email" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="paymentAccount" label="匯款帳戶資訊">
                <Input placeholder="如：台北富邦 012-xxxxx" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="status" label="狀態" initialValue="active">
            <Select
              options={[
                { value: 'active', label: '啟用' },
                { value: 'inactive', label: '停用' },
              ]}
            />
          </Form.Item>

          {/* 附加費用區塊（僅編輯模式顯示） */}
          {editingCustomer && (
            <>
              <Divider>附加費用</Divider>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Typography.Text strong>費用列表</Typography.Text>
                <Button size="small" icon={<PlusOutlined />} onClick={() => openFeeModal()}>
                  新增費用
                </Button>
              </div>
              <Table
                size="small"
                dataSource={fees ?? []}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '費用名稱', dataIndex: 'name', key: 'name' },
                  { title: '金額', dataIndex: 'amount', key: 'amount' },
                  {
                    title: '方向',
                    dataIndex: 'billingDirection',
                    key: 'billingDirection',
                    render: (v: string) => (
                      <Tag color={v === 'receivable' ? 'green' : 'red'}>
                        {v === 'receivable' ? '應收' : '應付'}
                      </Tag>
                    ),
                  },
                  {
                    title: '頻率',
                    dataIndex: 'frequency',
                    key: 'frequency',
                    render: (v: string) => v === 'monthly' ? '按月' : '按趟',
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    width: 100,
                    render: (_: unknown, record: CustomerFee) => (
                      <Space>
                        <Button type="link" size="small" onClick={() => openFeeModal(record)}>編輯</Button>
                        <Popconfirm title="確定刪除？" onConfirm={() => deleteFee.mutate(record.id)}>
                          <Button type="link" size="small" danger>刪除</Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </>
          )}
        </Form>
      </Modal>

      {/* 附加費用新增/編輯 Modal */}
      <Modal
        title={editingFee ? '編輯附加費用' : '新增附加費用'}
        open={feeModalOpen}
        onOk={handleFeeSubmit}
        onCancel={() => { setFeeModalOpen(false); setEditingFee(null); feeForm.resetFields() }}
        confirmLoading={createFee.isPending || updateFee.isPending}
        width={isMobile ? '95%' : 420}
      >
        <Form form={feeForm} layout="vertical">
          <Form.Item name="name" label="費用名稱" rules={[{ required: true, message: '請輸入費用名稱' }]}>
            <Input placeholder="如：處理費、環保補貼" />
          </Form.Item>
          <Form.Item name="amount" label="金額" rules={[{ required: true, message: '請輸入金額' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="固定金額" />
          </Form.Item>
          <Form.Item name="billingDirection" label="費用方向" rules={[{ required: true, message: '請選擇方向' }]}>
            <Select
              options={[
                { value: 'receivable', label: '應收（客戶付我方）' },
                { value: 'payable', label: '應付（我方付客戶）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="frequency" label="頻率" rules={[{ required: true, message: '請選擇頻率' }]}>
            <Select
              options={[
                { value: 'monthly', label: '按月' },
                { value: 'per_trip', label: '按趟' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="狀態" initialValue="active">
            <Select
              options={[
                { value: 'active', label: '啟用' },
                { value: 'inactive', label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

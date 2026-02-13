import { Form, Input, InputNumber, Select, Switch, Row, Col, Divider, Button, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useCreateCustomer, useUpdateCustomer, useSites, useBusinessEntities } from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import type { Customer } from '../types'

interface Props {
  customer: Customer | null
  isNew?: boolean
  onCreated?: (newId: number) => void
}

/**
 * 客戶基本資料 Tab
 * 從 CustomersPage Modal 提取為 inline 表單
 * 支援新增（customer=null）和編輯模式
 */
export default function CustomerInfoTab({ customer, isNew, onCreated }: Props) {
  const { canEdit } = useAuth()
  const [form] = Form.useForm()
  const updateCustomer = useUpdateCustomer()
  const createCustomer = useCreateCustomer()
  const { data: sitesData } = useSites({ all: true })
  const { data: businessEntitiesData } = useBusinessEntities({ all: true })

  // 監聽車趟費啟用狀態
  const tripFeeEnabled = Form.useWatch('tripFeeEnabled', form)
  // 監聯是否開立發票
  const invoiceRequired = Form.useWatch('invoiceRequired', form)

  // 站區選項
  const siteOptions = (sitesData?.data ?? []).map(s => ({ value: s.id, label: s.name }))

  // 行號選項
  const businessEntityOptions = (businessEntitiesData?.data ?? [])
    .filter(e => e.status === 'active')
    .map(e => ({ value: e.id, label: `${e.name}（${e.taxId}）` }))

  // 儲存 / 新增
  const handleSave = async () => {
    const values = await form.validateFields()
    if (isNew) {
      // 新增客戶
      const created = await createCustomer.mutateAsync(values)
      message.success('客戶新增成功')
      onCreated?.(created.id)
    } else if (customer) {
      // 更新客戶
      await updateCustomer.mutateAsync({ id: customer.id, ...values })
      message.success('客戶資料已更新')
    }
  }

  // 初始值
  const initialValues = customer
    ? {
      ...customer,
      tripFeeAmount: customer.tripFeeAmount ? Number(customer.tripFeeAmount) : null,
      businessEntityId: customer.businessEntityId ?? undefined,
    }
    : {
      // 新增預設值
      type: 'temporary',
      tripFeeEnabled: false,
      statementType: 'monthly',
      paymentType: 'lump_sum',
      statementSendDay: 15,
      paymentDueDay: 15,
      invoiceRequired: false,
      invoiceType: 'net',
      notificationMethod: 'email',
      status: 'active',
    }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      disabled={!isNew && !canEdit}
    >
      {/* 基本資料 */}
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

      {/* 車趟費設定 */}
      <Divider>車趟費設定</Divider>
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Form.Item name="tripFeeEnabled" label="是否收車趟費" valuePropName="checked">
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

      {/* 結算與付款 */}
      <Divider>結算與付款</Divider>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Form.Item name="statementType" label="明細產出方式">
            <Select
              options={[
                { value: 'monthly', label: '月結' },
                { value: 'per_trip', label: '按趟' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="paymentType" label="付款方式">
            <Select
              options={[
                { value: 'lump_sum', label: '一次付清' },
                { value: 'per_trip', label: '按趟分次付款' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="statementSendDay" label="明細寄送日（每月幾號）">
            <InputNumber style={{ width: '100%' }} min={1} max={28} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="paymentDueDay" label="付款到期日（每月幾號）">
            <InputNumber style={{ width: '100%' }} min={1} max={28} />
          </Form.Item>
        </Col>
      </Row>

      {/* 發票與通知 */}
      <Divider>發票與通知</Divider>
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Form.Item name="invoiceRequired" label="是否開立發票" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={24} lg={8}>
          <Form.Item name="invoiceType" label="開票方式">
            <Select
              options={[
                { value: 'net', label: '淨額一張' },
                { value: 'separate', label: '應收應付分開' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} lg={8}>
          <Form.Item
            name="businessEntityId"
            label="開票行號"
            rules={[{ required: invoiceRequired, message: '開立發票時，開票行號為必填' }]}
          >
            <Select
              allowClear
              placeholder={invoiceRequired ? '請選擇行號（必填）' : '請選擇行號'}
              options={businessEntityOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Col>
        <Col xs={24} lg={8}>
          <Form.Item name="notificationMethod" label="通知方式">
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

      <Form.Item name="status" label="狀態">
        <Select
          options={[
            { value: 'active', label: '啟用' },
            { value: 'inactive', label: '停用' },
          ]}
        />
      </Form.Item>

      {/* 儲存按鈕（僅可編輯角色或新增模式） */}
      {(isNew || canEdit) && (
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={createCustomer.isPending || updateCustomer.isPending}
          >
            {isNew ? '建立客戶' : '儲存變更'}
          </Button>
        </div>
      )}
    </Form>
  )
}

import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Input, InputNumber, Select, Space,
  Popconfirm, Typography, List, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useHolidays, useCreateHoliday, useDeleteHoliday, useImportHolidays } from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { Holiday, HolidayFormData } from '../types'

const { Title } = Typography

export default function HolidaysPage() {
  const { isMobile } = useResponsive()
  const currentYear = dayjs().year()
  const [yearFilter, setYearFilter] = useState<number>(currentYear)
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [form] = Form.useForm<HolidayFormData>()

  // 後端回傳純陣列，無分頁
  const { data, isLoading } = useHolidays({ year: yearFilter })
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()
  const importHolidays = useImportHolidays()

  // 送出新增表單
  const handleSubmit = async () => {
    const values = await form.validateFields()
    await createHoliday.mutateAsync(values)
    setModalOpen(false)
    form.resetFields()
  }

  // 批次匯入
  const handleImport = async () => {
    try {
      const holidays = JSON.parse(importJson) as HolidayFormData[]
      if (!Array.isArray(holidays)) {
        message.error('JSON 格式錯誤，必須是陣列')
        return
      }
      await importHolidays.mutateAsync(holidays)
      setImportModalOpen(false)
      setImportJson('')
    } catch {
      message.error('JSON 解析失敗，請確認格式正確')
    }
  }

  // 年份選項
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map((y) => ({
    value: y,
    label: `${y} 年`,
  }))

  // 表格欄位
  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    { title: '假日名稱', dataIndex: 'name', key: 'name' },
    { title: '年份', dataIndex: 'year', key: 'year', width: 80 },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Holiday) => (
        <Popconfirm title="確定刪除此假日？" onConfirm={() => deleteHoliday.mutate(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            刪除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>假日設定</Title>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
            {!isMobile && '批次匯入'}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {!isMobile && '新增假日'}
          </Button>
        </Space>
      </div>

      {/* 年份篩選 */}
      <div style={{ marginBottom: 16 }}>
        <Select
          value={yearFilter}
          onChange={(val) => setYearFilter(val)}
          options={yearOptions}
          style={{ width: 120 }}
        />
      </div>

      {/* 桌面：表格 / 手機：卡片 */}
      {isMobile ? (
        <List
          loading={isLoading}
          dataSource={data ?? []}
          pagination={{ pageSize: 20 }}
          renderItem={(holiday: Holiday) => (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                <Popconfirm title="確定刪除？" onConfirm={() => deleteHoliday.mutate(holiday.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{holiday.name}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                {dayjs(holiday.date).format('YYYY-MM-DD')}
              </div>
            </Card>
          )}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={data ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
        />
      )}

      {/* 新增假日 Modal */}
      <Modal
        title="新增假日"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        confirmLoading={createHoliday.isPending}
        width={isMobile ? '95%' : 420}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '請選擇日期' }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item name="name" label="假日名稱" rules={[{ required: true, message: '請輸入假日名稱' }]}>
            <Input placeholder="如：元旦、春節" />
          </Form.Item>
          <Form.Item name="year" label="年份" rules={[{ required: true, message: '請輸入年份' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="如：2026" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批次匯入 Modal */}
      <Modal
        title="批次匯入假日"
        open={importModalOpen}
        onOk={handleImport}
        onCancel={() => { setImportModalOpen(false); setImportJson('') }}
        confirmLoading={importHolidays.isPending}
        width={isMobile ? '95%' : 600}
      >
        <Typography.Paragraph type="secondary">
          請輸入 JSON 陣列格式，範例：
        </Typography.Paragraph>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12 }}>
{`[
  { "date": "2026-01-01", "name": "元旦", "year": 2026 },
  { "date": "2026-01-29", "name": "除夕", "year": 2026 }
]`}
        </pre>
        <Input.TextArea
          rows={8}
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder="貼上 JSON 陣列..."
        />
      </Modal>
    </div>
  )
}

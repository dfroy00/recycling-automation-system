import { useState } from 'react'
import {
  Table, Card, Button, Modal, Form, Select, Space, DatePicker, Input,
  Typography, List, Tag, Tabs, Descriptions, Popconfirm,
} from 'antd'
import {
  CheckOutlined, CloseOutlined, FileTextOutlined, SendOutlined,
  ReloadOutlined, StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useStatements, useGenerateStatements, useReviewStatement,
  useInvoiceStatement, useSendStatement, useVoidStatement,
  useCustomers, useTrips,
} from '../api/hooks'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import type { Statement, Trip, TripItem } from '../types'

const { Title, Text } = Typography

// 狀態選項
const statusTabs = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '待審核' },
  { key: 'approved', label: '已審核' },
  { key: 'invoiced', label: '已開票' },
  { key: 'sent', label: '已寄送' },
  { key: 'rejected', label: '退回' },
  { key: 'voided', label: '已作廢' },
]

const statusColorMap: Record<string, string> = {
  draft: 'default',
  approved: 'blue',
  rejected: 'red',
  invoiced: 'cyan',
  sent: 'green',
  voided: 'volcano',
}

const statusLabelMap: Record<string, string> = {
  draft: '待審核',
  approved: '已審核',
  rejected: '退回',
  invoiced: '已開票',
  sent: '已寄送',
  voided: '已作廢',
}

// ==================== 明細展開元件 ====================
function StatementDetail({ statement }: { statement: Statement }) {
  const detail = statement.detailJson as Record<string, unknown> | null

  return (
    <div style={{ padding: '8px 0' }}>
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="品項應收">${Number(statement.itemReceivable).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="品項應付">${Number(statement.itemPayable).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="車趟費合計">${Number(statement.tripFeeTotal).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="附加應收">${Number(statement.additionalFeeReceivable).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="附加應付">${Number(statement.additionalFeePayable).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="應收合計">${Number(statement.totalReceivable).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="應付合計">${Number(statement.totalPayable).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="淨額">${Number(statement.netAmount).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="小計">${Number(statement.subtotal).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="稅額（5%）">${Number(statement.taxAmount).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="總額" span={2}>
          <Text strong style={{ fontSize: 16 }}>${Number(statement.totalAmount).toLocaleString()}</Text>
        </Descriptions.Item>
      </Descriptions>
      {statement.voidReason && (
        <div style={{ marginTop: 8, color: '#ff4d4f' }}>
          作廢原因：{statement.voidReason}
        </div>
      )}
    </div>
  )
}

// ==================== 月結管理主頁面 ====================
export default function StatementsPage() {
  const { canEdit } = useAuth()
  const { isMobile } = useResponsive()
  const [page, setPage] = useState(1)
  const [yearMonth, setYearMonth] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [filterCustomerId, setFilterCustomerId] = useState<number | undefined>()
  const [voidModalOpen, setVoidModalOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [detailStatement, setDetailStatement] = useState<Statement | null>(null)

  const { data, isLoading } = useStatements({
    page,
    pageSize: 20,
    yearMonth,
    status: statusFilter === 'all' ? undefined : statusFilter,
    customerId: filterCustomerId,
  })
  const { data: customersData } = useCustomers({ pageSize: 999 })
  const generateStatements = useGenerateStatements()
  const reviewStatement = useReviewStatement()
  const invoiceStatement = useInvoiceStatement()
  const sendStatement = useSendStatement()
  const voidStatement = useVoidStatement()

  // 車趟預覽：當月份和客戶都選定時，查詢該月車趟
  const { data: previewTrips, isLoading: previewLoading } = useTrips(
    yearMonth && filterCustomerId
      ? {
          customerId: filterCustomerId,
          dateFrom: `${yearMonth}-01`,
          dateTo: dayjs(`${yearMonth}-01`).endOf('month').format('YYYY-MM-DD'),
          pageSize: 999,
        }
      : { pageSize: 0 }
  )

  const customerOptions = (customersData?.data ?? []).map(c => ({
    value: c.id,
    label: c.name,
  }))

  // 處理作廢
  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) return
    await voidStatement.mutateAsync({ id: voidTarget, reason: voidReason })
    setVoidModalOpen(false)
    setVoidTarget(null)
    setVoidReason('')
  }

  // 操作按鈕（僅 canEdit 角色可操作）
  const renderActions = (record: Statement) => {
    if (!canEdit) return null
    const actions: React.ReactNode[] = []

    if (record.status === 'draft') {
      actions.push(
        <Popconfirm key="approve" title="確定審核通過？" onConfirm={() => reviewStatement.mutate({ id: record.id, action: 'approve' })}>
          <Button type="link" size="small" icon={<CheckOutlined />}>通過</Button>
        </Popconfirm>,
        <Popconfirm key="reject" title="確定退回？" onConfirm={() => reviewStatement.mutate({ id: record.id, action: 'reject' })}>
          <Button type="link" size="small" danger icon={<CloseOutlined />}>退回</Button>
        </Popconfirm>,
      )
    }
    if (record.status === 'approved') {
      actions.push(
        <Button key="invoice" type="link" size="small" icon={<FileTextOutlined />}
          onClick={() => invoiceStatement.mutate(record.id)}>
          標記開票
        </Button>,
      )
    }
    if (record.status === 'approved' || record.status === 'invoiced') {
      actions.push(
        <Button key="send" type="link" size="small" icon={<SendOutlined />}
          onClick={() => sendStatement.mutate(record.id)}>
          寄送
        </Button>,
      )
    }
    if (record.status === 'sent' || record.status === 'invoiced') {
      actions.push(
        <Button key="void" type="link" size="small" danger icon={<StopOutlined />}
          onClick={() => { setVoidTarget(record.id); setVoidReason(''); setVoidModalOpen(true) }}>
          作廢
        </Button>,
      )
    }
    return <Space wrap>{actions}</Space>
  }

  const columns = [
    {
      title: '月份',
      dataIndex: 'yearMonth',
      key: 'yearMonth',
      width: 100,
    },
    {
      title: '客戶',
      key: 'customer',
      render: (_: unknown, record: Statement) => record.customer?.name ?? '-',
    },
    {
      title: '類型',
      dataIndex: 'statementType',
      key: 'statementType',
      width: 80,
      render: (v: string) => v === 'monthly' ? '月結' : '按趟',
    },
    {
      title: '應收',
      dataIndex: 'totalReceivable',
      key: 'totalReceivable',
      responsive: ['md' as const],
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '應付',
      dataIndex: 'totalPayable',
      key: 'totalPayable',
      responsive: ['md' as const],
      render: (v: string) => `$${Number(v).toLocaleString()}`,
    },
    {
      title: '總額',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (v: string) => <Text strong>${Number(v).toLocaleString()}</Text>,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => (
        <Tag color={statusColorMap[v] ?? 'default'}>
          {statusLabelMap[v] ?? v}
        </Tag>
      ),
    },
    ...(canEdit ? [{
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Statement) => renderActions(record),
    }] : []),
  ]

  return (
    <div>
      {/* 標題列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>月結管理</Title>
        {canEdit && (
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => generateStatements.mutate({ yearMonth })}
            loading={generateStatements.isPending}
          >
            {!isMobile && '產出月結明細'}
          </Button>
        )}
      </div>

      {/* 篩選列 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker
          picker="month"
          placeholder="選擇月份"
          style={{ width: 160 }}
          onChange={(_, dateStr) => {
            setYearMonth(dateStr || undefined)
            setPage(1)
          }}
        />
        <Select
          allowClear placeholder="篩選客戶"
          style={{ width: isMobile ? '100%' : 200 }}
          options={customerOptions}
          onChange={v => { setFilterCustomerId(v); setPage(1) }}
          showSearch optionFilterProp="label"
        />
      </Space>

      {/* 車趟預覽 */}
      {yearMonth && filterCustomerId ? (
        <Card
          title={`車趟預覽：${yearMonth}`}
          style={{ marginBottom: 16 }}
          loading={previewLoading}
          size="small"
        >
          {(previewTrips?.data ?? []).length === 0 ? (
            <Text type="secondary">該客戶該月無車趟紀錄</Text>
          ) : (
            <>
              <Text style={{ marginBottom: 8, display: 'block' }}>
                共 {(previewTrips?.data ?? []).length} 趟
              </Text>
              <Table<Trip>
                columns={[
                  { title: '日期', dataIndex: 'tripDate', key: 'date', render: (v: string) => dayjs(v).format('MM/DD') },
                  { title: '司機', dataIndex: 'driver', key: 'driver', render: (v: string | null) => v ?? '-' },
                  { title: '車牌', dataIndex: 'vehiclePlate', key: 'plate', render: (v: string | null) => v ?? '-' },
                  { title: '來源', dataIndex: 'source', key: 'source' },
                  { title: '品項數', key: 'itemCount', render: (_: unknown, r: Trip) => r.items?.length ?? 0 },
                ]}
                dataSource={previewTrips?.data ?? []}
                rowKey="id"
                size="small"
                pagination={false}
                expandable={{
                  expandedRowRender: (record: Trip) => (
                    <Table<TripItem>
                      columns={[
                        { title: '品項', key: 'itemName', render: (_: unknown, r: TripItem) => r.item?.name ?? '-' },
                        { title: '數量', key: 'qty', render: (_: unknown, r: TripItem) => `${Number(r.quantity)} ${r.unit}` },
                        { title: '單價', dataIndex: 'unitPrice', key: 'price', render: (v: string) => `$${Number(v).toLocaleString()}` },
                        { title: '方向', dataIndex: 'billingDirection', key: 'dir' },
                        { title: '金額', dataIndex: 'amount', key: 'amount', render: (v: string) => `$${Number(v).toLocaleString()}` },
                      ]}
                      dataSource={record.items ?? []}
                      rowKey="id"
                      size="small"
                      pagination={false}
                    />
                  ),
                }}
              />
            </>
          )}
        </Card>
      ) : (
        yearMonth || filterCustomerId ? (
          <Card style={{ marginBottom: 16 }} size="small">
            <Text type="secondary">請同時選擇月份和客戶以預覽車趟</Text>
          </Card>
        ) : null
      )}

      {/* 狀態 Tab */}
      <Tabs
        activeKey={statusFilter}
        onChange={v => { setStatusFilter(v); setPage(1) }}
        items={statusTabs.map(t => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 8 }}
      />

      {/* 桌面：表格 / 手機：卡片 */}
      {isMobile ? (
        <List
          loading={isLoading}
          dataSource={data?.data ?? []}
          pagination={{
            current: page, pageSize: 20,
            total: data?.pagination?.total ?? 0, onChange: setPage,
          }}
          renderItem={(stmt: Statement) => (
            <Card
              size="small" style={{ marginBottom: 8 }}
              extra={
                <Button type="link" size="small" onClick={() => setDetailStatement(stmt)}>
                  明細
                </Button>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {stmt.customer?.name ?? '-'}
                <Tag color={statusColorMap[stmt.status] ?? 'default'} style={{ marginLeft: 8 }}>
                  {statusLabelMap[stmt.status] ?? stmt.status}
                </Tag>
              </div>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                {stmt.yearMonth} | {stmt.statementType === 'monthly' ? '月結' : '按趟'} | 總額：${Number(stmt.totalAmount).toLocaleString()}
              </div>
              {renderActions(stmt)}
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
            expandedRowRender: (record: Statement) => <StatementDetail statement={record} />,
          }}
        />
      )}

      {/* 手機版明細 Modal */}
      <Modal
        title="明細詳情"
        open={!!detailStatement}
        onCancel={() => setDetailStatement(null)}
        footer={null}
        width="95%"
      >
        {detailStatement && <StatementDetail statement={detailStatement} />}
      </Modal>

      {/* 作廢原因 Modal */}
      <Modal
        title="作廢明細"
        open={voidModalOpen}
        onOk={handleVoid}
        onCancel={() => { setVoidModalOpen(false); setVoidTarget(null) }}
        confirmLoading={voidStatement.isPending}
        okButtonProps={{ disabled: !voidReason.trim() }}
      >
        <p>請輸入作廢原因（必填）：</p>
        <Input.TextArea
          rows={3}
          value={voidReason}
          onChange={e => setVoidReason(e.target.value)}
          placeholder="請說明作廢原因"
        />
      </Modal>
    </div>
  )
}

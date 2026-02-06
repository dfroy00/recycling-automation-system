// 報表管理頁面 - 月結明細產生、查詢、PDF 下載、Excel 發票匯出
import { useState } from 'react'
import { Table, Button, Space, Typography, Tag, Input, Select, Modal, message, Row, Col, Card, Statistic } from 'antd'
import {
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

export default function ReportsPage() {
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 })
  const [generateYearMonth, setGenerateYearMonth] = useState(dayjs().format('YYYY-MM'))
  const queryClient = useQueryClient()

  // 查詢月結明細
  const { data, isLoading } = useQuery({
    queryKey: ['monthly-statements', filters],
    queryFn: () => api.get('/reports/monthly', { params: filters }).then(r => r.data),
  })

  // 產生月結明細
  const generateMutation = useMutation({
    mutationFn: (yearMonth: string) => api.post('/reports/monthly/generate', { yearMonth }),
    onSuccess: (res) => {
      message.success(`已產生 ${res.data.total} 筆月結明細`)
      queryClient.invalidateQueries({ queryKey: ['monthly-statements'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || '產生失敗')
    },
  })

  // 批次產生 PDF
  const generatePdfMutation = useMutation({
    mutationFn: (yearMonth: string) => api.post('/reports/monthly/generate-pdf', { yearMonth }),
    onSuccess: (res) => {
      message.success(`PDF 產生完成：${res.data.success}/${res.data.total} 成功`)
      queryClient.invalidateQueries({ queryKey: ['monthly-statements'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'PDF 產生失敗')
    },
  })

  // 下載單一 PDF
  const downloadPdf = async (statementId: number, customerId: string, yearMonth: string) => {
    try {
      const res = await api.get(`/reports/monthly/${statementId}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${customerId}_${yearMonth}_明細.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('PDF 下載失敗')
    }
  }

  // 下載發票 Excel
  const downloadInvoice = async (yearMonth: string) => {
    try {
      const res = await api.get('/reports/invoice', {
        params: { yearMonth },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Invoice_${yearMonth}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('發票下載失敗')
    }
  }

  // 統計數據
  const totalAmount = data?.data?.reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0) || 0
  const totalRecords = data?.total || 0
  const hasPdf = data?.data?.filter((s: any) => s.pdfPath).length || 0

  const sendStatusColors: Record<string, string> = {
    success: 'green',
    failed: 'red',
    pending: 'orange',
    skipped: 'default',
  }

  const columns = [
    {
      title: '客戶編號', dataIndex: 'customerId', key: 'customerId', width: 100,
    },
    {
      title: '客戶名稱', dataIndex: ['customer', 'customerName'], key: 'customerName',
    },
    {
      title: '計費類型', dataIndex: ['customer', 'billingType'], key: 'billingType', width: 90,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '年月', dataIndex: 'yearMonth', key: 'yearMonth', width: 100,
    },
    {
      title: '總金額', dataIndex: 'totalAmount', key: 'totalAmount', width: 120,
      render: (v: number) => `$${Number(v).toLocaleString()}`,
      sorter: (a: any, b: any) => Number(a.totalAmount) - Number(b.totalAmount),
    },
    {
      title: '發送狀態', dataIndex: 'sendStatus', key: 'sendStatus', width: 100,
      render: (s: string) => <Tag color={sendStatusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: '產生時間', dataIndex: 'generatedAt', key: 'generatedAt', width: 160,
      render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => downloadPdf(record.statementId, record.customerId, record.yearMonth)}
          >
            PDF
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* 標題列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>報表管理</Title>
      </div>

      {/* 操作區 */}
      <Card size="small">
        <Row gutter={16} align="middle">
          <Col>
            <Input
              placeholder="年月 (YYYY-MM)"
              value={generateYearMonth}
              onChange={e => setGenerateYearMonth(e.target.value)}
              style={{ width: 160 }}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={generateMutation.isPending}
              onClick={() => {
                Modal.confirm({
                  title: '產生月結明細',
                  content: `確定要產生 ${generateYearMonth} 的月結明細嗎？若已有資料將重新計算。`,
                  onOk: () => generateMutation.mutate(generateYearMonth),
                })
              }}
            >
              產生月結
            </Button>
          </Col>
          <Col>
            <Button
              icon={<FilePdfOutlined />}
              loading={generatePdfMutation.isPending}
              onClick={() => {
                Modal.confirm({
                  title: '批次產生 PDF',
                  content: `確定要為 ${generateYearMonth} 的所有明細產生 PDF 嗎？`,
                  onOk: () => generatePdfMutation.mutate(generateYearMonth),
                })
              }}
            >
              批次產生 PDF
            </Button>
          </Col>
          <Col>
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => downloadInvoice(generateYearMonth)}
            >
              下載發票 Excel
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 統計卡片 */}
      {data?.data && data.data.length > 0 && (
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="明細筆數"
                value={totalRecords}
                prefix={<FileTextOutlined />}
                suffix="筆"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="總金額"
                value={totalAmount}
                prefix="$"
                precision={0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="已產生 PDF"
                value={hasPdf}
                prefix={<FilePdfOutlined />}
                suffix={`/ ${data.data.length}`}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 篩選器 */}
      <Row gutter={16}>
        <Col span={6}>
          <Input
            placeholder="年月 (YYYY-MM)"
            onChange={e => setFilters((f: any) => ({ ...f, yearMonth: e.target.value, page: 1 }))}
            allowClear
          />
        </Col>
        <Col span={6}>
          <Input
            placeholder="客戶編號"
            onChange={e => setFilters((f: any) => ({ ...f, customerId: e.target.value, page: 1 }))}
            allowClear
          />
        </Col>
        <Col span={4}>
          <Select
            placeholder="發送狀態"
            allowClear
            style={{ width: '100%' }}
            onChange={v => setFilters((f: any) => ({ ...f, sendStatus: v, page: 1 }))}
          >
            <Select.Option value="pending">待發送</Select.Option>
            <Select.Option value="success">已發送</Select.Option>
            <Select.Option value="failed">發送失敗</Select.Option>
            <Select.Option value="skipped">已跳過</Select.Option>
          </Select>
        </Col>
      </Row>

      {/* 明細表格 */}
      <Table
        columns={columns}
        dataSource={data?.data}
        rowKey="statementId"
        loading={isLoading}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total: data?.total,
          showTotal: (total: number) => `共 ${total} 筆`,
          onChange: (page, pageSize) => setFilters((f: any) => ({ ...f, page, pageSize })),
        }}
        size="small"
      />
    </Space>
  )
}

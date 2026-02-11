import { useState } from 'react'
import {
  Card, Button, Select, DatePicker, Typography, Space, message,
} from 'antd'
import {
  FilePdfOutlined, FileExcelOutlined, DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import apiClient from '../api/client'
import { useCustomers, useSites } from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'

const { Title } = Typography

export default function ReportsPage() {
  const { isMobile } = useResponsive()
  const [pdfCustomerId, setPdfCustomerId] = useState<number | undefined>()
  const [pdfYearMonth, setPdfYearMonth] = useState<string>('')
  const [excelSiteId, setExcelSiteId] = useState<number | undefined>()
  const [excelYearMonth, setExcelYearMonth] = useState<string>('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)

  const { data: customersData } = useCustomers({ pageSize: 999 })
  const { data: sitesData } = useSites({ all: true })

  const customerOptions = (customersData?.data ?? []).map(c => ({
    value: c.id,
    label: c.name,
  }))
  const siteOptions = (sitesData?.data ?? []).map(s => ({
    value: s.id,
    label: s.name,
  }))

  // 下載客戶 PDF 報表
  const handleDownloadPdf = async () => {
    if (!pdfCustomerId || !pdfYearMonth) {
      message.warning('請選擇客戶和月份')
      return
    }
    setPdfLoading(true)
    try {
      const response = await apiClient.get(`/reports/customers/${pdfCustomerId}`, {
        params: { yearMonth: pdfYearMonth },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `客戶明細_${pdfYearMonth}_${pdfCustomerId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('PDF 報表下載成功')
    } catch {
      message.error('PDF 報表下載失敗')
    } finally {
      setPdfLoading(false)
    }
  }

  // 下載站區 Excel 報表
  const handleDownloadExcel = async () => {
    if (!excelSiteId || !excelYearMonth) {
      message.warning('請選擇站區和月份')
      return
    }
    setExcelLoading(true)
    try {
      const response = await apiClient.get(`/reports/sites/${excelSiteId}`, {
        params: { yearMonth: excelYearMonth },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `站區報表_${excelYearMonth}_${excelSiteId}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('Excel 報表下載成功')
    } catch {
      message.error('Excel 報表下載失敗')
    } finally {
      setExcelLoading(false)
    }
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>報表下載</Title>

      <Space direction={isMobile ? 'vertical' : 'horizontal'} size="middle" style={{ width: '100%' }} align="start">
        {/* 客戶 PDF 報表 */}
        <Card
          title={<><FilePdfOutlined /> 客戶明細 PDF</>}
          style={{ flex: 1, minWidth: isMobile ? '100%' : 340 }}
        >
          <p style={{ color: '#666', marginBottom: 16 }}>
            產出指定客戶的月結明細 PDF 報表，包含品項明細、車趟費、附加費用等完整資訊。
          </p>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              placeholder="請選擇客戶"
              style={{ width: '100%' }}
              options={customerOptions}
              onChange={setPdfCustomerId}
              showSearch
              optionFilterProp="label"
            />
            <DatePicker
              picker="month"
              placeholder="選擇月份"
              style={{ width: '100%' }}
              onChange={(_, dateStr) => setPdfYearMonth(dateStr || '')}
            />
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadPdf}
              loading={pdfLoading}
              disabled={!pdfCustomerId || !pdfYearMonth}
              block
            >
              下載 PDF
            </Button>
          </Space>
        </Card>

        {/* 站區 Excel 報表 */}
        <Card
          title={<><FileExcelOutlined /> 站區彙總 Excel</>}
          style={{ flex: 1, minWidth: isMobile ? '100%' : 340 }}
        >
          <p style={{ color: '#666', marginBottom: 16 }}>
            產出指定站區的月結彙總 Excel 報表，包含站區下所有客戶的收運統計。
          </p>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              placeholder="請選擇站區"
              style={{ width: '100%' }}
              options={siteOptions}
              onChange={setExcelSiteId}
            />
            <DatePicker
              picker="month"
              placeholder="選擇月份"
              style={{ width: '100%' }}
              onChange={(_, dateStr) => setExcelYearMonth(dateStr || '')}
            />
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadExcel}
              loading={excelLoading}
              disabled={!excelSiteId || !excelYearMonth}
              block
            >
              下載 Excel
            </Button>
          </Space>
        </Card>
      </Space>
    </div>
  )
}

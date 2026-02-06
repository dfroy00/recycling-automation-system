import { useState } from 'react'
import { Card, Upload, Select, Space, Typography, Alert, Table, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const { Title } = Typography
const { Dragger } = Upload

interface ImportResult {
  total: number
  imported: number
  errors?: { row: number; messages: string[] }[]
}

interface SiteItem {
  siteId: string
  siteName: string
}

export default function DataImportPage() {
  const [siteId, setSiteId] = useState<string>('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  })
  const sites: SiteItem[] = Array.isArray(sitesData) ? sitesData : sitesData?.data || []

  const uploadProps = (type: 'trips' | 'items') => ({
    name: 'file',
    action: `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/import/${type}`,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    data: { siteId },
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: () => {
      if (!siteId) {
        message.warning('請先選擇站點')
        return false
      }
      return true
    },
    onChange: (info: { file: { status?: string; response?: ImportResult } }) => {
      if (info.file.status === 'done') {
        setImportResult(info.file.response || null)
        message.success(`匯入完成：${info.file.response?.imported}/${info.file.response?.total} 筆成功`)
      } else if (info.file.status === 'error') {
        message.error('匯入失敗')
      }
    },
  })

  const errorColumns = [
    { title: '行號', dataIndex: 'row', key: 'row', width: 80 },
    { title: '錯誤訊息', dataIndex: 'messages', key: 'messages', render: (msgs: string[]) => msgs.join('; ') },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={4}>手動匯入</Title>

      <Select placeholder="選擇站點" style={{ width: 300 }} value={siteId || undefined} onChange={setSiteId}>
        {sites.map(s => <Select.Option key={s.siteId} value={s.siteId}>{s.siteName}</Select.Option>)}
      </Select>

      <div style={{ display: 'flex', gap: 24 }}>
        <Card title="車趟資料匯入" style={{ flex: 1 }}>
          <Dragger {...uploadProps('trips')}>
            <p><InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} /></p>
            <p>點擊或拖曳車機 Excel 檔案</p>
            <p style={{ color: '#999' }}>支援 .xlsx / .xls 格式</p>
          </Dragger>
        </Card>

        <Card title="品項資料匯入" style={{ flex: 1 }}>
          <Dragger {...uploadProps('items')}>
            <p><InboxOutlined style={{ fontSize: 48, color: '#52c41a' }} /></p>
            <p>點擊或拖曳 ERP 品項 Excel 檔案</p>
            <p style={{ color: '#999' }}>支援 .xlsx / .xls 格式</p>
          </Dragger>
        </Card>
      </div>

      {importResult && (
        <Card title="匯入結果">
          <Alert
            type={(importResult.errors?.length || 0) > 0 ? 'warning' : 'success'}
            message={`共 ${importResult.total} 筆，成功 ${importResult.imported} 筆，失敗 ${importResult.errors?.length || 0} 筆`}
            style={{ marginBottom: 16 }}
          />
          {(importResult.errors?.length || 0) > 0 && (
            <Table columns={errorColumns} dataSource={importResult.errors} rowKey="row" size="small" pagination={false} />
          )}
        </Card>
      )}
    </Space>
  )
}

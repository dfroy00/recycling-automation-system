import { useState } from 'react'
import {
  Table, Card, Button, Typography, Tag, Space, Descriptions,
} from 'antd'
import {
  PlayCircleOutlined, ReloadOutlined, WarningOutlined, SendOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useScheduleJobs, useTriggerJob, useStatements, useSendStatement,
} from '../api/hooks'
import { useResponsive } from '../hooks/useResponsive'
import type { ScheduleJob, Statement } from '../types'

const { Title, Text } = Typography

// 排程狀態顏色
const jobStatusColorMap: Record<string, string> = {
  active: 'green',
  paused: 'orange',
  error: 'red',
}
const jobStatusLabelMap: Record<string, string> = {
  active: '運行中',
  paused: '暫停',
  error: '異常',
}

export default function SchedulePage() {
  const { isMobile } = useResponsive()
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useScheduleJobs()
  const triggerJob = useTriggerJob()

  // 寄送失敗的明細（send_retry_count >= 3）
  const { data: failedStatements, isLoading: failedLoading } = useStatements({
    pageSize: 50,
    status: 'sent',
  })
  const sendStatement = useSendStatement()

  // 篩選出寄送重試次數 >= 3 的明細
  const failedSendStatements = (failedStatements?.data ?? []).filter(s => s.sendRetryCount >= 3)

  const jobColumns = [
    {
      title: '排程名稱',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '說明',
      dataIndex: 'description',
      key: 'description',
      responsive: ['md' as const],
    },
    {
      title: '排程',
      dataIndex: 'cron',
      key: 'cron',
      responsive: ['lg' as const],
    },
    {
      title: '上次執行',
      dataIndex: 'lastRun',
      key: 'lastRun',
      responsive: ['md' as const],
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '下次執行',
      dataIndex: 'nextRun',
      key: 'nextRun',
      responsive: ['lg' as const],
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={jobStatusColorMap[v] ?? 'default'}>
          {jobStatusLabelMap[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ScheduleJob) => (
        <Button
          type="link"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={() => triggerJob.mutate(record.name)}
          loading={triggerJob.isPending}
        >
          手動觸發
        </Button>
      ),
    },
  ]

  const failedColumns = [
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
      title: '重試次數',
      dataIndex: 'sendRetryCount',
      key: 'sendRetryCount',
      width: 100,
      render: (v: number) => <Tag color="red">{v} 次</Tag>,
    },
    {
      title: '錯誤訊息',
      dataIndex: 'sendError',
      key: 'sendError',
      responsive: ['md' as const],
      render: (v: string | null) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Statement) => (
        <Button
          type="link"
          size="small"
          icon={<SendOutlined />}
          onClick={() => sendStatement.mutate(record.id)}
          loading={sendStatement.isPending}
        >
          重新寄送
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>排程管理</Title>
        <Button icon={<ReloadOutlined />} onClick={() => refetchJobs()}>
          重新整理
        </Button>
      </div>

      {/* 排程狀態 */}
      <Card title="排程列表" style={{ marginBottom: 16 }}>
        <Table
          columns={jobColumns}
          dataSource={jobs ?? []}
          rowKey="name"
          loading={jobsLoading}
          pagination={false}
          scroll={isMobile ? { x: 600 } : undefined}
        />
      </Card>

      {/* 寄送失敗紀錄 */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            <span>寄送失敗紀錄（重試 3 次以上）</span>
            {failedSendStatements.length > 0 && (
              <Tag color="red">{failedSendStatements.length} 筆</Tag>
            )}
          </Space>
        }
      >
        {failedSendStatements.length === 0 ? (
          <Text type="secondary">目前無寄送失敗的明細。</Text>
        ) : (
          <Table
            columns={failedColumns}
            dataSource={failedSendStatements}
            rowKey="id"
            loading={failedLoading}
            pagination={false}
            scroll={isMobile ? { x: 500 } : undefined}
          />
        )}
      </Card>
    </div>
  )
}

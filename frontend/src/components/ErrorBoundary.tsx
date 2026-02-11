// 全域錯誤邊界元件
import { Component, ReactNode } from 'react'
import { Result, Button } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Result
            status="error"
            title="系統發生錯誤"
            subTitle="請嘗試重新整理頁面，若問題持續請聯絡系統管理員。"
            extra={[
              <Button type="primary" key="retry" onClick={this.handleRetry}>
                重試
              </Button>,
              <Button key="reload" onClick={() => window.location.reload()}>
                重新整理頁面
              </Button>,
            ]}
          />
        </div>
      )
    }

    return this.props.children
  }
}

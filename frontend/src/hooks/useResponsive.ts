import { Grid } from 'antd'

const { useBreakpoint } = Grid

// 響應式斷點 Hook
// isMobile: < 768px（手機）
// isTablet: 768 ~ 991px（平板）
// isDesktop: >= 992px（桌面）
export function useResponsive() {
  const screens = useBreakpoint()
  return {
    isMobile: !screens.md,          // < 768px
    isTablet: !!screens.md && !screens.lg,  // 768 ~ 991px
    isDesktop: !!screens.lg,        // >= 992px
  }
}

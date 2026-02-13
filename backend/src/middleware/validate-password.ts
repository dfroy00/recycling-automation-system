// backend/src/middleware/validate-password.ts
// 密碼策略驗證

// 密碼規則：最少 8 字元，至少包含 1 個數字
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密碼至少需要 8 個字元' }
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: '密碼至少需要包含 1 個數字' }
  }
  return { valid: true }
}

import { describe, expect, test } from '@jest/globals'
import { sel } from '@/core/lib/selectors'

describe('auth readiness selectors', () => {
  test.each([
    ['auth.login.readinessLoading', 'login-readiness-loading'],
    ['auth.login.readinessError', 'login-readiness-error'],
    ['auth.login.noMethods', 'login-no-methods'],
    ['auth.signup.readinessLoading', 'signup-readiness-loading'],
    ['auth.signup.readinessError', 'signup-readiness-error'],
    ['auth.signup.noMethods', 'signup-no-methods'],
    ['auth.forgotPassword.readinessLoading', 'forgot-password-readiness-loading'],
    ['auth.forgotPassword.readinessError', 'forgot-password-readiness-error'],
    ['auth.forgotPassword.unavailable', 'forgot-password-unavailable'],
  ])('resolves %s through the real selector registry', (path, expected) => {
    expect(sel(path)).toBe(expected)
  })
})

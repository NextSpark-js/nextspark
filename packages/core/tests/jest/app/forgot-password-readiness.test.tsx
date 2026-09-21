/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { render } from '@testing-library/react'

const readiness: {
  state: 'loading' | 'ready' | 'unavailable' | 'error'
  availableMethods: string[]
  capabilities: { invitationPasswordSignup: boolean; passwordRecovery: boolean }
} = {
  state: 'loading',
  availableMethods: [],
  capabilities: { invitationPasswordSignup: false, passwordRecovery: false },
}

jest.mock('@nextsparkjs/core/hooks/useAuthReadiness', () => ({ useAuthReadiness: () => readiness }))
jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({
  useAuthActions: () => ({ resetPassword: jest.fn() }),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))
jest.mock('@nextsparkjs/core/selectors', () => ({ sel: (path: string) => path }))

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'

const byCy = (path: string) => document.querySelector(`[data-cy="${path}"]`) as HTMLElement | null

describe('forgot password runtime readiness', () => {
  beforeEach(() => {
    readiness.state = 'loading'
    readiness.availableMethods = []
    readiness.capabilities = { invitationPasswordSignup: false, passwordRecovery: false }
  })

  test('does not offer the reset form before runtime readiness resolves', () => {
    render(<ForgotPasswordPage />)

    expect(byCy('auth.forgotPassword.readinessLoading')).toBeInTheDocument()
    expect(byCy('auth.forgotPassword.submitButton')).not.toBeInTheDocument()
  })

  test('does not offer password reset when the server reports no recovery capability', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['google']
    readiness.capabilities = { invitationPasswordSignup: true, passwordRecovery: false }
    render(<ForgotPasswordPage />)

    expect(byCy('auth.forgotPassword.unavailable')).toBeInTheDocument()
    expect(byCy('auth.forgotPassword.submitButton')).not.toBeInTheDocument()
  })

  test('renders the reset form under the passwordless preset when backend and email support recovery', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-otp', 'google']
    readiness.capabilities = { invitationPasswordSignup: true, passwordRecovery: true }
    render(<ForgotPasswordPage />)

    expect(byCy('auth.forgotPassword.submitButton')).toBeInTheDocument()
  })

  test('does not infer recovery from email-password in the login methods', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-password']
    readiness.capabilities = { invitationPasswordSignup: false, passwordRecovery: false }
    render(<ForgotPasswordPage />)

    expect(byCy('auth.forgotPassword.unavailable')).toBeInTheDocument()
    expect(byCy('auth.forgotPassword.submitButton')).not.toBeInTheDocument()
  })

  test('fails closed on a readiness error', () => {
    readiness.state = 'error'
    readiness.capabilities = { invitationPasswordSignup: true, passwordRecovery: true }
    render(<ForgotPasswordPage />)

    expect(byCy('auth.forgotPassword.readinessError')).toBeInTheDocument()
    expect(byCy('auth.forgotPassword.submitButton')).not.toBeInTheDocument()
  })
})

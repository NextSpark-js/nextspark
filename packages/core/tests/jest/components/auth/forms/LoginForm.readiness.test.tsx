/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { render } from '@testing-library/react'

const readiness: { state: 'loading' | 'ready' | 'unavailable' | 'error'; availableMethods: string[] } = {
  state: 'loading',
  availableMethods: [],
}

jest.mock('@/core/hooks/useAuthReadiness', () => ({ useAuthReadiness: () => readiness }))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuthActions: () => ({ signIn: jest.fn(), googleSignIn: jest.fn(), sendOtp: jest.fn(), signInWithOtp: jest.fn() }),
}))
jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => ({ lastMethod: null, isReady: true }),
}))
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, options?: Record<string, unknown>) =>
    typeof options?.defaultValue === 'string' ? options.defaultValue : key,
}))
jest.mock('@/core/lib/i18n/AuthTranslationPreloader', () => ({ AuthTranslationPreloader: () => null }))
jest.mock('@/core/components/auth/DevKeyring', () => ({ DevKeyring: () => <div data-testid="dev-keyring" /> }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path }))
jest.mock('@/core/lib/config/config-sync', () => ({
  PUBLIC_AUTH_CONFIG: {
    registration: { mode: 'open' },
    providers: { google: { enabled: true } },
    methods: ['email-otp', 'google'],
    otp: { expiresIn: 300, otpLength: 6 },
  },
  DEV_CONFIG: undefined,
}))

import { LoginForm } from '@/core/components/auth/forms/LoginForm'

const byCy = (path: string) => document.querySelector(`[data-cy="${path}"]`) as HTMLElement | null

describe('LoginForm runtime readiness states', () => {
  beforeEach(() => {
    readiness.state = 'loading'
    readiness.availableMethods = []
  })

  test('shows a loading state without auth buttons while methods are checked', () => {
    render(<LoginForm />)

    expect(byCy('auth.login.readinessLoading')).toBeInTheDocument()
    expect(byCy('auth.login.googleSignin')).not.toBeInTheDocument()
    expect(byCy('auth.login.otpForm')).not.toBeInTheDocument()
  })

  test('shows a retryable error state without broken auth buttons', () => {
    readiness.state = 'error'
    render(<LoginForm />)

    expect(byCy('auth.login.readinessError')).toBeInTheDocument()
    expect(byCy('auth.login.googleSignin')).not.toBeInTheDocument()
    expect(byCy('auth.login.showEmail')).not.toBeInTheDocument()
  })

  test('shows a no-method state when the server reports none available', () => {
    readiness.state = 'unavailable'
    render(<LoginForm />)

    expect(byCy('auth.login.noMethods')).toBeInTheDocument()
    expect(byCy('auth.login.googleSignin')).not.toBeInTheDocument()
    expect(byCy('auth.login.otpForm')).not.toBeInTheDocument()
  })

  test('renders only server-validated methods for a mixed valid/invalid setup', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['google']
    render(<LoginForm />)

    expect(byCy('auth.login.googleSignin')).toBeInTheDocument()
    expect(byCy('auth.login.showEmail')).not.toBeInTheDocument()
    expect(byCy('auth.login.otpForm')).not.toBeInTheDocument()
  })
})

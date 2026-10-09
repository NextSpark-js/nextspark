/**
 * @jest-environment jsdom
 *
 * A registration-policy code from the auth API (DOMAIN_NOT_ALLOWED: a sign-in
 * from a domain outside allowedDomains) shows its own translated message on
 * the login form and on the auth error page, not a generic error.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { render, fireEvent, waitFor } from '@testing-library/react'

const mockSignIn = jest.fn<(...args: any[]) => Promise<any>>()
const mockGoogleSignIn = jest.fn<(...args: any[]) => Promise<any>>()
const mockSendOtp = jest.fn<(...args: any[]) => Promise<any>>()
const mockSignInWithOtp = jest.fn<(...args: any[]) => Promise<any>>()

const mockAuthHook = () => ({
    signIn: mockSignIn,
    googleSignIn: mockGoogleSignIn,
    sendOtp: mockSendOtp,
    signInWithOtp: mockSignInWithOtp,
    user: null,
    session: null,
    isLoading: false,
  })

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => mockAuthHook(),
  useAuthActions: () => mockAuthHook(),
}))

jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => ({ lastMethod: null, saveAuthMethod: jest.fn(), clearAuthMethod: jest.fn(), isReady: true }),
}))

jest.mock('@/core/hooks/useAuthReadiness', () => ({
  useAuthReadiness: () => ({ state: 'ready', availableMethods: mockConfig.PUBLIC_AUTH_CONFIG.methods }),
}))

const mockSearch = { value: '' }
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch.value),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, options?: Record<string, unknown>) => {
    if (options && typeof options.defaultValue === 'string' && !key.startsWith('login.form')) return options.defaultValue
    if (options && typeof options.email === 'string') return `${key}:${options.email}`
    if (options && typeof options.time === 'string') return `${key}:${options.time}`
    return key
  },
}))

jest.mock('@/core/lib/i18n/AuthTranslationPreloader', () => ({
  AuthTranslationPreloader: () => null,
}))

jest.mock('@/core/components/auth/DevKeyring', () => ({
  DevKeyring: ({ config }: { config: { enabled: boolean } }) =>
    config.enabled ? <div data-testid="dev-keyring" /> : null,
}))

// Selector helper: pass the path through so assertions can target data-cy by path
jest.mock('@/core/lib/selectors/auth-sel', () => ({
  sel: (path: string) => path,
}))

// Mutable auth config — each test sets the preset it needs before rendering
const mockConfig: { PUBLIC_AUTH_CONFIG: any; DEV_KEYRING_CONFIG: any } = {
  PUBLIC_AUTH_CONFIG: {
    registration: { mode: 'open' },
    providers: { google: { enabled: true } },
    methods: ['email-otp', 'google'],
    otp: { expiresIn: 300, otpLength: 6 },
  },
  DEV_KEYRING_CONFIG: undefined,
}
jest.mock('@/core/lib/config/public-config-client', () => ({
  get PUBLIC_AUTH_CONFIG() {
    return mockConfig.PUBLIC_AUTH_CONFIG
  },
}))
jest.mock('@nextsparkjs/registries/dev-keyring.client', () => ({
  get DEV_KEYRING_CONFIG() {
    return mockConfig.DEV_KEYRING_CONFIG
  },
}))

const nodeEnvBeforeLoginFormImport = process.env.NODE_ENV
process.env.NODE_ENV = 'development'
const { LoginForm } = require('@/core/components/auth/forms/LoginForm')
const { AuthErrorPage } = require('@/core/components/auth/pages/AuthErrorPage')
process.env.NODE_ENV = nodeEnvBeforeLoginFormImport

const byCy = (path: string) => document.querySelector(`[data-cy="${path}"]`) as HTMLElement | null
const authError = (code?: string) =>
  Object.assign(new Error("This email's domain can't sign in here. Use your organization's email."), { code })

async function requestCode(email: string) {
  render(<LoginForm />)
  fireEvent.click(byCy('auth.login.showEmail')!)
  fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: email } })
  fireEvent.click(byCy('auth.login.otpSend')!)
}

describe('LoginForm — registration-policy codes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSendOtp.mockResolvedValue({ success: true })
  })

  test('sending a code: DOMAIN_NOT_ALLOWED shows the translated domain message', async () => {
    mockSendOtp.mockRejectedValue(authError('DOMAIN_NOT_ALLOWED'))
    await requestCode('someone@other.example')

    await waitFor(() => expect(byCy('auth.login.errorAlert')).toHaveTextContent('registrationErrors.domainNotAllowed'))
    expect(byCy('auth.login.otpCodeInput')).not.toBeInTheDocument()
  })

  test('verifying a code: DOMAIN_NOT_ALLOWED shows the translated domain message', async () => {
    mockSignInWithOtp.mockRejectedValue(authError('DOMAIN_NOT_ALLOWED'))
    await requestCode('someone@other.example')
    await waitFor(() => expect(byCy('auth.login.otpCodeInput')).toBeInTheDocument())
    fireEvent.change(byCy('auth.login.otpCodeInput')!, { target: { value: '123456' } })
    fireEvent.click(byCy('auth.login.otpSubmit')!)

    await waitFor(() => expect(byCy('auth.login.errorAlert')).toHaveTextContent('registrationErrors.domainNotAllowed'))
  })

  test('SIGNUP_RESTRICTED has its own message too', async () => {
    mockSendOtp.mockRejectedValue(authError('SIGNUP_RESTRICTED'))
    await requestCode('someone@other.example')

    await waitFor(() => expect(byCy('auth.login.errorAlert')).toHaveTextContent('registrationErrors.signupRestricted'))
  })

  test('an error without a code keeps the existing handling', async () => {
    mockSignInWithOtp.mockRejectedValue(new Error('Invalid OTP'))
    await requestCode('someone@nextspark.dev')
    await waitFor(() => expect(byCy('auth.login.otpCodeInput')).toBeInTheDocument())
    fireEvent.change(byCy('auth.login.otpCodeInput')!, { target: { value: '123456' } })
    fireEvent.click(byCy('auth.login.otpSubmit')!)

    // The translator stub answers t(key, { defaultValue }) with the default value
    await waitFor(() => expect(byCy('auth.login.errorAlert')).toHaveTextContent('Invalid OTP'))
    expect(byCy('auth.login.errorAlert')).not.toHaveTextContent('registrationErrors')
  })
})

describe('AuthErrorPage — OAuth redirect with ?error=DOMAIN_NOT_ALLOWED', () => {
  test('shows the domain message instead of the generic one', () => {
    mockSearch.value = 'error=DOMAIN_NOT_ALLOWED'
    render(<AuthErrorPage />)
    expect(byCy('auth-error-title')).toHaveTextContent('unable_to_create.title')
    expect(byCy('auth-error-page')).toHaveTextContent('registrationErrors.domainNotAllowed')
  })

  test('an unknown error stays generic', () => {
    mockSearch.value = 'error=something_else'
    render(<AuthErrorPage />)
    expect(byCy('auth-error-title')).toHaveTextContent('generic.title')
    expect(byCy('auth-error-page')).toHaveTextContent('generic.description')
  })
})

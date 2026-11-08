/**
 * @jest-environment jsdom
 *
 * The login form with the sign-in link method: it is offered only when readiness lists it, opens first when it is the
 * first email method, sends the link and says so without telling whether the address has an account.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { render, fireEvent, waitFor } from '@testing-library/react'

const mockSendMagicLink = jest.fn<(...args: any[]) => Promise<any>>()
let mockMethods: string[] = ['magic-link']
let mockQuery = ''

const mockActions = () => ({ signIn: jest.fn(), googleSignIn: jest.fn(), socialSignIn: jest.fn(), sendOtp: jest.fn(), signInWithOtp: jest.fn(), sendMagicLink: mockSendMagicLink })

jest.mock('@/core/hooks/useAuth', () => ({ useAuthActions: () => mockActions() }))
jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => ({ lastMethod: null, saveAuthMethod: jest.fn(), clearAuthMethod: jest.fn(), isReady: true }),
}))
jest.mock('@/core/hooks/useAuthReadiness', () => ({
  useAuthReadiness: () => ({ state: 'ready', availableMethods: mockMethods }),
}))
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, options?: Record<string, unknown>) => (typeof options?.email === 'string' ? `${key}:${options.email}` : key),
}))
jest.mock('@/core/lib/i18n/AuthTranslationPreloader', () => ({ AuthTranslationPreloader: () => null }))
jest.mock('@/core/lib/selectors/auth-sel', () => ({ sel: (path: string) => path }))
jest.mock('@/core/lib/config/public-config-client', () => ({
  PUBLIC_AUTH_CONFIG: { registration: { mode: 'open' }, providers: { google: { enabled: false } }, methods: [], otp: { expiresIn: 300, otpLength: 6 } },
}))
jest.mock('@nextsparkjs/registries/dev-keyring.client', () => ({ DEV_KEYRING_CONFIG: undefined }))

const { LoginForm } = require('@/core/components/auth/forms/LoginForm')

const byCy = (path: string) => document.querySelector(`[data-cy="${path}"]`) as HTMLElement | null
const typeEmail = (value: string) => fireEvent.change(byCy('auth.login.magicLinkEmailInput')!, { target: { value } })

describe('LoginForm with sign-in links', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMethods = ['magic-link']
    mockQuery = ''
    mockSendMagicLink.mockResolvedValue({ status: true })
  })

  test('the link form opens when it is the first email method', () => {
    mockMethods = ['magic-link', 'email-otp']
    render(<LoginForm />)
    expect(byCy('auth.login.magicLinkForm')).toBeInTheDocument()
    expect(byCy('auth.login.otpForm')).not.toBeInTheDocument()
    expect(byCy('auth.login.useOtp')).toBeInTheDocument()
  })

  test('next to a code it is offered as the other way, and back', () => {
    mockMethods = ['email-otp', 'magic-link']
    render(<LoginForm />)
    expect(byCy('auth.login.otpForm')).toBeInTheDocument()
    fireEvent.click(byCy('auth.login.useMagicLink')!)
    expect(byCy('auth.login.magicLinkForm')).toBeInTheDocument()
    expect(byCy('auth.login.otpForm')).not.toBeInTheDocument()
    fireEvent.click(byCy('auth.login.useOtp')!)
    expect(byCy('auth.login.otpForm')).toBeInTheDocument()
  })

  test('it is not offered when readiness does not list it', () => {
    mockMethods = ['email-otp']
    render(<LoginForm />)
    expect(byCy('auth.login.useMagicLink')).not.toBeInTheDocument()
    expect(byCy('auth.login.magicLinkForm')).not.toBeInTheDocument()
  })

  test('an invalid address sends nothing', () => {
    render(<LoginForm />)
    typeEmail('not-an-email')
    fireEvent.submit(byCy('auth.login.magicLinkForm')!)
    expect(byCy('auth.login.magicLinkEmailError')).toBeInTheDocument()
    expect(mockSendMagicLink).not.toHaveBeenCalled()
  })

  test('sends the link with the safe destination, and the notice replaces the input', async () => {
    mockQuery = 'callbackUrl=%2Freports'
    render(<LoginForm />)
    typeEmail(' ada@example.test ')
    fireEvent.submit(byCy('auth.login.magicLinkForm')!)

    await waitFor(() => expect(byCy('auth.login.magicLinkSentNotice')).toBeInTheDocument())
    expect(mockSendMagicLink).toHaveBeenCalledWith('ada@example.test', '/reports')
    expect(byCy('auth.login.magicLinkSentNotice')).toHaveTextContent('login.form.magicLink.linkSent:ada@example.test')
    expect(byCy('auth.login.magicLinkEmailInput')).not.toBeInTheDocument()

    fireEvent.click(byCy('auth.login.magicLinkResend')!)
    await waitFor(() => expect(mockSendMagicLink).toHaveBeenCalledTimes(2))

    fireEvent.click(byCy('auth.login.magicLinkChangeEmail')!)
    expect(byCy('auth.login.magicLinkEmailInput')).toBeInTheDocument()
  })

  test('a destination on another site is not passed on', async () => {
    mockQuery = 'callbackUrl=https%3A%2F%2Fevil.example%2F'
    render(<LoginForm />)
    typeEmail('ada@example.test')
    fireEvent.submit(byCy('auth.login.magicLinkForm')!)
    await waitFor(() => expect(mockSendMagicLink).toHaveBeenCalledWith('ada@example.test', undefined))
  })

  test('a refused or failed send shows the error and no notice', async () => {
    mockSendMagicLink.mockRejectedValue(Object.assign(new Error('nope'), { code: 'DOMAIN_NOT_ALLOWED' }))
    render(<LoginForm />)
    typeEmail('ada@elsewhere.test')
    fireEvent.submit(byCy('auth.login.magicLinkForm')!)
    await waitFor(() => expect(byCy('auth.login.errorAlert')).toHaveTextContent('registrationErrors.domainNotAllowed'))
    expect(byCy('auth.login.magicLinkSentNotice')).not.toBeInTheDocument()
  })
})

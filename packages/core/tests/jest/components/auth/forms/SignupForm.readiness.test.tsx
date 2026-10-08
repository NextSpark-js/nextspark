/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { fireEvent, render, waitFor } from '@testing-library/react'

const readiness: {
  state: 'loading' | 'ready' | 'unavailable' | 'error'
  availableMethods: string[]
  capabilities: { invitationSignup: boolean; invitationPasswordSignup: boolean; passwordRecovery: boolean }
} = {
  state: 'loading',
  availableMethods: [],
  capabilities: { invitationSignup: false, invitationPasswordSignup: false, passwordRecovery: false },
}
const mockSearch = { value: '' }
const mockPush = jest.fn()

jest.mock('@/core/hooks/useAuthReadiness', () => ({ useAuthReadiness: () => readiness }))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuthActions: () => ({ signUp: jest.fn(), googleSignIn: jest.fn(), resendVerificationEmail: jest.fn() }),
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearch.value),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, options?: Record<string, unknown>) =>
    typeof options?.defaultValue === 'string' ? options.defaultValue : key,
}))
jest.mock('@/core/lib/i18n/AuthTranslationPreloader', () => ({ AuthTranslationPreloader: () => null }))
jest.mock('@/core/lib/selectors/auth-sel', () => ({ sel: (path: string) => path }))
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }))

import { SignupForm } from '@/core/components/auth/forms/SignupForm'

const byCy = (path: string) => document.querySelector(`[data-cy="${path}"]`) as HTMLElement | null

describe('SignupForm runtime readiness', () => {
  beforeEach(() => {
    readiness.state = 'loading'
    readiness.availableMethods = []
    readiness.capabilities = { invitationSignup: false, invitationPasswordSignup: false, passwordRecovery: false }
    mockSearch.value = ''
    mockPush.mockClear()
  })

  test('does not offer signup actions while readiness is loading', () => {
    render(<SignupForm />)

    expect(byCy('auth.signup.readinessLoading')).toBeInTheDocument()
    expect(byCy('auth.signup.submitButton')).not.toBeInTheDocument()
    expect(byCy('auth.signup.googleButton')).not.toBeInTheDocument()
  })

  test('offers only Google when email/password is unavailable', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['google']
    render(<SignupForm />)

    expect(byCy('auth.signup.googleButton')).toBeInTheDocument()
    expect(byCy('auth.signup.submitButton')).not.toBeInTheDocument()
  })

  test('shows no methods without broken controls', () => {
    readiness.state = 'unavailable'
    render(<SignupForm />)

    expect(byCy('auth.signup.noMethods')).toBeInTheDocument()
    expect(byCy('auth.signup.submitButton')).not.toBeInTheDocument()
    expect(byCy('auth.signup.googleButton')).not.toBeInTheDocument()
  })

  test('ready with email OTP only explains the OTP path instead of rendering an empty card', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-otp']
    readiness.capabilities = { invitationSignup: true, invitationPasswordSignup: true, passwordRecovery: true }
    render(<SignupForm />)

    expect(byCy('auth.signup.otpOnly')).toHaveTextContent('signup.otpOnly.message')
    const link = byCy('auth.signup.otpLoginLink')
    expect(link).toHaveAttribute('href', '/login')
    expect(link).toHaveTextContent('signup.otpOnly.loginLink')
    expect(byCy('auth.signup.submitButton')).not.toBeInTheDocument()
    expect(byCy('auth.signup.googleButton')).not.toBeInTheDocument()
  })

  test('the OTP link keeps a safe callbackUrl and drops an external one', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-otp']
    mockSearch.value = 'callbackUrl=%2Fdashboard%3Ftab%3D1'
    const { unmount } = render(<SignupForm />)
    expect(byCy('auth.signup.otpLoginLink')).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fdashboard%3Ftab%3D1',
    )
    unmount()

    mockSearch.value = 'callbackUrl=https%3A%2F%2Fevil.example'
    render(<SignupForm />)
    expect(byCy('auth.signup.otpLoginLink')).toHaveAttribute('href', '/login')
  })

  test('invitation registration stays usable under the passwordless preset when the backend is enabled', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-otp', 'google']
    readiness.capabilities = { invitationSignup: true, invitationPasswordSignup: true, passwordRecovery: false }
    mockSearch.value = 'inviteToken=tok-123&fromInvite=true&email=invitee%40example.com'
    render(<SignupForm />)

    expect(byCy('auth.signup.submitButton')).toBeInTheDocument()
    expect(byCy('auth.signup.email')).toHaveValue('invitee@example.com')
    expect(byCy('auth.signup.inviteUnavailable')).not.toBeInTheDocument()
    expect(byCy('auth.signup.otpOnly')).not.toBeInTheDocument()
  })

  test('invitation registration does not depend on login methods being ready', () => {
    readiness.state = 'unavailable'
    readiness.availableMethods = []
    readiness.capabilities = { invitationSignup: true, invitationPasswordSignup: true, passwordRecovery: false }
    mockSearch.value = 'inviteToken=tok-123'
    render(<SignupForm />)

    expect(byCy('auth.signup.submitButton')).toBeInTheDocument()
    expect(byCy('auth.signup.noMethods')).not.toBeInTheDocument()
  })

  test('with the password backend off an invitation shows the form without a password field', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-password', 'email-otp']
    readiness.capabilities = { invitationSignup: true, invitationPasswordSignup: false, passwordRecovery: false }
    mockSearch.value = 'inviteToken=tok-123'
    render(<SignupForm />)

    expect(byCy('auth.signup.submitButton')).toBeInTheDocument()
    expect(byCy('auth.signup.email')).toBeInTheDocument()
    expect(byCy('auth.signup.password')).not.toBeInTheDocument()
    expect(byCy('auth.signup.confirmPassword')).not.toBeInTheDocument()
    expect(byCy('auth.signup.inviteUnavailable')).not.toBeInTheDocument()
  })

  test('a server without invitation signup keeps the invitation closed when passwords are off', () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-otp']
    readiness.capabilities = { invitationSignup: false, invitationPasswordSignup: false, passwordRecovery: false }
    mockSearch.value = 'inviteToken=tok-123'
    render(<SignupForm />)

    expect(byCy('auth.signup.inviteUnavailable')).toHaveTextContent('signup.inviteUnavailable')
    expect(byCy('auth.signup.submitButton')).not.toBeInTheDocument()
  })

  test('a password-less invitation sends no password and then opens the code login with the email', async () => {
    readiness.state = 'ready'
    readiness.availableMethods = ['email-otp', 'google']
    readiness.capabilities = { invitationSignup: true, invitationPasswordSignup: false, passwordRecovery: false }
    mockSearch.value = 'inviteToken=tok-123&fromInvite=true&email=invitee%40example.com'
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ data: { redirectTo: '/dashboard/settings/teams' } }), { status: 201 }))
    global.fetch = fetchMock as unknown as typeof fetch
    render(<SignupForm />)

    fireEvent.change(byCy('auth.signup.firstName')!, { target: { value: 'Ana' } })
    fireEvent.change(byCy('auth.signup.lastName')!, { target: { value: 'Diaz' } })
    fireEvent.click(byCy('auth.signup.termsCheckbox')!)
    fireEvent.click(byCy('auth.signup.submitButton')!)

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/auth/signup-with-invite')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ email: 'invitee@example.com', firstName: 'Ana', lastName: 'Diaz', inviteToken: 'tok-123' })
    expect(body).not.toHaveProperty('password')
    const target = new URL(mockPush.mock.calls[0][0] as string, 'https://x.test')
    expect(target.pathname).toBe('/login')
    expect(Object.fromEntries(target.searchParams)).toEqual({
      email: 'invitee@example.com',
      fromInvite: 'true',
      callbackUrl: '/dashboard/settings/teams',
    })
  })

  test('an invitation with no capability and no method stays closed', () => {
    readiness.state = 'unavailable'
    readiness.availableMethods = []
    mockSearch.value = 'inviteToken=tok-123'
    render(<SignupForm />)

    expect(byCy('auth.signup.noMethods')).toBeInTheDocument()
    expect(byCy('auth.signup.submitButton')).not.toBeInTheDocument()
  })

  test.each(['loading', 'error'] as const)('an invitation fails closed while readiness is %s', (state) => {
    readiness.state = state
    readiness.capabilities = { invitationSignup: true, invitationPasswordSignup: true, passwordRecovery: true }
    mockSearch.value = 'inviteToken=tok-123'
    render(<SignupForm />)

    expect(byCy(state === 'loading' ? 'auth.signup.readinessLoading' : 'auth.signup.readinessError')).toBeInTheDocument()
    expect(byCy('auth.signup.submitButton')).not.toBeInTheDocument()
  })
})

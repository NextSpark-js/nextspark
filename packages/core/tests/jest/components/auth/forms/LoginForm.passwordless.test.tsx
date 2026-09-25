/**
 * @jest-environment jsdom
 *
 * LoginForm under the passwordless preset (#126): Google + email one-time code,
 * zero password field — and the classic form when a theme opts into
 * 'email-password'. Uses fireEvent only (no user-event dependency).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

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

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
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
jest.mock('@/core/lib/test', () => ({
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
jest.mock('@/core/lib/config/config-client', () => ({
  get PUBLIC_AUTH_CONFIG() {
    return mockConfig.PUBLIC_AUTH_CONFIG
  },
}))
jest.mock('@nextsparkjs/registries/dev-keyring.client', () => ({
  get DEV_KEYRING_CONFIG() {
    return mockConfig.DEV_KEYRING_CONFIG
  },
}))

// The production build must erase the guarded DevKeyring requires. Load this
// test module under development explicitly so its quick-login behavior remains
// covered even when the parent Jest process sets NODE_ENV=production.
const nodeEnvBeforeLoginFormImport = process.env.NODE_ENV
process.env.NODE_ENV = 'development'
const { LoginForm } = require('@/core/components/auth/forms/LoginForm')
process.env.NODE_ENV = nodeEnvBeforeLoginFormImport

const byCy = (path: string) => document.querySelector(`[data-cy="${path}"]`) as HTMLElement | null

function setPreset(methods: string[], extra: Partial<typeof mockConfig.PUBLIC_AUTH_CONFIG> = {}) {
  mockConfig.PUBLIC_AUTH_CONFIG = {
    registration: { mode: 'open' },
    providers: { google: { enabled: methods.includes('google') } },
    methods,
    otp: { expiresIn: 300, otpLength: 6 },
    ...extra,
  }
}

describe('LoginForm — passwordless preset (default: email OTP + Google)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConfig.DEV_KEYRING_CONFIG = undefined
    setPreset(['email-otp', 'google'])
    mockSendOtp.mockResolvedValue({ success: true })
    mockSignInWithOtp.mockResolvedValue({ token: 't', user: { id: 'u1' } })
  })

  test('renders Google + "Sign in with Email" and never a password field', () => {
    render(<LoginForm />)

    expect(byCy('auth.login.googleSignin')).toBeInTheDocument()
    expect(byCy('auth.login.showEmail')).toBeInTheDocument()
    expect(byCy('auth.login.passwordInput')).not.toBeInTheDocument()
    // No signup link: the first OTP sign-in creates the account
    expect(byCy('auth.login.signupLink')).not.toBeInTheDocument()

    fireEvent.click(byCy('auth.login.showEmail')!)

    expect(byCy('auth.login.otpForm')).toBeInTheDocument()
    expect(byCy('auth.login.otpEmailInput')).toBeInTheDocument()
    expect(byCy('auth.login.passwordInput')).not.toBeInTheDocument()
    expect(byCy('auth.login.forgotPassword')).not.toBeInTheDocument()
    // No password alternative offered under the preset
    expect(byCy('auth.login.usePassword')).not.toBeInTheDocument()
  })

  test('validates the email before sending a code', async () => {
    render(<LoginForm />)
    fireEvent.click(byCy('auth.login.showEmail')!)

    fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: 'not-an-email' } })
    fireEvent.click(byCy('auth.login.otpSend')!)

    await waitFor(() => expect(byCy('auth.login.otpEmailError')).toBeInTheDocument())
    expect(mockSendOtp).not.toHaveBeenCalled()
  })

  test('sends the one-time code, then verifies it and signs in', async () => {
    render(<LoginForm />)
    fireEvent.click(byCy('auth.login.showEmail')!)

    fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: 'ada@example.com' } })
    fireEvent.click(byCy('auth.login.otpSend')!)

    await waitFor(() => expect(mockSendOtp).toHaveBeenCalledWith('ada@example.com'))
    await waitFor(() => expect(byCy('auth.login.otpCodeInput')).toBeInTheDocument())
    expect(byCy('auth.login.otpSentNotice')).toHaveTextContent('ada@example.com')

    // A short/invalid code is rejected client-side
    fireEvent.change(byCy('auth.login.otpCodeInput')!, { target: { value: '12' } })
    fireEvent.click(byCy('auth.login.otpSubmit')!)
    await waitFor(() => expect(byCy('auth.login.otpCodeError')).toBeInTheDocument())
    expect(mockSignInWithOtp).not.toHaveBeenCalled()

    fireEvent.change(byCy('auth.login.otpCodeInput')!, { target: { value: '123456' } })
    fireEvent.click(byCy('auth.login.otpSubmit')!)

    await waitFor(() =>
      expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'ada@example.com', otp: '123456', redirectTo: undefined })
    )
  })

  test('the notice counts the code down and reports it expired (#186)', async () => {
    jest.useFakeTimers()
    try {
      render(<LoginForm />)
      fireEvent.click(byCy('auth.login.showEmail')!)
      fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: 'ada@example.com' } })
      fireEvent.click(byCy('auth.login.otpSend')!)

      await waitFor(() => expect(byCy('auth.login.otpCountdown')).toBeInTheDocument())

      // The 300s lifetime is rendered, not spelled out in the sentence
      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expiresIn:5:00')

      act(() => { jest.advanceTimersByTime(60_000) })
      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expiresIn:4:00')

      act(() => { jest.advanceTimersByTime(239_000) })
      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expiresIn:0:01')

      // At the deadline it stops promising time it no longer has
      act(() => { jest.advanceTimersByTime(2_000) })
      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expired')
      expect(byCy('auth.login.otpCountdown')?.getAttribute('aria-live')).toBe('polite')
    } finally {
      jest.useRealTimers()
    }
  })

  test('the countdown interval stops ticking once the code expires (#186)', async () => {
    jest.useFakeTimers()
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
    try {
      render(<LoginForm />)
      fireEvent.click(byCy('auth.login.showEmail')!)
      fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: 'ada@example.com' } })
      fireEvent.click(byCy('auth.login.otpSend')!)
      await waitFor(() => expect(byCy('auth.login.otpCountdown')).toBeInTheDocument())

      clearIntervalSpy.mockClear()
      act(() => { jest.advanceTimersByTime(300_000) })

      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expired')
      // Cleared as soon as the tick hits zero, not only on unmount.
      expect(clearIntervalSpy).toHaveBeenCalled()
    } finally {
      clearIntervalSpy.mockRestore()
      jest.useRealTimers()
    }
  })

  test('resending after expiry restarts the countdown from the full lifetime (#186)', async () => {
    jest.useFakeTimers()
    try {
      render(<LoginForm />)
      fireEvent.click(byCy('auth.login.showEmail')!)
      fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: 'ada@example.com' } })
      fireEvent.click(byCy('auth.login.otpSend')!)
      await waitFor(() => expect(byCy('auth.login.otpCountdown')).toBeInTheDocument())

      act(() => { jest.advanceTimersByTime(300_000) })
      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expired')

      await act(async () => {
        fireEvent.click(byCy('auth.login.otpResend')!)
      })

      expect(mockSendOtp).toHaveBeenCalledTimes(2)
      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expiresIn:5:00')
      expect(byCy('auth.login.otpCountdown')).not.toHaveTextContent('login.form.otp.expired')
    } finally {
      jest.useRealTimers()
    }
  })

  test('the countdown starts from when the request was sent, not when it resolved (#186)', async () => {
    jest.useFakeTimers()
    try {
      // A slow round trip: the server already persisted (and started the
      // clock on) the code well before the client hears back.
      mockSendOtp.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 5_000)),
      )

      render(<LoginForm />)
      fireEvent.click(byCy('auth.login.showEmail')!)
      fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: 'ada@example.com' } })
      fireEvent.click(byCy('auth.login.otpSend')!)

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000)
      })

      // 5s of the 300s lifetime were already spent in flight — the notice
      // must not restart the clock as if the code had just been issued.
      await waitFor(() => expect(byCy('auth.login.otpCountdown')).toBeInTheDocument())
      expect(byCy('auth.login.otpCountdown')).toHaveTextContent('login.form.otp.expiresIn:4:55')
    } finally {
      jest.useRealTimers()
    }
  })

  test('shows the server error when the code is wrong and allows resending', async () => {
    mockSignInWithOtp.mockRejectedValueOnce(new Error('Invalid OTP'))
    render(<LoginForm />)
    fireEvent.click(byCy('auth.login.showEmail')!)
    fireEvent.change(byCy('auth.login.otpEmailInput')!, { target: { value: 'ada@example.com' } })
    fireEvent.click(byCy('auth.login.otpSend')!)
    await waitFor(() => expect(byCy('auth.login.otpCodeInput')).toBeInTheDocument())

    fireEvent.change(byCy('auth.login.otpCodeInput')!, { target: { value: '000000' } })
    fireEvent.click(byCy('auth.login.otpSubmit')!)
    await waitFor(() => expect(byCy('auth.login.errorAlert')).toBeInTheDocument())

    fireEvent.click(byCy('auth.login.otpResend')!)
    await waitFor(() => expect(mockSendOtp).toHaveBeenCalledTimes(2))
  })

  test('calls googleSignIn from the Google button', async () => {
    mockGoogleSignIn.mockResolvedValue(undefined)
    render(<LoginForm />)

    await act(async () => {
      fireEvent.click(byCy('auth.login.googleSignin')!)
    })

    expect(mockGoogleSignIn).toHaveBeenCalledTimes(1)
  })

  test('OTP-only (no Google): the code form is shown directly', () => {
    setPreset(['email-otp'])
    render(<LoginForm />)

    expect(byCy('auth.login.googleSignin')).not.toBeInTheDocument()
    expect(byCy('auth.login.showEmail')).not.toBeInTheDocument()
    expect(byCy('auth.login.otpEmailInput')).toBeInTheDocument()
    expect(byCy('auth.login.passwordInput')).not.toBeInTheDocument()
  })
})

describe('LoginForm — theme overrides the preset', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConfig.DEV_KEYRING_CONFIG = undefined
  })

  test("classic preset ['email-password', 'google']: password form, signup link, no OTP", () => {
    setPreset(['email-password', 'google'])
    render(<LoginForm />)

    fireEvent.click(byCy('auth.login.showEmail')!)

    expect(byCy('auth.login.form')).toBeInTheDocument()
    expect(byCy('auth.login.emailInput')).toBeInTheDocument()
    expect(byCy('auth.login.passwordInput')).toBeInTheDocument()
    expect(byCy('auth.login.forgotPassword')).toBeInTheDocument()
    expect(byCy('auth.login.signupLink')).toBeInTheDocument()
    expect(byCy('auth.login.otpForm')).not.toBeInTheDocument()
    expect(byCy('auth.login.useOtp')).not.toBeInTheDocument()
  })

  test('both methods: the first configured email method opens first and the user can switch', () => {
    setPreset(['email-password', 'email-otp', 'google'])
    render(<LoginForm />)
    fireEvent.click(byCy('auth.login.showEmail')!)

    // password first (configured order)
    expect(byCy('auth.login.passwordInput')).toBeInTheDocument()
    expect(byCy('auth.login.otpForm')).not.toBeInTheDocument()

    fireEvent.click(byCy('auth.login.useOtp')!)
    expect(byCy('auth.login.otpForm')).toBeInTheDocument()
    expect(byCy('auth.login.passwordInput')).not.toBeInTheDocument()

    fireEvent.click(byCy('auth.login.usePassword')!)
    expect(byCy('auth.login.passwordInput')).toBeInTheDocument()
  })

  test("both methods with OTP first ['email-otp', 'email-password', 'google']: code form opens first", () => {
    setPreset(['email-otp', 'email-password', 'google'])
    render(<LoginForm />)
    fireEvent.click(byCy('auth.login.showEmail')!)

    expect(byCy('auth.login.otpForm')).toBeInTheDocument()
    expect(byCy('auth.login.usePassword')).toBeInTheDocument()
  })

  test('dev-only: DevKeyring keeps the password form reachable under the passwordless preset', () => {
    setPreset(['email-otp', 'google'])
    mockConfig.DEV_KEYRING_CONFIG = { enabled: true, users: [] }
    render(<LoginForm />)
    expect(screen.getByTestId('dev-keyring')).toBeInTheDocument()
    fireEvent.click(byCy('auth.login.showEmail')!)

    expect(byCy('auth.login.otpForm')).toBeInTheDocument()
    expect(byCy('auth.login.usePassword')).toBeInTheDocument()
    fireEvent.click(byCy('auth.login.usePassword')!)
    expect(byCy('auth.login.passwordInput')).toBeInTheDocument()
    // ...but the signup link still follows the real preset (no password signup)
    expect(byCy('auth.login.signupLink')).not.toBeInTheDocument()
  })
})

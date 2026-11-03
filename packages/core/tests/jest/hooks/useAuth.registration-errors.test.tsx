/**
 * @jest-environment jsdom
 *
 * useAuthActions keeps a registration-policy code from the auth API on the
 * error it throws, so the forms can show their own message for it.
 */
import { renderHook } from '@testing-library/react'

const mockSendOtp = jest.fn()
const mockOtpSignIn = jest.fn()
const mockPasswordSignIn = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    useSession: jest.fn(),
    signIn: { email: (...args: unknown[]) => mockPasswordSignIn(...args), emailOtp: (...args: unknown[]) => mockOtpSignIn(...args), social: jest.fn() },
    emailOtp: { sendVerificationOtp: (...args: unknown[]) => mockSendOtp(...args) },
  },
}))
jest.mock('@/core/hooks/useLastAuthMethod', () => ({ useLastAuthMethod: () => ({ saveAuthMethod: jest.fn() }) }))

import { useAuthActions } from '@/core/hooks/useAuth'

const domainError = { status: 403, code: 'DOMAIN_NOT_ALLOWED', message: "This email's domain can't sign in here." }

describe('useAuthActions registration-policy codes', () => {
  test('sendOtp and signInWithOtp throw with code DOMAIN_NOT_ALLOWED', async () => {
    mockSendOtp.mockResolvedValue({ data: null, error: domainError })
    mockOtpSignIn.mockResolvedValue({ data: null, error: domainError })
    const { result } = renderHook(() => useAuthActions())

    await expect(result.current.sendOtp('a@other.example')).rejects.toMatchObject({ code: 'DOMAIN_NOT_ALLOWED' })
    await expect(result.current.signInWithOtp({ email: 'a@other.example', otp: '123456' }))
      .rejects.toMatchObject({ code: 'DOMAIN_NOT_ALLOWED', message: domainError.message })
  })

  test('sendOtp keeps EMAIL_SEND_FAILED, a code the email provider could not send', async () => {
    mockSendOtp.mockResolvedValue({
      data: null,
      error: { status: 503, code: 'EMAIL_SEND_FAILED', message: 'The email could not be sent. Try again later.' },
    })
    const { result } = renderHook(() => useAuthActions())

    await expect(result.current.sendOtp('a@nextspark.dev')).rejects.toMatchObject({ code: 'EMAIL_SEND_FAILED' })
  })

  test('other Better Auth codes are not passed on (the forms derive those from the message)', async () => {
    mockOtpSignIn.mockResolvedValue({ data: null, error: { status: 400, code: 'INVALID_OTP', message: 'Invalid OTP' } })
    const { result } = renderHook(() => useAuthActions())

    const error = await result.current.signInWithOtp({ email: 'a@nextspark.dev', otp: '000000' }).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as { code?: string }).code).toBeUndefined()
  })

  test('a 429 becomes RATE_LIMITED with the seconds to wait, on the code request, the code check and the password sign-in', async () => {
    const limited = { status: 429, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED', retryAfter: 540 }
    mockSendOtp.mockResolvedValue({ data: null, error: limited })
    mockOtpSignIn.mockResolvedValue({ data: null, error: limited })
    mockPasswordSignIn.mockResolvedValue({ data: null, error: limited })
    const { result } = renderHook(() => useAuthActions())

    await expect(result.current.sendOtp('a@nextspark.dev')).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 540 })
    await expect(result.current.signInWithOtp({ email: 'a@nextspark.dev', otp: '123456' })).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 540 })
    await expect(result.current.signIn({ email: 'a@nextspark.dev', password: 'secret1' })).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 540 })
  })
})

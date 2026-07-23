/**
 * `sendResetPasswordCallback`/`sendVerificationEmailCallback` must trust the
 * `url` better-auth already built (token embedded in the reset-password path,
 * `callbackURL` already correctly `&`-joined for email verification) instead
 * of reconstructing it. Reconstructing was the actual bug: appending a second
 * `?token=` onto a `url` that already has `?callbackURL=...` produces a
 * value with two `?` characters, which better-auth's own callback-URL check
 * rejects — confirmed against a real running server. This suite locks in the
 * fix at the unit level, fast, without needing that live server.
 */
const sendResetPasswordEmailMock = jest.fn().mockResolvedValue({ subject: 's', html: 'h', text: 't' })
const sendVerifyEmailMock = jest.fn().mockResolvedValue({ subject: 's', html: 'h', text: 't' })

jest.mock('@nextsparkjs/core/lib/email/send', () => ({
  sendResetPasswordEmail: (...args: unknown[]) => sendResetPasswordEmailMock(...args),
  sendVerifyEmail: (...args: unknown[]) => sendVerifyEmailMock(...args),
}))

import {
  sendResetPasswordCallback,
  sendVerificationEmailCallback,
} from '@nextsparkjs/core/lib/auth-email-callbacks'

function fakeEmailService() {
  return { send: jest.fn().mockResolvedValue({ success: true }) }
}

const USER = { email: 'student@aprende.dev', id: 'user-1', firstName: 'Ana' }

describe('sendResetPasswordCallback', () => {
  beforeEach(() => {
    sendResetPasswordEmailMock.mockClear()
  })

  test('a url with its own query string (redirectTo already carrying a param) is used AS-IS, no extra ?token= appended', async () => {
    // Mirrors the real trigger: redirectTo baked as `/onboarding?email=...`,
    // so better-auth's own url already contains `?callbackURL=...`.
    const url = 'http://localhost:3026/api/auth/reset-password/TOKEN123?callbackURL=%2Fonboarding%3Femail%3Dstudent%2540aprende.dev'
    const emailService = fakeEmailService()

    await sendResetPasswordCallback({ user: USER, url, token: 'TOKEN123' }, emailService)

    expect(sendResetPasswordEmailMock).toHaveBeenCalledTimes(1)
    const [data] = sendResetPasswordEmailMock.mock.calls[0]
    expect(data.resetUrl).toBe(url)
    // The real bug: a second, unencoded '?' appended after the first query string.
    expect(data.resetUrl.match(/\?/g)?.length).toBe(1)
  })

  test('a url with no existing query string (the current default /reset-password flow) also passes through unmodified', async () => {
    const url = 'http://localhost:3026/api/auth/reset-password/TOKEN456?callbackURL=%2Freset-password'
    const emailService = fakeEmailService()

    await sendResetPasswordCallback({ user: USER, url, token: 'TOKEN456' }, emailService)

    const [data] = sendResetPasswordEmailMock.mock.calls[0]
    expect(data.resetUrl).toBe(url)
  })

  test('propagates a send failure as a thrown error', async () => {
    const emailService = { send: jest.fn().mockResolvedValue({ success: false, error: 'boom' }) }

    await expect(
      sendResetPasswordCallback({ user: USER, url: 'http://x/reset-password/T?callbackURL=%2F', token: 'T' }, emailService)
    ).rejects.toThrow('Failed to send reset password email')
  })
})

describe('sendVerificationEmailCallback', () => {
  beforeEach(() => {
    sendVerifyEmailMock.mockClear()
  })

  test('a url carrying a callbackURL survives unmodified, instead of being dropped', async () => {
    const url = 'http://localhost:3026/api/auth/verify-email?token=TOKEN789&callbackURL=%2Fdashboard'
    const emailService = fakeEmailService()

    await sendVerificationEmailCallback({ user: USER, url, token: 'TOKEN789' }, emailService)

    expect(sendVerifyEmailMock).toHaveBeenCalledTimes(1)
    const [data] = sendVerifyEmailMock.mock.calls[0]
    expect(data.verificationUrl).toBe(url)
    expect(data.verificationUrl).toContain('callbackURL=%2Fdashboard')
  })

  test('propagates a send failure as a thrown error', async () => {
    const emailService = { send: jest.fn().mockResolvedValue({ success: false, error: 'boom' }) }

    await expect(
      sendVerificationEmailCallback({ user: USER, url: 'http://x/verify-email?token=T', token: 'T' }, emailService)
    ).rejects.toThrow('Failed to send verification email')
  })
})

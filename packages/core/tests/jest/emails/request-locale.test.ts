/**
 * Email senders may run inside a request whose locale is not the configured
 * default. When callers omit `locale`, next-intl must resolve that request
 * locale via its namespace overload instead of receiving a forced locale.
 */
import { describe, expect, jest, test } from '@jest/globals'

const mockGetTranslations = jest.fn(async () => (key: string) => key)

jest.mock('next-intl/server', () => ({
  getTranslations: (...args: unknown[]) => mockGetTranslations(...args),
}))

import otpVerification from '@/core/emails/otp-verification'
import resetPassword from '@/core/emails/reset-password'
import teamInvitation from '@/core/emails/team-invitation'
import verifyEmail from '@/core/emails/verify-email'

const templates = [
  ['email.otpVerification', () => otpVerification({ email: 'ada@example.test', otp: '123456', type: 'sign-in' })],
  ['email.resetPassword', () => resetPassword({ resetUrl: 'https://example.test/reset', userName: 'Ada' })],
  ['email.teamInvitation', () => teamInvitation({ inviteeEmail: 'ada@example.test', inviterName: 'Grace', teamName: 'Analytical', role: 'member', acceptUrl: 'https://example.test/invite', expiresIn: '7 days' })],
  ['email.verifyEmail', () => verifyEmail({ verificationUrl: 'https://example.test/verify', userName: 'Ada' })],
] as const

describe('email templates request-locale resolution', () => {
  test.each(templates)('%s leaves locale resolution to next-intl when locale is omitted', async (namespace, render) => {
    mockGetTranslations.mockClear()

    await render()

    expect(mockGetTranslations).toHaveBeenCalledWith(namespace)
  })
})

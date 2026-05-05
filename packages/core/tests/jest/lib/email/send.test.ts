/**
 * Tests for the typed convenience helpers in `lib/email/send.ts`.
 *
 * These verify that each helper:
 *   - Routes to the correct slug in `EMAIL_REGISTRY`
 *   - Forwards `data` and `locale` arguments unchanged
 *   - Returns whatever the registered handler returns (sync or async)
 *
 * The registry itself is mocked so this stays a pure unit test of the
 * routing + argument-forwarding behaviour.
 */

const verifyEmailMock = jest.fn()
const resetPasswordMock = jest.fn()
const otpVerificationMock = jest.fn()
const teamInvitationMock = jest.fn()

jest.mock('@nextsparkjs/registries/email-registry', () => ({
  EMAIL_REGISTRY: {
    'verify-email': verifyEmailMock,
    'reset-password': resetPasswordMock,
    'otp-verification': otpVerificationMock,
    'team-invitation': teamInvitationMock,
  },
}))

import {
  sendVerifyEmail,
  sendResetPasswordEmail,
  sendOtpVerificationEmail,
  sendTeamInvitationEmail,
} from '@nextsparkjs/core/lib/email/send'
import type {
  VerificationEmailData,
  PasswordResetEmailData,
  OtpVerificationEmailData,
  TeamInvitationEmailData,
} from '@nextsparkjs/core/lib/email/types'

beforeEach(() => {
  verifyEmailMock.mockReset()
  resetPasswordMock.mockReset()
  otpVerificationMock.mockReset()
  teamInvitationMock.mockReset()
})

describe('sendVerifyEmail', () => {
  const data: VerificationEmailData = {
    userName: 'Pablo',
    verificationUrl: 'https://example.test/verify',
    appName: 'Acme',
  }

  it('routes to EMAIL_REGISTRY["verify-email"] with data and locale', () => {
    verifyEmailMock.mockReturnValue({ subject: 'S', html: 'H' })
    const result = sendVerifyEmail(data, 'es')
    expect(verifyEmailMock).toHaveBeenCalledTimes(1)
    expect(verifyEmailMock).toHaveBeenCalledWith(data, 'es')
    expect(result).toEqual({ subject: 'S', html: 'H' })
  })

  it('forwards undefined locale when not provided', () => {
    verifyEmailMock.mockReturnValue({ subject: '', html: '' })
    sendVerifyEmail(data)
    expect(verifyEmailMock).toHaveBeenCalledWith(data, undefined)
  })

  it('returns a promise when the underlying handler is async', async () => {
    verifyEmailMock.mockResolvedValue({ subject: 'X', html: 'Y' })
    const result = sendVerifyEmail(data, 'fr')
    await expect(result).resolves.toEqual({ subject: 'X', html: 'Y' })
  })

  it('does not call any sibling slug', () => {
    verifyEmailMock.mockReturnValue({ subject: '', html: '' })
    sendVerifyEmail(data)
    expect(resetPasswordMock).not.toHaveBeenCalled()
    expect(otpVerificationMock).not.toHaveBeenCalled()
    expect(teamInvitationMock).not.toHaveBeenCalled()
  })
})

describe('sendResetPasswordEmail', () => {
  const data: PasswordResetEmailData = {
    userName: 'Carla',
    resetUrl: 'https://example.test/reset',
    appName: 'Acme',
    expiresIn: '1 hour',
  }

  it('routes to EMAIL_REGISTRY["reset-password"]', () => {
    resetPasswordMock.mockReturnValue({ subject: 'rp', html: 'rphtml' })
    const result = sendResetPasswordEmail(data, 'de')
    expect(resetPasswordMock).toHaveBeenCalledWith(data, 'de')
    expect(result).toEqual({ subject: 'rp', html: 'rphtml' })
  })

  it('forwards data without expiresIn correctly', () => {
    resetPasswordMock.mockReturnValue({ subject: '', html: '' })
    const partial: PasswordResetEmailData = { ...data, expiresIn: undefined }
    sendResetPasswordEmail(partial)
    expect(resetPasswordMock).toHaveBeenCalledWith(partial, undefined)
  })
})

describe('sendOtpVerificationEmail', () => {
  const data: OtpVerificationEmailData = {
    email: 'p@example.test',
    otp: '654321',
    type: 'sign-in',
    appName: 'Acme',
  }

  it('routes to EMAIL_REGISTRY["otp-verification"]', () => {
    otpVerificationMock.mockReturnValue({ subject: 'otp', html: 'otphtml' })
    const result = sendOtpVerificationEmail(data, 'pt')
    expect(otpVerificationMock).toHaveBeenCalledWith(data, 'pt')
    expect(result).toEqual({ subject: 'otp', html: 'otphtml' })
  })
})

describe('sendTeamInvitationEmail', () => {
  const data: TeamInvitationEmailData = {
    inviteeEmail: 'invited@example.test',
    inviterName: 'Carla',
    teamName: 'Acme HQ',
    role: 'admin',
    acceptUrl: 'https://example.test/accept',
    expiresIn: '7 days',
    appName: 'Acme',
  }

  it('routes to EMAIL_REGISTRY["team-invitation"]', () => {
    teamInvitationMock.mockReturnValue({ subject: 'inv', html: 'invhtml' })
    const result = sendTeamInvitationEmail(data, 'it')
    expect(teamInvitationMock).toHaveBeenCalledWith(data, 'it')
    expect(result).toEqual({ subject: 'inv', html: 'invhtml' })
  })
})

describe('helper isolation', () => {
  it('every helper invokes a different registered slug', () => {
    verifyEmailMock.mockReturnValue({ subject: '', html: '' })
    resetPasswordMock.mockReturnValue({ subject: '', html: '' })
    otpVerificationMock.mockReturnValue({ subject: '', html: '' })
    teamInvitationMock.mockReturnValue({ subject: '', html: '' })

    sendVerifyEmail({ userName: 'a', verificationUrl: 'u', appName: 'x' })
    sendResetPasswordEmail({ userName: 'a', resetUrl: 'u', appName: 'x' })
    sendOtpVerificationEmail({ email: 'a', otp: '1', type: 't', appName: 'x' })
    sendTeamInvitationEmail({
      inviteeEmail: 'a',
      inviterName: 'b',
      teamName: 'c',
      role: 'd',
      acceptUrl: 'u',
      expiresIn: 'e',
      appName: 'x',
    })

    expect(verifyEmailMock).toHaveBeenCalledTimes(1)
    expect(resetPasswordMock).toHaveBeenCalledTimes(1)
    expect(otpVerificationMock).toHaveBeenCalledTimes(1)
    expect(teamInvitationMock).toHaveBeenCalledTimes(1)
  })
})

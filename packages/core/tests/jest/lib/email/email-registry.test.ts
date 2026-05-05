/**
 * Tests for the per-file email templates that ship as core defaults.
 *
 * These tests import directly from `packages/core/src/emails/<slug>` (NOT via
 * `EMAIL_REGISTRY`) so they validate the unmodified core defaults regardless
 * of any theme override the active project might have. The registry's
 * override-resolution logic is exercised separately by the discovery test
 * below.
 */

import verifyEmail from '@nextsparkjs/core/emails/verify-email'
import resetPassword from '@nextsparkjs/core/emails/reset-password'
import otpVerification from '@nextsparkjs/core/emails/otp-verification'
import teamInvitation from '@nextsparkjs/core/emails/team-invitation'
import type {
  VerificationEmailData,
  PasswordResetEmailData,
  OtpVerificationEmailData,
  TeamInvitationEmailData,
} from '@nextsparkjs/core/lib/email/types'

const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const

const verifyData: VerificationEmailData = {
  userName: 'Pablo',
  verificationUrl: 'https://example.test/verify?token=ABC123',
  appName: 'Acme',
}

const resetData: PasswordResetEmailData = {
  userName: 'Pablo',
  resetUrl: 'https://example.test/reset?token=DEF456',
  appName: 'Acme',
  expiresIn: '1 hour',
}

const otpData: OtpVerificationEmailData = {
  email: 'pablo@example.test',
  otp: '123456',
  type: 'sign-in',
  appName: 'Acme',
}

const inviteData: TeamInvitationEmailData = {
  inviteeEmail: 'pablo@example.test',
  inviterName: 'Carla',
  teamName: 'Acme HQ',
  role: 'admin',
  acceptUrl: 'https://example.test/accept?token=GHI789',
  expiresIn: '7 days',
  appName: 'Acme',
}

describe('Core email defaults — output shape', () => {
  it('verify-email returns subject and html for every locale', async () => {
    for (const locale of LOCALES) {
      const result = await verifyEmail(verifyData, locale)
      expect(result.subject).toEqual(expect.any(String))
      expect(result.html).toContain(verifyData.verificationUrl)
      expect(result.html).toContain(verifyData.appName)
      expect(result.subject.length).toBeGreaterThan(0)
    }
  })

  it('reset-password returns subject and html for every locale', async () => {
    for (const locale of LOCALES) {
      const result = await resetPassword(resetData, locale)
      expect(result.subject).toEqual(expect.any(String))
      expect(result.html).toContain(resetData.resetUrl)
      expect(result.html).toContain(resetData.appName)
    }
  })

  it('otp-verification returns subject and html for every locale', async () => {
    for (const locale of LOCALES) {
      const result = await otpVerification(otpData, locale)
      expect(result.subject).toEqual(expect.any(String))
      expect(result.html).toContain(otpData.otp)
      expect(result.html).toContain(otpData.appName)
    }
  })

  it('team-invitation returns subject and html for every locale', async () => {
    for (const locale of LOCALES) {
      const result = await teamInvitation(inviteData, locale)
      expect(result.subject).toEqual(expect.any(String))
      expect(result.html).toContain(inviteData.acceptUrl)
      expect(result.html).toContain(inviteData.teamName)
      expect(result.html).toContain(inviteData.inviterName)
    }
  })
})

describe('Core email defaults — content snapshot (en)', () => {
  it('verify-email english snapshot', async () => {
    const result = await verifyEmail(verifyData, 'en')
    expect(result.subject).toBe('Welcome to Acme - Verify Your Email')
    expect(result.html).toContain('Hi Pablo,')
    expect(result.html).toContain('Verify Email Address')
  })

  it('reset-password english snapshot', async () => {
    const result = await resetPassword(resetData, 'en')
    expect(result.subject).toBe('Reset Your Password - Acme')
    expect(result.html).toContain('Hi Pablo,')
    expect(result.html).toContain('This link will expire in 1 hour')
  })

  it('otp-verification english snapshot', async () => {
    const result = await otpVerification(otpData, 'en')
    expect(result.subject).toBe('123456 is your verification code - Acme')
    expect(result.html).toContain('123456')
    expect(result.html).toContain('5 minutes')
  })

  it('team-invitation english snapshot', async () => {
    const result = await teamInvitation(inviteData, 'en')
    expect(result.subject).toBe(
      "You've been invited to join Acme HQ on Acme",
    )
    expect(result.html).toContain('Carla')
    expect(result.html).toContain('Acme HQ')
    expect(result.html).toContain('admin')
    expect(result.html).toContain('7 days')
  })
})

describe('Core email defaults — Spanish localization sanity', () => {
  it('verify-email subject is in Spanish when locale=es', async () => {
    const result = await verifyEmail(verifyData, 'es')
    expect(result.subject).toContain('Bienvenido')
    expect(result.html).toContain('Hola Pablo,')
  })

  it('otp-verification subject is in Spanish when locale=es', async () => {
    const result = await otpVerification(otpData, 'es')
    expect(result.subject).toContain('código')
  })
})

describe('Core email defaults — empty user name handling', () => {
  it('verify-email greeting omits the name when userName is empty', async () => {
    const result = await verifyEmail({ ...verifyData, userName: '' }, 'en')
    expect(result.html).toContain('Hi,')
    expect(result.html).not.toContain('Hi ,')
  })

  it('reset-password greeting omits the name when userName is empty', async () => {
    const result = await resetPassword({ ...resetData, userName: '' }, 'en')
    expect(result.html).toContain('Hi,')
    expect(result.html).not.toContain('Hi ,')
  })
})

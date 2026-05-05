/**
 * Branch-coverage tests for the four core email defaults.
 *
 * The output-shape and snapshot tests in `email-registry.test.ts` exercise the
 * happy path with every field populated. These tests target the small remaining
 * branches in each template:
 *   - `data.appName || APP_NAME_FALLBACK` (falsy appName falls back to env)
 *   - `data.userName ? \` ${data.userName}\` : ''` (empty/falsy userName)
 *   - `data.expiresIn || t('defaultExpiresIn')` (reset-password fallback)
 *
 * NEXT_PUBLIC_APP_NAME isn't set in the jest env (see setup.ts), so the
 * fallback constant is the literal "Your App".
 */

import verifyEmail from '@nextsparkjs/core/emails/verify-email'
import resetPassword from '@nextsparkjs/core/emails/reset-password'
import otpVerification from '@nextsparkjs/core/emails/otp-verification'
import teamInvitation from '@nextsparkjs/core/emails/team-invitation'

const APP_NAME_FALLBACK = 'Your App'

describe('verify-email branches', () => {
  it('falls back to "Your App" when appName is empty', async () => {
    const result = await verifyEmail(
      { userName: 'Pablo', verificationUrl: 'u', appName: '' },
      'en',
    )
    expect(result.subject).toContain(APP_NAME_FALLBACK)
    expect(result.html).toContain(APP_NAME_FALLBACK)
  })

  it('falls back when appName is omitted entirely', async () => {
    // Cast: `appName` is required by the type but the runtime guard exists to
    // protect older call sites that may pass partial data via the deprecated
    // helpers.
    const result = await verifyEmail(
      { userName: '', verificationUrl: 'u' } as unknown as Parameters<typeof verifyEmail>[0],
      'en',
    )
    expect(result.subject).toContain(APP_NAME_FALLBACK)
  })

  it('renders without locale (defaults to next-intl default)', async () => {
    const result = await verifyEmail({
      userName: 'Pablo',
      verificationUrl: 'u',
      appName: 'Acme',
    })
    // Without locale, the mock falls back to 'en'.
    expect(result.subject).toContain('Welcome to Acme')
  })
})

describe('reset-password branches', () => {
  it('falls back to "Your App" when appName is empty', async () => {
    const result = await resetPassword(
      { userName: '', resetUrl: 'u', appName: '' },
      'en',
    )
    expect(result.subject).toContain(APP_NAME_FALLBACK)
  })

  it('uses translated defaultExpiresIn when expiresIn is omitted', async () => {
    const result = await resetPassword(
      { userName: 'Pablo', resetUrl: 'u', appName: 'Acme' },
      'en',
    )
    // English default is "1 hour"
    expect(result.html).toContain('1 hour')
  })

  it('uses translated defaultExpiresIn in Spanish when expiresIn is omitted', async () => {
    const result = await resetPassword(
      { userName: 'Pablo', resetUrl: 'u', appName: 'Acme' },
      'es',
    )
    // Spanish default is "1 hora"
    expect(result.html).toContain('1 hora')
  })

  it('uses provided expiresIn over the locale default', async () => {
    const result = await resetPassword(
      { userName: 'Pablo', resetUrl: 'u', appName: 'Acme', expiresIn: '24 hours' },
      'en',
    )
    expect(result.html).toContain('24 hours')
    expect(result.html).not.toContain('1 hour</strong>')
  })

  it('falls back when appName is omitted entirely', async () => {
    const result = await resetPassword(
      { userName: '', resetUrl: 'u' } as unknown as Parameters<typeof resetPassword>[0],
      'en',
    )
    expect(result.html).toContain(APP_NAME_FALLBACK)
  })
})

describe('otp-verification branches', () => {
  it('falls back to "Your App" when appName is empty', async () => {
    const result = await otpVerification(
      { email: 'p@x.test', otp: '123456', type: 'sign-in', appName: '' },
      'en',
    )
    expect(result.subject).toContain(APP_NAME_FALLBACK)
  })

  it('renders the OTP digits in the subject and body', async () => {
    const result = await otpVerification(
      { email: 'p@x.test', otp: '987654', type: 'sign-in', appName: 'Acme' },
      'en',
    )
    expect(result.subject.startsWith('987654')).toBe(true)
    expect(result.html).toContain('987654')
  })

  it('falls back when appName is omitted entirely', async () => {
    const result = await otpVerification(
      { email: 'p@x.test', otp: '123', type: 't' } as unknown as Parameters<typeof otpVerification>[0],
      'en',
    )
    expect(result.html).toContain(APP_NAME_FALLBACK)
  })
})

describe('team-invitation branches', () => {
  it('falls back to "Your App" when appName is empty', async () => {
    const result = await teamInvitation(
      {
        inviteeEmail: 'p@x.test',
        inviterName: 'Carla',
        teamName: 'HQ',
        role: 'admin',
        acceptUrl: 'u',
        expiresIn: '7 days',
        appName: '',
      },
      'en',
    )
    expect(result.html).toContain(APP_NAME_FALLBACK)
  })

  it('falls back when appName is omitted entirely', async () => {
    const result = await teamInvitation(
      {
        inviteeEmail: 'p@x.test',
        inviterName: 'Carla',
        teamName: 'HQ',
        role: 'admin',
        acceptUrl: 'u',
        expiresIn: '7 days',
      } as unknown as Parameters<typeof teamInvitation>[0],
      'en',
    )
    expect(result.html).toContain(APP_NAME_FALLBACK)
  })

  it('renders all variable interpolations: inviter, team, role, expiry, accept URL, invitee', async () => {
    const result = await teamInvitation(
      {
        inviteeEmail: 'invited@x.test',
        inviterName: 'Carla',
        teamName: 'Acme HQ',
        role: 'editor',
        acceptUrl: 'https://example.test/accept?t=ABC',
        expiresIn: '14 days',
        appName: 'Acme',
      },
      'en',
    )
    expect(result.html).toContain('Carla')
    expect(result.html).toContain('Acme HQ')
    expect(result.html).toContain('editor')
    expect(result.html).toContain('14 days')
    expect(result.html).toContain('https://example.test/accept?t=ABC')
    expect(result.html).toContain('invited@x.test')
  })
})

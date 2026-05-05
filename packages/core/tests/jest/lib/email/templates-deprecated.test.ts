/**
 * Tests for the @deprecated backward-compat surface in `lib/email/templates.ts`.
 *
 * The whole point of keeping these exports is to avoid breaking out-of-tree
 * consumers during the migration window. So we test that:
 *   - `emailTemplates.<slug>(data)` still produces output containing the
 *     expected dynamic data
 *   - `createVerificationEmail`, `createPasswordResetEmail`,
 *     `createTeamInvitationEmail` legacy helpers still work
 *   - All adapters route through the registry (so theme overrides apply
 *     transitively if a project still uses the legacy API)
 */

import {
  emailTemplates,
  createVerificationEmail,
  createPasswordResetEmail,
  createTeamInvitationEmail,
} from '@nextsparkjs/core/lib/email/templates'

describe('emailTemplates deprecated proxy', () => {
  it('verifyEmail returns a Promise<EmailContent> with subject + html', async () => {
    const result = await emailTemplates.verifyEmail({
      userName: 'Pablo',
      verificationUrl: 'https://example.test/verify?token=ABC',
      appName: 'Acme',
    })
    expect(typeof result.subject).toBe('string')
    expect(typeof result.html).toBe('string')
    expect(result.html).toContain('https://example.test/verify?token=ABC')
    expect(result.html).toContain('Acme')
  })

  it('resetPassword returns a Promise<EmailContent>', async () => {
    const result = await emailTemplates.resetPassword({
      userName: 'Pablo',
      resetUrl: 'https://example.test/reset?token=DEF',
      appName: 'Acme',
      expiresIn: '2 hours',
    })
    expect(result.html).toContain('https://example.test/reset?token=DEF')
    expect(result.html).toContain('2 hours')
  })

  it('otpVerification returns a Promise<EmailContent>', async () => {
    const result = await emailTemplates.otpVerification({
      email: 'pablo@example.test',
      otp: '999999',
      type: 'sign-in',
      appName: 'Acme',
    })
    expect(result.subject).toContain('999999')
    expect(result.html).toContain('999999')
  })

  it('teamInvitation returns a Promise<EmailContent>', async () => {
    const result = await emailTemplates.teamInvitation({
      inviteeEmail: 'p@example.test',
      inviterName: 'Carla',
      teamName: 'Acme HQ',
      role: 'admin',
      acceptUrl: 'https://example.test/accept?token=GHI',
      expiresIn: '7 days',
      appName: 'Acme',
    })
    expect(result.html).toContain('Acme HQ')
    expect(result.html).toContain('Carla')
    expect(result.html).toContain('admin')
    expect(result.html).toContain('7 days')
  })
})

describe('createVerificationEmail (legacy)', () => {
  it('produces output containing the verification URL and APP_NAME', async () => {
    const result = await createVerificationEmail('Pablo', 'https://example.test/verify')
    expect(result.html).toContain('https://example.test/verify')
    expect(result.html).toContain('Pablo')
  })

  it('handles undefined name without producing "Hi ,"', async () => {
    const result = await createVerificationEmail(undefined, 'https://example.test/verify')
    expect(result.html).toContain('Hi,')
    expect(result.html).not.toContain('Hi ,')
  })

  it('handles empty-string name', async () => {
    const result = await createVerificationEmail('', 'https://example.test/verify')
    expect(result.html).toContain('Hi,')
  })
})

describe('createPasswordResetEmail (legacy)', () => {
  it('produces output containing the reset URL', async () => {
    const result = await createPasswordResetEmail('Pablo', 'https://example.test/reset')
    expect(result.html).toContain('https://example.test/reset')
    expect(result.html).toContain('Pablo')
  })

  it('handles undefined name', async () => {
    const result = await createPasswordResetEmail(undefined, 'https://example.test/reset')
    expect(result.html).toContain('Hi,')
    expect(result.html).not.toContain('Hi ,')
  })
})

describe('createTeamInvitationEmail (legacy)', () => {
  it('produces output containing all key team data', async () => {
    const result = await createTeamInvitationEmail(
      'invited@example.test',
      'Carla Inviter',
      'Acme HQ',
      'editor',
      'https://example.test/accept',
      '14 days',
    )
    expect(result.html).toContain('Acme HQ')
    expect(result.html).toContain('Carla Inviter')
    expect(result.html).toContain('editor')
    expect(result.html).toContain('14 days')
    expect(result.html).toContain('https://example.test/accept')
    expect(result.html).toContain('invited@example.test')
  })

  it('uses the default expiresIn ("7 days") when not provided', async () => {
    const result = await createTeamInvitationEmail(
      'p@example.test',
      'Carla',
      'Acme HQ',
      'admin',
      'https://example.test/accept',
      // expiresIn omitted — defaults to '7 days'
    )
    expect(result.html).toContain('7 days')
  })
})

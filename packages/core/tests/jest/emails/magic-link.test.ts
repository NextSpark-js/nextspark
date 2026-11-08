/**
 * The sign-in link email, in every shipped locale: it states the link's real lifetime, carries the link, and escapes it.
 */
import magicLink from '../../../src/emails/magic-link'
import { DEFAULT_MAGIC_LINK_EXPIRES_IN, resolveMagicLinkExpiresIn } from '../../../src/lib/auth/otp-config'

const data = { email: 'pablo@example.test', url: 'https://app.example.test/api/auth/magic-link/verify?token=abc&callbackURL=%2Fdashboard', appName: 'Acme' }

describe('magic-link email', () => {
  test.each([
    ['en', 'Your sign-in link - Acme', 'This link expires in 5 minutes.'],
    ['es', 'Tu enlace de acceso - Acme', 'Este enlace caduca en 5 minutos.'],
    ['de', 'Ihr Anmeldelink - Acme', 'Dieser Link läuft in 5 Minuten ab.'],
    ['fr', 'Votre lien de connexion - Acme', 'Ce lien expire dans 5 minutes.'],
    ['it', 'Il tuo link di accesso - Acme', 'Questo link scade tra 5 minuti.'],
    ['pt', 'Seu link de acesso - Acme', 'Este link expira em 5 minutos.'],
  ])('%s: translated subject and lifetime', async (locale, subject, notice) => {
    const result = await magicLink({ ...data, expiresIn: 300 }, locale)
    expect(result.subject).toBe(subject)
    expect(result.html).toContain(notice)
    expect(result.html).not.toMatch(/email\.magicLink|MISSING_MESSAGE/)
  })

  test('the link is in the button and in the fallback, escaped for HTML', async () => {
    const { html } = await magicLink(data, 'en')
    const escaped = data.url.replace('&', '&amp;')
    expect(html.split(`href="${escaped}"`)).toHaveLength(3)
    expect(html).not.toContain(data.url)
  })

  test('an app name with markup is escaped', async () => {
    const { html } = await magicLink({ ...data, appName: '<img src=x>' }, 'en')
    expect(html).not.toContain('<img')
  })

  test('without a lifetime it states the default, and a short one is rounded down', async () => {
    expect((await magicLink(data, 'en')).html).toContain(`This link expires in ${DEFAULT_MAGIC_LINK_EXPIRES_IN / 60} minutes.`)
    expect((await magicLink({ ...data, expiresIn: 90 }, 'en')).html).toContain('This link expires in 1 minute.')
    expect((await magicLink({ ...data, expiresIn: 30 }, 'en')).html).toContain('This link expires in less than a minute.')
  })
})

describe('resolveMagicLinkExpiresIn', () => {
  test('the configured value, the default, and a warning for an invalid one', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveMagicLinkExpiresIn({ magicLink: { expiresIn: 900 } })).toBe(900)
    expect(resolveMagicLinkExpiresIn({})).toBe(300)
    expect(warn).not.toHaveBeenCalled()
    expect(resolveMagicLinkExpiresIn({ magicLink: { expiresIn: -1 } })).toBe(300)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('auth.magicLink.expiresIn'))
    warn.mockRestore()
  })
})

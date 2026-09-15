/**
 * The OTP email must state the code's actual lifetime instead of a hardcoded
 * "5 minutes" (#186): a theme that sets `auth.otp.expiresIn` would otherwise
 * have the login screen count down from a different duration than the email
 * promises. Covers the `expiresIn` -> minutes rounding, the fallback when the
 * caller omits it, and pluralization across every shipped locale.
 */
import otpVerification from '../../../src/emails/otp-verification'
import { DEFAULT_OTP_CONFIG } from '../../../src/lib/auth/otp-config'

const LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt'] as const

const baseData = {
  email: 'pablo@example.test',
  otp: '123456',
  type: 'sign-in',
  appName: 'Acme',
}

describe('otp-verification email — real expiresIn (#186)', () => {
  test('falls back to the default lifetime (5 minutes) when expiresIn is omitted', async () => {
    expect(DEFAULT_OTP_CONFIG.expiresIn).toBe(300)
    const result = await otpVerification(baseData, 'en')
    expect(result.html).toContain('This code expires in 5 minutes.')
  })

  test('a 60s lifetime reads as a singular minute, not "1 minutes"', async () => {
    const result = await otpVerification({ ...baseData, expiresIn: 60 }, 'en')
    expect(result.html).toContain('This code expires in 1 minute.')
    expect(result.html).not.toContain('1 minutes')
  })

  test('a 120s lifetime reads as 2 minutes', async () => {
    const result = await otpVerification({ ...baseData, expiresIn: 120 }, 'en')
    expect(result.html).toContain('This code expires in 2 minutes.')
  })

  test('rounds down so the email never promises more time than the code has (90s -> 1 minute)', async () => {
    const result = await otpVerification({ ...baseData, expiresIn: 90 }, 'en')
    expect(result.html).toContain('This code expires in 1 minute.')
    expect(result.html).not.toContain('2 minutes')
  })

  test.each([
    ['en', 'This code expires in less than a minute.'],
    ['es', 'Este código caduca en menos de un minuto.'],
    ['de', 'Dieser Code läuft in weniger als einer Minute ab.'],
    ['fr', "Ce code expire dans moins d'une minute."],
    ['it', 'Questo codice scade tra meno di un minuto.'],
    ['pt', 'Este código expira em menos de um minuto.'],
  ])('%s: a code that lasts under a minute reads "%s", not "0 minutes"', async (locale, expected) => {
    const result = await otpVerification({ ...baseData, expiresIn: 45 }, locale)
    expect(result.html).toContain(expected)
  })

  test.each([
    ['en', 60, 'This code expires in 1 minute.'],
    ['en', 120, 'This code expires in 2 minutes.'],
    ['en', 300, 'This code expires in 5 minutes.'],
    ['es', 60, 'Este código caduca en 1 minuto.'],
    ['es', 120, 'Este código caduca en 2 minutos.'],
    ['es', 300, 'Este código caduca en 5 minutos.'],
    ['de', 60, 'Dieser Code läuft in 1 Minute ab.'],
    ['de', 120, 'Dieser Code läuft in 2 Minuten ab.'],
    ['de', 300, 'Dieser Code läuft in 5 Minuten ab.'],
    ['fr', 60, 'Ce code expire dans 1 minute.'],
    ['fr', 120, 'Ce code expire dans 2 minutes.'],
    ['fr', 300, 'Ce code expire dans 5 minutes.'],
    ['it', 60, 'Questo codice scade tra 1 minuto.'],
    ['it', 120, 'Questo codice scade tra 2 minuti.'],
    ['it', 300, 'Questo codice scade tra 5 minuti.'],
    ['pt', 60, 'Este código expira em 1 minuto.'],
    ['pt', 120, 'Este código expira em 2 minutos.'],
    ['pt', 300, 'Este código expira em 5 minutos.'],
  ])('%s at %ps renders "%s"', async (locale, expiresIn, expected) => {
    const result = await otpVerification({ ...baseData, expiresIn }, locale)
    expect(result.html).toContain(expected)
  })

  test('every locale pluralizes correctly for both a 1-minute and a multi-minute code', async () => {
    for (const locale of LOCALES) {
      const oneMinute = await otpVerification({ ...baseData, expiresIn: 60 }, locale)
      const fiveMinutes = await otpVerification({ ...baseData, expiresIn: 300 }, locale)
      // The two renders must differ: a locale that always picked the same
      // branch (or leaked the raw ICU plural block) would fail this.
      expect(oneMinute.html).not.toEqual(fiveMinutes.html)
      expect(oneMinute.html).not.toContain('plural')
      expect(fiveMinutes.html).not.toContain('plural')
    }
  })
})

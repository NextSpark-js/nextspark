/**
 * EmailFactory provider selection (#309): production without a real provider fails at send(), never at create().
 */
import { EmailFactory } from '@nextsparkjs/core/lib/email/factory'
import { ConsoleProvider } from '@nextsparkjs/core/lib/email/providers/console'
import { ResendProvider } from '@nextsparkjs/core/lib/email/providers/resend'

const message = { to: 'a@example.com', subject: 's', html: '<p>x</p>' }
const KEYS = ['NODE_ENV', 'EMAIL_PROVIDER', 'RESEND_API_KEY', 'FORCE_RESEND_IN_DEV'] as const
const saved: Record<string, string | undefined> = {}
const env = process.env as Record<string, string | undefined>

beforeEach(() => {
  for (const k of KEYS) { saved[k] = env[k]; delete env[k] }
  EmailFactory.reset()
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
})
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete env[k]; else env[k] = saved[k] }
  EmailFactory.reset()
  jest.restoreAllMocks()
})

describe('EmailFactory', () => {
  it('production without credentials: create() does not throw, send() throws EMAIL_PROVIDER_NOT_CONFIGURED naming the variables', async () => {
    env.NODE_ENV = 'production'
    const provider = EmailFactory.create()
    expect(provider).not.toBeInstanceOf(ConsoleProvider)
    await expect(provider.send(message)).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_NOT_CONFIGURED', message: expect.stringMatching(/RESEND_API_KEY.*SMTP_HOST/s) })
  })

  it.each(['development', 'test'])('%s still selects the console provider', (nodeEnv) => {
    env.NODE_ENV = nodeEnv
    expect(EmailFactory.create()).toBeInstanceOf(ConsoleProvider)
  })

  it('explicit EMAIL_PROVIDER=console works in production and warns', () => {
    env.NODE_ENV = 'production'
    env.EMAIL_PROVIDER = 'console'
    expect(EmailFactory.create()).toBeInstanceOf(ConsoleProvider)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('EMAIL_PROVIDER=console in production'))
  })

  it('production with a Resend key uses Resend', () => {
    env.NODE_ENV = 'production'
    env.RESEND_API_KEY = 're_test'
    expect(EmailFactory.create()).toBeInstanceOf(ResendProvider)
  })
})

/**
 * Demo mode guards, each with and without NEXTSPARK_DEMO_MODE=true, and the refusal next to real services.
 * The account and reset guards run on a real database in tests/node (registration-gates, demo-reset).
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@vercel/blob', () => ({ put: jest.fn(), del: jest.fn() }))
jest.mock('@nextsparkjs/registries/billing-registry', () => ({ BILLING_REGISTRY: { provider: 'stripe' } }))
jest.mock('@/core/lib/config', () => ({
  AUTH_CONFIG: { methods: ['email-otp', 'google'] },
  DEV_CONFIG: { devKeyring: { enabled: true, users: [{ id: 'a', name: 'Sample', email: 'sample@example.test', password: 'pw', teamRoles: 'owner' }] } },
}))
jest.mock('@/core/lib/auth/runtime-readiness', () => jest.requireActual('@/core/lib/auth/runtime-readiness'))

import { demoModeProblems, demoModeRefusal, isDemoMode } from '@/core/lib/demo/mode'
import { EmailFactory } from '@/core/lib/email/factory'
import { ConsoleProvider } from '@/core/lib/email/providers/console'
import { ResendProvider } from '@/core/lib/email/providers/resend'
import { isBillingGatewayDisabled } from '@/core/lib/billing/provider-mode'
import { builtInWebhookRouteClosed } from '@/core/lib/billing/gateways/webhook-routes'
import { selectStorageDriver } from '@/core/lib/media/storage'
import { isPasswordLoginEnabled } from '@/core/lib/auth/auth-methods'
import { warnSampleAccountsAtStartup } from '@/core/lib/auth/sample-accounts'
import { getPublicAuthReadiness } from '@/core/lib/auth/runtime-readiness'

const env = process.env as Record<string, string | undefined>
const clean = { NEXTSPARK_DEMO_MODE: 'true', STORAGE_DRIVER: 'local', UPLOADS_DIR: '/tmp/demo' }
const saved = { ...env }

beforeEach(() => {
  delete env.NEXTSPARK_DEMO_MODE
  EmailFactory.reset()
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
})
afterEach(() => {
  for (const key of Object.keys(env)) if (!(key in saved)) delete env[key]
  Object.assign(env, saved)
  EmailFactory.reset()
  jest.restoreAllMocks()
})

describe('turning it on', () => {
  test.each(['1', 'TRUE', 'yes', ' true', ''])('%j is not demo mode', value => {
    expect(isDemoMode({ NEXTSPARK_DEMO_MODE: value })).toBe(false)
    expect(demoModeRefusal({ NEXTSPARK_DEMO_MODE: value, RESEND_API_KEY: 'x' })).toBeNull()
  })

  test('an environment without the variable has no refusal, whatever it holds', () => {
    expect(demoModeRefusal({ STRIPE_SECRET_KEY: 'sk_live_x' })).toBeNull()
  })

  test('with the variable and no real service there is nothing to refuse', () => {
    expect(demoModeRefusal(clean)).toBeNull()
    expect(demoModeRefusal({ ...clean, EMAIL_PROVIDER: 'console', LEMONSQUEEZY_ACCEPT_TEST_MODE: 'true', RESEND_API_KEY: ' ' })).toBeNull()
  })
})

describe('fails closed next to real services', () => {
  test.each([
    ['RESEND_API_KEY'], ['SMTP_HOST'], ['STRIPE_SECRET_KEY'], ['STRIPE_WEBHOOK_SECRET'], ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
    ['POLAR_ACCESS_TOKEN'], ['LEMONSQUEEZY_API_KEY'], ['PADDLE_API_KEY'], ['BLOB_READ_WRITE_TOKEN'], ['S3_ACCESS_KEY_ID'],
  ])('%s', name => {
    const value = 'value-that-must-not-be-printed'
    const refusal = demoModeRefusal({ ...clean, [name]: value })
    expect(refusal).toContain(`${name} is set`)
    expect(refusal).not.toContain(value)
  })

  test('an email provider other than console, and storage that is not local', () => {
    expect(demoModeProblems({ ...clean, EMAIL_PROVIDER: 'resend' })).toEqual(['EMAIL_PROVIDER is not console'])
    expect(demoModeProblems({ NEXTSPARK_DEMO_MODE: 'true' })).toEqual(['STORAGE_DRIVER is not local', 'UPLOADS_DIR is missing'])
  })
})

describe('email', () => {
  test('demo mode prints, even with a real provider asked for', () => {
    env.NEXTSPARK_DEMO_MODE = 'true'
    env.EMAIL_PROVIDER = 'resend'
    env.RESEND_API_KEY = 're_x'
    expect(EmailFactory.create()).toBeInstanceOf(ConsoleProvider)
    expect(EmailFactory.create({ provider: 'resend', resendApiKey: 're_x' })).toBeInstanceOf(ConsoleProvider)
  })

  test('without it the provider is the configured one', () => {
    env.EMAIL_PROVIDER = 'resend'
    env.RESEND_API_KEY = 're_x'
    expect(EmailFactory.create()).toBeInstanceOf(ResendProvider)
  })
})

describe('billing', () => {
  test('demo mode runs as no-gateway and closes the webhook routes', () => {
    env.NEXTSPARK_DEMO_MODE = 'true'
    expect(isBillingGatewayDisabled()).toBe(true)
    expect(builtInWebhookRouteClosed('stripe')).toBe(true)
  })

  test('without it the configured provider stands', () => {
    expect(isBillingGatewayDisabled()).toBe(false)
    expect(builtInWebhookRouteClosed('stripe')).toBe(false)
  })
})

describe('uploads', () => {
  test.each([{ STORAGE_DRIVER: 's3' }, { STORAGE_DRIVER: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' }, {}])('demo mode refuses %j', extra => {
    expect(selectStorageDriver({ NEXTSPARK_DEMO_MODE: 'true', NODE_ENV: 'development', ...extra } as NodeJS.ProcessEnv)).toMatchObject({ driver: null, message: expect.stringContaining('STORAGE_DRIVER must be local') })
  })

  test('demo mode keeps them on the local disk', () => {
    expect(selectStorageDriver({ ...clean, NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toMatchObject({ driver: { name: 'local' } })
  })

  test('without it the blob token selects Vercel Blob', () => {
    expect(selectStorageDriver({ NODE_ENV: 'production', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' } as NodeJS.ProcessEnv)).toMatchObject({ driver: { name: 'vercel-blob' } })
  })
})

describe('login', () => {
  const passwordless = { methods: ['email-otp' as const] }

  test('demo mode serves passwords and offers only them, with the sample accounts and nothing else from them', () => {
    env.NEXTSPARK_DEMO_MODE = 'true'
    expect(isPasswordLoginEnabled(passwordless, 'production')).toBe(true)
    expect(getPublicAuthReadiness({ authConfig: passwordless, env: { NODE_ENV: 'production', NEXTSPARK_DEMO_MODE: 'true', BETTER_AUTH_SECRET: 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x' } })).toMatchObject({
      status: 'ready',
      availableMethods: ['email-password'],
      demoAccounts: [{ name: 'Sample', email: 'sample@example.test', password: 'pw' }],
    })
  })

  test('without it passwords stay off in production and no account is exposed', () => {
    expect(isPasswordLoginEnabled(passwordless, 'production')).toBe(false)
    const readiness = getPublicAuthReadiness({ authConfig: passwordless, env: { NODE_ENV: 'production' } })
    expect(readiness).not.toHaveProperty('demoAccounts')
    expect(readiness.availableMethods).not.toContain('email-password')
  })
})

describe('the sample-password warning', () => {
  test('a demo does not warn about the accounts it is made of; anything else in production does', async () => {
    const query = jest.fn(async () => [{ count: 2 }])
    await warnSampleAccountsAtStartup({ NODE_ENV: 'production', NEXTSPARK_DEMO_MODE: 'true' }, query)
    expect(query).not.toHaveBeenCalled()
    await warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, query)
    expect(query).toHaveBeenCalled()
  })
})

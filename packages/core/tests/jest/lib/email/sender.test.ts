/**
 * The sender of every provider: EMAIL_FROM / EMAIL_FROM_NAME, with
 * RESEND_FROM_EMAIL / RESEND_FROM_NAME as the fallback (#292).
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { defaultFromHeader, resetSenderWarningForTests, resolveEmailSender } from '@/core/lib/email/sender'
import { EmailFactory } from '@/core/lib/email/factory'
import { ConsoleProvider } from '@/core/lib/email/providers/console'
import { ResendProvider } from '@/core/lib/email/providers/resend'
import { SmtpProvider } from '@/core/lib/email/providers/smtp'

describe('resolveEmailSender', () => {
  test('EMAIL_FROM and EMAIL_FROM_NAME set the sender', () => {
    expect(resolveEmailSender({ EMAIL_FROM: 'auth@example.com', EMAIL_FROM_NAME: 'My App' })).toEqual({
      address: 'auth@example.com',
      addressVariable: 'EMAIL_FROM',
      name: 'My App',
      conflicts: [],
    })
  })

  test('RESEND_FROM_EMAIL and RESEND_FROM_NAME are the fallback', () => {
    expect(resolveEmailSender({ RESEND_FROM_EMAIL: 'auth@example.com', RESEND_FROM_NAME: 'Old' })).toEqual({
      address: 'auth@example.com',
      addressVariable: 'RESEND_FROM_EMAIL',
      name: 'Old',
      conflicts: [],
    })
  })

  test('both set and different: EMAIL_FROM wins and the conflict is named', () => {
    const sender = resolveEmailSender({
      EMAIL_FROM: 'new@example.com',
      RESEND_FROM_EMAIL: 'old@example.com',
      EMAIL_FROM_NAME: 'New',
      RESEND_FROM_NAME: 'Old',
    })
    expect(sender).toMatchObject({ address: 'new@example.com', addressVariable: 'EMAIL_FROM', name: 'New' })
    expect(sender.conflicts).toEqual(['EMAIL_FROM and RESEND_FROM_EMAIL', 'EMAIL_FROM_NAME and RESEND_FROM_NAME'])
  })

  test('both set to the same value is no conflict', () => {
    expect(resolveEmailSender({ EMAIL_FROM: 'a@example.com', RESEND_FROM_EMAIL: ' a@example.com ' }).conflicts).toEqual([])
  })

  test('neither set: no address, and EMAIL_FROM is the variable to set', () => {
    expect(resolveEmailSender({})).toEqual({ address: undefined, addressVariable: 'EMAIL_FROM', name: undefined, conflicts: [] })
  })

  test('an empty or blank value counts as unset', () => {
    expect(resolveEmailSender({ EMAIL_FROM: ' ', RESEND_FROM_EMAIL: 'auth@example.com' })).toMatchObject({
      address: 'auth@example.com',
      addressVariable: 'RESEND_FROM_EMAIL',
      conflicts: [],
    })
  })

  test('the name falls back on its own', () => {
    expect(resolveEmailSender({ EMAIL_FROM: 'a@example.com', RESEND_FROM_NAME: 'Old' }).name).toBe('Old')
  })
})

describe('the providers read the sender', () => {
  const saved = { ...process.env }
  let warn: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (/^(SMTP_|RESEND_|EMAIL_)/.test(key)) delete process.env[key]
    }
    EmailFactory.reset()
    resetSenderWarningForTests()
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => {
    process.env = { ...saved }
    EmailFactory.reset()
    jest.restoreAllMocks()
  })

  const defaultFrom = (provider: unknown) => (provider as { defaultFrom: string }).defaultFrom

  test.each([
    ['resend', { RESEND_API_KEY: 're_1234567890abcdefghijklmnop' }, ResendProvider],
    ['smtp', { SMTP_HOST: 'smtp.example.org' }, SmtpProvider],
    ['console', {}, ConsoleProvider],
  ])('%s sends from EMAIL_FROM', (provider, env, type) => {
    Object.assign(process.env, env, { EMAIL_PROVIDER: provider, EMAIL_FROM: 'auth@example.com', EMAIL_FROM_NAME: 'My App' })
    const created = EmailFactory.create()
    expect(created).toBeInstanceOf(type)
    expect(defaultFrom(created)).toBe('My App <auth@example.com>')
  })

  test.each([
    ['resend', { RESEND_API_KEY: 're_1234567890abcdefghijklmnop' }],
    ['smtp', { SMTP_HOST: 'smtp.example.org' }],
    ['console', {}],
  ])('%s still sends from RESEND_FROM_EMAIL when EMAIL_FROM is unset', (provider, env) => {
    Object.assign(process.env, env, { EMAIL_PROVIDER: provider, RESEND_FROM_EMAIL: 'old@example.com' })
    expect(defaultFrom(EmailFactory.create())).toBe('App <old@example.com>')
    expect(warn).not.toHaveBeenCalled()
  })

  test('the console provider prints the sender', async () => {
    Object.assign(process.env, { EMAIL_PROVIDER: 'console', EMAIL_FROM: 'auth@example.com' })
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    await EmailFactory.create().send({ to: 'a@example.org', subject: 's', text: 't' })
    expect(log).toHaveBeenCalledWith('✉️  From:', 'App <auth@example.com>')
  })

  test('without a sender Resend keeps its testing sender, and SMTP refuses to start', () => {
    Object.assign(process.env, { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_1234567890abcdefghijklmnop' })
    expect(defaultFrom(EmailFactory.create())).toBe('App <onboarding@resend.dev>')
    EmailFactory.reset()
    Object.assign(process.env, { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.org' })
    expect(() => EmailFactory.create()).toThrow('EMAIL_FROM is required when using the SMTP provider')
  })

  test('both set and different: EMAIL_FROM wins, one warning per process naming the variables, never the values', () => {
    Object.assign(process.env, {
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.org',
      EMAIL_FROM: 'new@example.com',
      RESEND_FROM_EMAIL: 'old@example.com',
    })
    expect(defaultFrom(EmailFactory.create())).toBe('App <new@example.com>')
    EmailFactory.reset()
    EmailFactory.create()
    defaultFromHeader()

    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0][0])
    expect(message).toContain('EMAIL_FROM and RESEND_FROM_EMAIL')
    expect(message).not.toContain('new@example.com')
    expect(message).not.toContain('old@example.com')
  })
})

describe('ResendProvider bounds the API call', () => {
  afterEach(() => jest.restoreAllMocks())

  test('the send carries an abort signal to fetch, and an aborted request is a failed send', async () => {
    // An already-aborted signal stands in for AbortSignal.timeout(10 s) firing
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort())
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      init?.signal?.throwIfAborted()
      return new Response('{}')
    })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await new ResendProvider('re_1234567890abcdefghijklmnop', 'App <a@example.com>')
      .send({ to: 'b@example.com', subject: 's', text: 't' })

    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(fetchSpy.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(response.success).toBe(false)
  })
})

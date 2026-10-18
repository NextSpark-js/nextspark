/**
 * @jest-environment node
 */
import { SmtpProvider } from '@/core/lib/email/providers/smtp'
import { EmailFactory } from '@/core/lib/email/factory'

// Real nodemailer, but with its JSON transport instead of the network; the
// config handed to createTransport and each rendered message are recorded.
const createTransport = jest.fn()
const sent: Array<{ message: string }> = []
jest.mock('nodemailer', () => {
  const actual = jest.requireActual('nodemailer')
  return {
    ...actual,
    createTransport: (config: unknown) => {
      createTransport(config)
      const transporter = actual.createTransport({ jsonTransport: true })
      const sendMail = transporter.sendMail.bind(transporter)
      transporter.sendMail = async (mail: unknown) => {
        const info = await sendMail(mail)
        sent.push(info)
        return info
      }
      return transporter
    },
  }
})

const config = { host: 'smtp.example.org', port: 587, secure: false, auth: { user: 'mailer', pass: 'pw' } }

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
  createTransport.mockClear()
  sent.length = 0
})

describe('SmtpProvider', () => {
  test('sends from, to, subject, html and text through nodemailer', async () => {
    const provider = new SmtpProvider(config, 'App <no-reply@example.org>')

    const response = await provider.send({
      to: ['a@example.org', 'b@example.org'],
      subject: 'Your code',
      html: '<p>123456</p>',
      text: '123456',
      replyTo: 'help@example.org',
      headers: { 'X-Test': '1' },
    })

    expect(response.success).toBe(true)
    expect(response.id).toEqual(expect.stringContaining('@'))
    expect(createTransport).toHaveBeenCalledWith(config)
    expect(JSON.parse(sent[0].message)).toMatchObject({
      from: { name: 'App', address: 'no-reply@example.org' },
      to: [{ address: 'a@example.org' }, { address: 'b@example.org' }],
      subject: 'Your code',
      html: '<p>123456</p>',
      text: '123456',
      replyTo: [{ address: 'help@example.org' }],
      headers: { 'X-Test': '1' },
    })
  })

  test('the message reaches the transport intact', async () => {
    const sendMail = jest.fn(async () => ({ messageId: '<id@example.org>' }))
    const nodemailer = jest.requireMock('nodemailer')
    const spy = jest.spyOn(nodemailer, 'createTransport').mockReturnValueOnce({ sendMail })

    const provider = new SmtpProvider(config, 'App <no-reply@example.org>')
    const response = await provider.send({ to: 'a@example.org', subject: 'Hi', html: '<b>x</b>', text: 'x' })

    expect(response).toEqual({ id: '<id@example.org>', success: true })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'App <no-reply@example.org>',
        to: 'a@example.org',
        subject: 'Hi',
        html: '<b>x</b>',
        text: 'x',
      })
    )
    spy.mockRestore()
  })

  test('a per-message from wins over the default', async () => {
    const sendMail = jest.fn(async () => ({ messageId: 'm' }))
    const nodemailer = jest.requireMock('nodemailer')
    const spy = jest.spyOn(nodemailer, 'createTransport').mockReturnValueOnce({ sendMail })

    await new SmtpProvider(config, 'App <no-reply@example.org>').send({
      from: 'Other <other@example.org>',
      to: 'a@example.org',
      subject: 'Hi',
      text: 'x',
    })

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'Other <other@example.org>' }))
    spy.mockRestore()
  })

  test('the transport is created once and reused', async () => {
    const provider = new SmtpProvider(config, 'a@example.org')
    await provider.send({ to: 'a@example.org', subject: 's', text: 't' })
    await provider.send({ to: 'a@example.org', subject: 's', text: 't' })
    expect(createTransport).toHaveBeenCalledTimes(1)
  })

  test('requires html or text', async () => {
    const response = await new SmtpProvider(config, 'a@example.org').send({ to: 'a@example.org', subject: 's' })
    expect(response).toEqual({ id: '', success: false, error: 'Either html or text content must be provided' })
  })
})

describe('EmailFactory with EMAIL_PROVIDER=smtp', () => {
  const saved = { ...process.env }
  const smtpEnv = {
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.org',
    RESEND_FROM_EMAIL: 'auth@example.org',
  }

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (/^(SMTP_|RESEND_|EMAIL_PROVIDER)/.test(key)) delete process.env[key]
    }
    EmailFactory.reset()
  })
  afterEach(() => {
    process.env = { ...saved }
    EmailFactory.reset()
  })

  test('selects the SMTP provider and sends with the default sender', async () => {
    Object.assign(process.env, smtpEnv, { RESEND_FROM_NAME: 'My App', SMTP_PORT: '2525', SMTP_SECURE: 'false' })
    const nodemailer = jest.requireMock('nodemailer')
    const sendMail = jest.fn(async () => ({ messageId: 'm' }))
    const spy = jest.spyOn(nodemailer, 'createTransport').mockReturnValueOnce({ sendMail })

    const provider = EmailFactory.create()
    expect(provider).toBeInstanceOf(SmtpProvider)
    await provider.send({ to: 'a@example.org', subject: 's', text: 't' })

    expect(spy).toHaveBeenCalledWith({ host: 'smtp.example.org', port: 2525, secure: false })
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'My App <auth@example.org>' }))
    spy.mockRestore()
  })

  test('fails at selection time, naming the variables', () => {
    Object.assign(process.env, smtpEnv, { SMTP_HOST: '', SMTP_PORT: 'nope', SMTP_USER: 'mailer' })
    expect(() => EmailFactory.create()).toThrow(
      'SMTP email provider is misconfigured: SMTP_HOST is missing; SMTP_PORT is malformed; SMTP_PASS is missing.'
    )
  })

  test('requires a sender', () => {
    Object.assign(process.env, smtpEnv, { RESEND_FROM_EMAIL: '' })
    expect(() => EmailFactory.create()).toThrow('RESEND_FROM_EMAIL is required when using the SMTP provider')
  })

  test('auto never selects SMTP', () => {
    Object.assign(process.env, smtpEnv, { EMAIL_PROVIDER: 'auto', NODE_ENV: 'production' })
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(EmailFactory.create()).not.toBeInstanceOf(SmtpProvider)
  })
})

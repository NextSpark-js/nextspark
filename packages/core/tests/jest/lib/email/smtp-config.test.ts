import { findSmtpProblems, parseSmtpConfig } from '@/core/lib/email/smtp-config'

describe('parseSmtpConfig', () => {
  test('host alone is enough; port follows secure', () => {
    expect(parseSmtpConfig({ host: 'smtp.example.org' })).toEqual({ host: 'smtp.example.org', port: 587, secure: false })
    expect(parseSmtpConfig({ host: 'smtp.example.org', secure: 'true' })).toEqual({
      host: 'smtp.example.org',
      port: 465,
      secure: true,
    })
  })

  test('reads every variable', () => {
    expect(
      parseSmtpConfig({ host: ' mail.example.org ', port: '2525', secure: 'false', user: 'mailer', pass: 'a b' })
    ).toEqual({
      host: 'mail.example.org',
      port: 2525,
      secure: false,
      auth: { user: 'mailer', pass: 'a b' },
      requireTLS: true,
    })
  })

  test('credentials to a remote host require STARTTLS unless the connection is TLS from the start', () => {
    const creds = { user: 'mailer', pass: 'pw' }
    expect(parseSmtpConfig({ host: 'smtp.example.org', port: '587', ...creds }).requireTLS).toBe(true)
    expect(parseSmtpConfig({ host: 'smtp.example.org', port: '587', secure: 'false', ...creds }).requireTLS).toBe(true)
    expect(parseSmtpConfig({ host: 'smtp.example.org', secure: 'true', ...creds }).requireTLS).toBeUndefined()
    expect(parseSmtpConfig({ host: 'smtp.example.org', port: '465', ...creds }).requireTLS).toBeUndefined()
  })

  test('no credentials, no requireTLS (a relay that does not authenticate keeps working)', () => {
    expect(parseSmtpConfig({ host: 'smtp.example.org', port: '25' }).requireTLS).toBeUndefined()
  })

  test.each(['localhost', '127.0.0.1', '127.1.2.3', '::1'])('loopback host %s may authenticate in clear text', (host) => {
    expect(parseSmtpConfig({ host, user: 'mailer', pass: 'pw' }).requireTLS).toBeUndefined()
  })

  test.each(['127.0.0.1.example.org', '128.0.0.1', 'localhost.example.org', '10.0.0.5'])(
    'non-loopback host %s requires STARTTLS',
    (host) => {
      expect(parseSmtpConfig({ host, user: 'mailer', pass: 'pw' }).requireTLS).toBe(true)
    }
  )

  test('SMTP_SECURE unset: TLS from the start on port 465, STARTTLS elsewhere', () => {
    expect(parseSmtpConfig({ host: 'h.example.org', port: '465' })).toEqual({ host: 'h.example.org', port: 465, secure: true })
    expect(parseSmtpConfig({ host: 'h.example.org', port: '587' }).secure).toBe(false)
    expect(parseSmtpConfig({ host: 'h.example.org', port: '465', secure: 'false' }).secure).toBe(false)
  })

  test('host may contain underscores (compose service names) and an unbracketed IPv6 address', () => {
    expect(parseSmtpConfig({ host: 'mail_relay' }).host).toBe('mail_relay')
    expect(parseSmtpConfig({ host: '2001:db8::25' }).host).toBe('2001:db8::25')
    expect(() => parseSmtpConfig({ host: '[::1]' })).toThrow('SMTP_HOST is malformed')
  })

  test('blank values count as unset', () => {
    expect(parseSmtpConfig({ host: 'h.example.org', port: '', secure: ' ', user: '', pass: '' })).toEqual({
      host: 'h.example.org',
      port: 587,
      secure: false,
    })
  })

  test.each([
    [{}, ['SMTP_HOST is missing']],
    [{ host: 'bad host!' }, ['SMTP_HOST is malformed']],
    [{ host: 'h.example.org', port: 'abc' }, ['SMTP_PORT is malformed']],
    [{ host: 'h.example.org', port: '0' }, ['SMTP_PORT is malformed']],
    [{ host: 'h.example.org', port: '65536' }, ['SMTP_PORT is malformed']],
    [{ host: 'h.example.org', port: '25.5' }, ['SMTP_PORT is malformed']],
    [{ host: 'h.example.org', secure: 'yes' }, ['SMTP_SECURE is malformed']],
    [{ host: 'h.example.org', secure: 'TRUE' }, ['SMTP_SECURE is malformed']],
    [{ host: 'h.example.org', user: 'mailer' }, ['SMTP_PASS is missing']],
    [{ host: 'h.example.org', pass: 'secret-pass-value' }, ['SMTP_USER is missing']],
    [{ port: 'x', secure: 'maybe' }, ['SMTP_HOST is missing', 'SMTP_PORT is malformed', 'SMTP_SECURE is malformed']],
  ])('rejects %j naming the variables', (input, expected) => {
    expect(() => parseSmtpConfig(input)).toThrow(`SMTP email provider is misconfigured: ${expected.join('; ')}.`)
  })

  test('errors never carry values', () => {
    const input = { host: 'bad host!', port: 'port-secret', secure: 'secure-secret', pass: 'pass-secret' }
    let message = ''
    try {
      parseSmtpConfig(input)
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('SMTP_HOST')
    for (const value of Object.values(input)) expect(message).not.toContain(value)
  })
})

describe('findSmtpProblems', () => {
  test('a complete configuration has no problems', () => {
    expect(findSmtpProblems({ host: 'h.example.org', port: '465', secure: 'true', user: 'u', pass: 'p' })).toEqual([])
  })
})

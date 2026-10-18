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
    ).toEqual({ host: 'mail.example.org', port: 2525, secure: false, auth: { user: 'mailer', pass: 'a b' } })
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

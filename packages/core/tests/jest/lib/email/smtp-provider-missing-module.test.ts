/**
 * @jest-environment node
 */
import { SmtpProvider } from '@/core/lib/email/providers/smtp'

const config = { host: 'smtp.example.org', port: 587, secure: false }
const message = { to: 'a@example.org', subject: 's', text: 't' }

const importFails = (error: Error) => {
  jest.doMock('nodemailer', () => {
    throw error
  })
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
})

describe('SmtpProvider without nodemailer installed', () => {
  test('send and verify fail with the install command', async () => {
    importFails(Object.assign(new Error("Cannot find module 'nodemailer'"), { code: 'MODULE_NOT_FOUND' }))
    const provider = new SmtpProvider(config, 'a@example.org')

    const response = await provider.send(message)

    expect(response).toEqual({
      id: '',
      success: false,
      error: expect.stringMatching(/^EMAIL_PROVIDER=smtp needs the nodemailer package, which is not installed or not included in the deployment\. Run `pnpm add nodemailer`;.*13-email-providers\.md\.$/),
    })
    expect(await provider.verify()).toBe(false)
  })

  test('ERR_MODULE_NOT_FOUND (native ESM) gets the same error', async () => {
    importFails(
      Object.assign(new Error("Cannot find package 'nodemailer' imported from /app/dist/smtp.js"), {
        code: 'ERR_MODULE_NOT_FOUND',
      })
    )
    const response = await new SmtpProvider(config, 'a@example.org').send(message)
    expect(response.error).toContain('Run `pnpm add nodemailer`')
  })

  test('another missing module is not reworded', async () => {
    importFails(Object.assign(new Error("Cannot find module 'libmime'"), { code: 'MODULE_NOT_FOUND' }))
    const response = await new SmtpProvider(config, 'a@example.org').send(message)
    expect(response.error).toBe("Cannot find module 'libmime'")
  })
})

describe('a failed load is not cached', () => {
  test('the first send fails with MODULE_NOT_FOUND, the second succeeds once the package is there', async () => {
    let installed = false
    const sendMail = jest.fn(async () => ({ messageId: '<m@example.org>' }))
    jest.doMock('nodemailer', () => {
      if (!installed) throw Object.assign(new Error("Cannot find module 'nodemailer'"), { code: 'MODULE_NOT_FOUND' })
      return { createTransport: () => ({ sendMail }) }
    })
    const provider = new SmtpProvider(config, 'a@example.org')

    expect((await provider.send(message)).success).toBe(false)
    installed = true
    jest.resetModules()
    const second = await provider.send(message)

    expect(second).toEqual({ id: '<m@example.org>', success: true })
  })
})

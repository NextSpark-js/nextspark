/**
 * A sign-in code that could not be emailed: the code route answers 503
 * EMAIL_SEND_FAILED instead of 200, for a provider that answers
 * { success: false } and for one that throws, without the provider's text.
 *
 * Better Auth is mocked the way 1.7.7's emailOTP route behaves with
 * advanced.backgroundTasks: it hands the send to the background handler with
 * the error caught and answers { success: true } without waiting.
 * tests/node/otp-send-failures.test.ts runs the same against the real library.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { NextRequest } from 'next/server'

const mockEmailOTP = jest.fn((options: unknown) => ({ id: 'email-otp', options }))
const mockSend = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.mock('better-auth', () => ({ betterAuth: () => ({ api: { getSession: jest.fn() }, $Infer: {} }) }))
jest.mock('better-auth/plugins', () => ({ emailOTP: (options: unknown) => mockEmailOTP(options) }))
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({ EmailFactory: { create: () => ({ send: mockSend }) } }))
jest.mock('@/core/lib/email/send', () => ({ sendOtpVerificationEmail: async () => ({ subject: 's', html: 'h' }) }))
jest.mock('@/core/lib/auth/runtime-readiness', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/core/lib/auth/runtime-readiness'),
  isRuntimeEmailAvailable: () => true,
  getAuthReadinessResponse: async () => null,
}))
jest.mock('@/core/lib/api/helpers', () => ({
  handleCorsPreflightRequest: jest.fn(),
  addCorsHeaders: jest.fn(async (response: Response) => response),
  wrapAuthHandlerWithCors: async (handler: () => Promise<Response>) => handler(),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  checkDistributedRateLimit: async () => ({ allowed: true, limit: 5, resetTime: 0 }),
}))
jest.mock('@/core/lib/services', () => ({ TeamService: { isBootstrapDone: async () => false } }))
jest.mock('@/core/lib/auth/security-notifications', () => ({ dispatchSecurityNotificationsForRequest: async () => undefined }))

type SendOtp = (data: { email: string; otp: string; type: string }) => Promise<void>
let sendVerificationOTP: SendOtp
let background: Promise<unknown>[] = []

// Better Auth 1.7.7: runInBackgroundOrAwait(promise) with backgroundTasks set
jest.mock('better-auth/next-js', () => ({
  nextCookies: () => ({ id: 'next-cookies' }),
  toNextJsHandler: () => ({
    GET: jest.fn(),
    POST: async (request: Request) => {
      const { email, type } = await request.json() as { email: string; type: string }
      background.push(sendVerificationOTP({ email, otp: '123456', type }).catch(() => undefined))
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  }),
}))

import { POST } from '@/app/api/auth/[...all]/route'

function sendCode(email: string, type = 'sign-in') {
  const request = new NextRequest('https://example.com/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, type }),
  }) as NextRequest & { clone: () => NextRequest }
  request.clone = () => request // the jsdom-free next/server mock has no clone()
  return POST(request)
}

describe('POST /api/auth/email-otp/send-verification-otp when the email cannot be sent', () => {
  let consoleError: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    sendVerificationOTP = (mockEmailOTP.mock.calls[0][0] as { sendVerificationOTP: SendOtp }).sendVerificationOTP
    background = []
    mockSend.mockReset()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(async () => {
    await Promise.all(background)
    jest.restoreAllMocks()
  })

  test('a sent code keeps Better Auth\'s 200', async () => {
    mockSend.mockResolvedValue({ id: 'e1', success: true })
    const response = await sendCode('someone@example.com')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  test.each([
    ['answers { success: false }', () => mockSend.mockResolvedValue({ id: '', success: false, error: 'provider detail: domain not verified' })],
    ['throws', () => mockSend.mockRejectedValue(new Error('provider detail: domain not verified'))],
  ])('a provider that %s: 503 EMAIL_SEND_FAILED, the provider text only in the server log', async (_name, fail) => {
    fail()
    const response = await sendCode('someone@example.com')
    const text = await response.text()

    expect(response.status).toBe(503)
    expect(JSON.parse(text)).toEqual({ code: 'EMAIL_SEND_FAILED', message: 'The email could not be sent. Try again later.' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(text).not.toContain('provider detail')
    expect(consoleError.mock.calls.flat().map(String).join('\n')).toContain('provider detail')
  })

  test('the answer does not depend on the address: Better Auth sends a sign-in code to known and unknown ones alike', async () => {
    mockSend.mockResolvedValue({ id: '', success: false, error: 'down' })
    const known = await sendCode('owner@example.com')
    const unknown = await sendCode('nobody@example.com')
    expect([known.status, await known.text()]).toEqual([unknown.status, await unknown.text()])
  })

  test('verification and password-reset codes keep the 200, so their failure does not reveal an account', async () => {
    mockSend.mockResolvedValue({ id: '', success: false, error: 'down' })
    expect((await sendCode('owner@example.com', 'email-verification')).status).toBe(200)
    expect((await sendCode('owner@example.com', 'forget-password')).status).toBe(200)
    // still logged
    expect(consoleError.mock.calls.flat().map(String).join('\n')).toContain('down')
  })
})

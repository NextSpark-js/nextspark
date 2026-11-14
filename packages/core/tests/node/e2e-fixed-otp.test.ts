/**
 * #448: NEXTSPARK_E2E_FIXED_OTP against a real Better Auth 1.7 emailOTP plugin (memory adapter). With the variable,
 * the code a sign-in request issues is the fixed one and signs in; without it, the same digits are refused; in
 * production the options throw before an auth instance exists. Failed attempts still count. #460: a production build
 * with NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT=preview serves it, and VERCEL_ENV=production refuses it whatever is set.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { emailOTP } from 'better-auth/plugins'
import { E2E_FIXED_OTP_DEPLOYMENT_ENV, E2E_FIXED_OTP_ENV, e2eFixedOtpPluginOptions, e2eFixedOtpRefusal, resolveE2eFixedOtp } from '../../src/lib/auth/e2e-fixed-otp'

const ORIGIN = 'http://localhost:3000'
const CODE = '482913'

function makeAuth(env: Record<string, string | undefined>) {
  const sent: string[] = []
  const auth = betterAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    secret: 'a-test-secret-with-enough-entropy-0123456789',
    baseURL: ORIGIN,
    rateLimit: { enabled: false },
    plugins: [emailOTP({
      async sendVerificationOTP({ otp }) { sent.push(otp) },
      otpLength: 6,
      expiresIn: 300,
      ...e2eFixedOtpPluginOptions(env, 6),
    })],
  })
  return { auth, sent }
}

const post = (auth: ReturnType<typeof makeAuth>['auth'], path: string, body: object) => auth.handler(new Request(`${ORIGIN}/api/auth${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify(body),
}))

async function requestAndSignIn(env: Record<string, string | undefined>, otp: string) {
  const { auth, sent } = makeAuth(env)
  const email = 'e2e@example.test'
  assert.equal((await post(auth, '/email-otp/send-verification-otp', { email, type: 'sign-in' })).status, 200)
  const response = await post(auth, '/sign-in/email-otp', { email, otp })
  return { response, sent }
}

test('with the variable the issued code is the fixed one, and it signs in', async () => {
  const { response, sent } = await requestAndSignIn({ NODE_ENV: 'test', [E2E_FIXED_OTP_ENV]: CODE }, CODE)
  assert.deepEqual(sent, [CODE])
  assert.equal(response.status, 200)
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith('better-auth.session_token=')))
})

test('without the variable the same digits do not sign in', async () => {
  for (const env of [{ NODE_ENV: 'test' }, { NODE_ENV: 'test', [E2E_FIXED_OTP_ENV]: '' }]) {
    const { response, sent } = await requestAndSignIn(env, CODE)
    assert.notEqual(sent[0], CODE)
    assert.equal(response.status, 400)
  }
})

test('failed attempts still count with the fixed code on', async () => {
  const { auth } = makeAuth({ NODE_ENV: 'test', [E2E_FIXED_OTP_ENV]: CODE })
  const email = 'e2e@example.test'
  await post(auth, '/email-otp/send-verification-otp', { email, type: 'sign-in' })
  for (let i = 0; i < 3; i++) await post(auth, '/sign-in/email-otp', { email, otp: '000000' })
  // Better Auth's default of 3 attempts: the right code no longer works for this request
  assert.equal((await post(auth, '/sign-in/email-otp', { email, otp: CODE })).status, 403)
})

test('production refuses the variable, without printing its value', () => {
  assert.throws(() => e2eFixedOtpPluginOptions({ NODE_ENV: 'production', [E2E_FIXED_OTP_ENV]: CODE }, 6), (error: Error) => {
    assert.match(error.message, /production refuses it/)
    assert.ok(!error.message.includes(CODE))
    return true
  })
})

test('a production build refuses the variable even when the env it is handed has no NODE_ENV', () => {
  const saved = process.env.NODE_ENV
  process.env.NODE_ENV = 'production' // what Next inlines in a production build
  try {
    assert.throws(() => e2eFixedOtpPluginOptions({ [E2E_FIXED_OTP_ENV]: CODE }, 6), /production refuses it/)
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = saved
  }
})

test('a code that is not otpLength digits is refused; unset is off', () => {
  assert.throws(() => resolveE2eFixedOtp({ [E2E_FIXED_OTP_ENV]: '12345' }, 6), /exactly 6 digits/)
  assert.throws(() => resolveE2eFixedOtp({ [E2E_FIXED_OTP_ENV]: '12345a' }, 6), /exactly 6 digits/)
  assert.equal(resolveE2eFixedOtp({}, 6), null)
  assert.deepEqual(e2eFixedOtpPluginOptions({ NODE_ENV: 'production' }, 6), {})
})

// #460: a production build serves the code only with the preview signal, and never on a production deployment
const PREVIEW = { [E2E_FIXED_OTP_DEPLOYMENT_ENV]: 'preview' }

async function withBuildNodeEnv<T>(fn: () => T | Promise<T>): Promise<T> {
  const saved = process.env.NODE_ENV
  process.env.NODE_ENV = 'production' // what Next inlines in a production build
  try {
    return await fn()
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = saved
  }
}

test('a production build with the preview signal issues the fixed code, and it signs in (#460)', async () => {
  const { response, sent } = await withBuildNodeEnv(() => requestAndSignIn({ NODE_ENV: 'production', [E2E_FIXED_OTP_ENV]: CODE, ...PREVIEW }, CODE))
  assert.deepEqual(sent, [CODE])
  assert.equal(response.status, 200)
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith('better-auth.session_token=')))
})

test('a production build without the exact preview signal refuses the code, also started with NODE_ENV=test (#460)', async () => {
  await withBuildNodeEnv(() => {
    for (const value of [undefined, '', 'Preview', 'true', '1', 'preview ', 'qa']) {
      for (const NODE_ENV of ['production', 'test']) {
        const env = { NODE_ENV, [E2E_FIXED_OTP_ENV]: CODE, [E2E_FIXED_OTP_DEPLOYMENT_ENV]: value }
        assert.throws(() => e2eFixedOtpPluginOptions(env, 6), /production refuses it/, `${NODE_ENV} ${JSON.stringify(value)}`)
      }
    }
  })
})

test('VERCEL_ENV=production refuses the code even with the preview signal, in any build (#460)', async () => {
  const env = { [E2E_FIXED_OTP_ENV]: CODE, ...PREVIEW, VERCEL_ENV: 'production' }
  await withBuildNodeEnv(() => assert.throws(() => e2eFixedOtpPluginOptions({ ...env, NODE_ENV: 'production' }, 6), (error: Error) => {
    assert.match(error.message, /VERCEL_ENV=production/)
    assert.ok(!error.message.includes(CODE))
    return true
  }))
  assert.throws(() => e2eFixedOtpPluginOptions({ ...env, NODE_ENV: 'test' }, 6), /VERCEL_ENV=production/)
})

test('the decision, case by case (#460)', () => {
  assert.equal(e2eFixedOtpRefusal({}, false), null)
  assert.equal(e2eFixedOtpRefusal(PREVIEW, true), null)
  assert.equal(e2eFixedOtpRefusal({ ...PREVIEW, VERCEL_ENV: 'preview' }, true), null)
  assert.equal(e2eFixedOtpRefusal({}, true)?.code, 'E2E_FIXED_OTP_IN_PRODUCTION')
  assert.equal(e2eFixedOtpRefusal({ [E2E_FIXED_OTP_DEPLOYMENT_ENV]: 'PREVIEW' }, true)?.code, 'E2E_FIXED_OTP_IN_PRODUCTION')
  assert.equal(e2eFixedOtpRefusal({ ...PREVIEW, VERCEL_ENV: 'production' }, true)?.code, 'E2E_FIXED_OTP_ON_PRODUCTION_DEPLOYMENT')
  assert.equal(e2eFixedOtpRefusal({ VERCEL_ENV: 'production' }, false)?.code, 'E2E_FIXED_OTP_ON_PRODUCTION_DEPLOYMENT')
})

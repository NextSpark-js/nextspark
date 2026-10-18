/**
 * A sign-in code that could not be emailed, through core's real auth route and Better Auth 1.7 (no mocks), with only
 * the email provider stubbed (fixtures/registration-gates/driver.mts, `send-code` steps): the code route answers 503
 * EMAIL_SEND_FAILED instead of Better Auth's 200, the same for a known and an unknown address, without the
 * provider's text. Verification and password-reset codes, sent only to existing accounts, keep the 200.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'
const FIXTURE = path.join(CORE, 'tests/node/fixtures/registration-gates')
// The registration gates' tsconfig with plain email templates
const TSCONFIG = path.join(CORE, 'tests/node/fixtures/otp-send-failures/tsconfig.json')
const ORIGIN = 'http://localhost:5173'

type Step = { op: 'send-code'; email: string; type?: string; provider: 'ok' | 'fail' | 'throw' }
type Result = Step & { status: number; code?: string; body: string; sends: number }

function runSteps(databaseUrl: string, steps: Step[]) {
  const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(FIXTURE, 'driver.mts')], {
    cwd: CORE,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'test',
      TSX_TSCONFIG_PATH: TSCONFIG,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: 'otp-send-failures-secret-0123456789abcdef',
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_otpsendfailuresotpsendfailures',
      EMAIL_FROM: 'noreply@example.test',
      DISABLE_RATE_LIMITING: 'true',
      REGISTRATION_GATES_APP_CONFIG: JSON.stringify({ auth: { registration: { mode: 'open' }, methods: ['email-otp'] } }),
      REGISTRATION_GATES_STEPS: JSON.stringify(steps),
    },
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return { results, log: `${run.stdout}\n${run.stderr}` }
}

test('a sign-in code the provider could not send answers EMAIL_SEND_FAILED, not 200', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await owner.query(`INSERT INTO users (id, email, "emailVerified", "createdAt", "updatedAt") VALUES ('known-user', 'known@example.test', true, now(), now())`)

  const { results, log } = runSteps(ownerUrl, [
    { op: 'send-code', email: 'known@example.test', provider: 'ok' },
    { op: 'send-code', email: 'known@example.test', provider: 'fail' },
    { op: 'send-code', email: 'unknown@example.test', provider: 'fail' },
    { op: 'send-code', email: 'known@example.test', provider: 'throw' },
    { op: 'send-code', email: 'unknown@example.test', provider: 'throw' },
    { op: 'send-code', email: 'known@example.test', type: 'email-verification', provider: 'fail' },
    { op: 'send-code', email: 'known@example.test', type: 'forget-password', provider: 'fail' },
  ])
  const [sent, failKnown, failUnknown, throwKnown, throwUnknown, verification, reset] = results

  assert.equal(sent.status, 200, `${JSON.stringify(sent)}\n${log}`)
  assert.equal(sent.sends, 1)
  for (const r of [failKnown, failUnknown, throwKnown, throwUnknown]) {
    assert.equal(r.status, 503, JSON.stringify(r))
    assert.equal(r.code, 'EMAIL_SEND_FAILED', JSON.stringify(r))
    assert.equal(r.sends, 1, 'the provider was asked once')
    assert.doesNotMatch(r.body, /stub provider detail/, 'the provider text stays on the server')
  }
  // a known and an unknown address get the same answer
  assert.equal(failKnown.body, failUnknown.body)
  assert.equal(throwKnown.body, failKnown.body)
  // codes that only go to existing accounts keep Better Auth's answer; the failure is logged
  for (const r of [verification, reset]) {
    assert.equal(r.status, 200, JSON.stringify(r))
    assert.equal(r.sends, 1)
  }
  assert.match(log, /The (sign-in|email-verification|forget-password) code email could not be sent/)
  assert.match(log, /stub provider detail: domain not verified/)
  assert.match(log, /stub provider detail: connection reset/)
})

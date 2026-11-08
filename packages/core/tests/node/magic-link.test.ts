/**
 * Sign-in links through core's real auth route and Better Auth (no mocks), run by fixtures/registration-gates/driver.mts
 * against a throwaway cluster: a new and an existing user, a link used twice or out of time, a foreign destination, the
 * registration gates, a send that fails. The delivery test goes through the real SMTP provider to a fake server the
 * driver runs; the others stub the provider. The email template is a plain one (fixtures/otp-send-failures), since
 * core's render needs a Next request.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import path from 'node:path'
import pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'
const DRIVER = path.join(CORE, 'tests/node/fixtures/registration-gates/driver.mts')
const TSCONFIG = path.join(CORE, 'tests/node/fixtures/otp-send-failures/tsconfig.json')
const ORIGIN = 'http://localhost:5173'

type Step =
  | { op: 'password'; email: string }
  | { op: 'magic-send'; email: string; provider: 'ok' | 'fail' | 'throw' | 'smtp'; callbackURL?: string }
  | { op: 'magic-open'; email: string; callbackURL?: string; signupIntent?: string }
  | { op: 'wait'; email: string; ms: number }
type Result = { status: number; code?: string; location?: string; body?: string; sends?: number; link?: string; setsSession?: boolean }

const freePort = () => new Promise<number>((resolve) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address() as { port: number }
    probe.close(() => resolve(port))
  })
})

function runSteps(databaseUrl: string, auth: object, steps: Step[], extra: { smtpPort?: number; nodeEnv?: string } = {}) {
  const email = extra.smtpPort
    ? { EMAIL_PROVIDER: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(extra.smtpPort) }
    : { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_magiclinkmagiclinkmagiclink' }
  const run = spawnSync(process.execPath, ['--import', 'tsx', DRIVER], {
    cwd: CORE,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: extra.nodeEnv ?? 'test',
      TSX_TSCONFIG_PATH: TSCONFIG,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: 'magic-link-secret-0123456789abcdef0123',
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      EMAIL_FROM: 'noreply@example.test',
      DISABLE_RATE_LIMITING: 'true',
      ...email,
      REGISTRATION_GATES_APP_CONFIG: JSON.stringify({ teams: { mode: 'multi-tenant' }, auth }),
      REGISTRATION_GATES_STEPS: JSON.stringify(steps),
    },
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return results
}

const LINK = { methods: ['magic-link', 'email-password'], emailAndPassword: { enabled: true }, registration: { mode: 'open' } }
const users = async (owner: pg.Client) =>
  (await owner.query<{ email: string }>('SELECT email FROM users ORDER BY email')).rows.map(r => r.email)
const addUser = (owner: pg.Client, id: string, email: string, role = 'member') =>
  owner.query(`INSERT INTO users (id, email, "emailVerified", role, "createdAt", "updatedAt") VALUES ($1, $2, true, $3, now(), now())`, [id, email, role])

const signedIn = (r: Result, to = '/dashboard') => {
  assert.equal(r.status, 302, JSON.stringify(r))
  assert.equal(new URL(r.location!, ORIGIN).pathname, to, JSON.stringify(r))
  assert.equal(r.setsSession, true, JSON.stringify(r))
}
const refused = (r: Result, code: string) => {
  assert.equal(r.status, 302, JSON.stringify(r))
  assert.match(r.location ?? '', new RegExp(`/auth-error\\?error=${code}(&|$)`), JSON.stringify(r))
  assert.equal(r.setsSession, false, JSON.stringify(r))
}

test('a link delivered through SMTP signs in a new and an existing user, once, and a foreign destination is refused', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await addUser(owner, 'known-user', 'known@example.test')

  const smtpPort = await freePort()
  const [sentNew, openNew, reused, sentKnown, openKnown] = runSteps(ownerUrl, LINK, [
    { op: 'magic-send', email: 'new@example.test', provider: 'smtp' },
    { op: 'magic-open', email: 'new@example.test' },
    { op: 'magic-open', email: 'new@example.test' },
    { op: 'magic-send', email: 'known@example.test', provider: 'smtp', callbackURL: '/dashboard/tasks?view=mine' },
    { op: 'magic-open', email: 'known@example.test' },
  ], { smtpPort })

  // the answer says nothing about whether the address has an account
  assert.equal(sentNew.status, 200, JSON.stringify(sentNew))
  assert.equal(sentNew.sends, 1, 'the SMTP server received the message')
  assert.equal(sentKnown.body, sentNew.body)
  assert.match(sentNew.link!, /^http:\/\/localhost:5173\/api\/auth\/magic-link\/verify\?token=/)

  signedIn(openNew)
  refused(reused, 'INVALID_TOKEN')
  signedIn(openKnown, '/dashboard/tasks')
  assert.match(openKnown.location!, /[?&]view=mine/)

  assert.deepEqual(await users(owner), ['known@example.test', 'new@example.test'])
  const { rows: [created] } = await owner.query(`SELECT "emailVerified" FROM users WHERE email = 'new@example.test'`)
  assert.equal(created.emailVerified, true)
  // a new user gets a team as any other sign-up
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM teams t JOIN users u ON u.id = t."ownerId" WHERE u.email = 'new@example.test'`)).rows[0].n, 1)

  // while it waits to be used, the database holds a hash of the token and not the token
  const [pending] = runSteps(ownerUrl, LINK, [{ op: 'magic-send', email: 'known@example.test', provider: 'ok' }])
  const token = new URL(pending.link!).searchParams.get('token')!
  const { rows: stored } = await owner.query<{ identifier: string }>(`SELECT identifier FROM verification WHERE identifier LIKE 'magic-link:%'`)
  assert.equal(stored.length, 1)
  assert.ok(!stored[0].identifier.includes(token), 'the token is not stored in clear')

  // Better Auth skips its origin check when NODE_ENV is test
  const development = { nodeEnv: 'development' }
  const foreign = ['https://evil.example/x', '//evil.example/x', '/\\evil.example/x', '/%5Cevil.example/x', 'javascript:alert(1)']
  const refusedSends = runSteps(ownerUrl, LINK, foreign.map(callbackURL => ({ op: 'magic-send', email: 'known@example.test', provider: 'ok', callbackURL })), development)
  for (const r of refusedSends) {
    assert.equal(r.status, 403, JSON.stringify(r))
    assert.equal(r.sends, 0, 'no email goes out with a foreign destination')
  }

  // a link rewritten after it was sent: the destination is refused and the token stays usable
  const rewritten = runSteps(ownerUrl, LINK, [
    { op: 'magic-send', email: 'known@example.test', provider: 'ok' },
    ...foreign.map(callbackURL => ({ op: 'magic-open' as const, email: 'known@example.test', callbackURL })),
    { op: 'magic-open', email: 'known@example.test' },
  ], development)
  for (const r of rewritten.slice(1, -1)) {
    assert.equal(r.status, 302, JSON.stringify(r))
    assert.match(r.location ?? '', /^http:\/\/localhost:5173\/auth-error/, JSON.stringify(r))
    assert.equal(r.setsSession, false, JSON.stringify(r))
  }
  signedIn(rewritten.at(-1)!)
})

test('a link out of time signs nobody in and creates nothing; a suspended account gets the error page', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await addUser(owner, 'suspended-user', 'suspended@example.test', 'suspended')

  const [, , expired] = runSteps(ownerUrl, { ...LINK, magicLink: { expiresIn: 1 } }, [
    { op: 'magic-send', email: 'late@example.test', provider: 'ok' },
    { op: 'wait', email: 'late@example.test', ms: 1500 },
    { op: 'magic-open', email: 'late@example.test' },
  ])
  refused(expired, 'INVALID_TOKEN')
  assert.deepEqual(await users(owner), ['suspended@example.test'])

  const [, suspended] = runSteps(ownerUrl, LINK, [
    { op: 'magic-send', email: 'suspended@example.test', provider: 'ok' },
    { op: 'magic-open', email: 'suspended@example.test' },
  ])
  refused(suspended, 'ACCOUNT_SUSPENDED')
})

test('invitation-only: a new address needs an invitation; domain-open: the address is checked before anything is sent', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const gated = { ...LINK, registration: { mode: 'invitation-only' } }

  const [first] = runSteps(ownerUrl, gated, [{ op: 'password', email: 'first@example.test' }])
  assert.equal(first.status, 200, JSON.stringify(first))
  await owner.query(`UPDATE users SET "emailVerified" = true WHERE email = 'first@example.test'`)
  await owner.query(
    `INSERT INTO team_invitations ("teamId", email, role, token, "invitedBy", "expiresAt")
     SELECT id, 'invited@example.test', 'member', 'token-link', "ownerId", now() + interval '7 days' FROM teams LIMIT 1`,
  )

  const results = runSteps(ownerUrl, gated, [
    { op: 'magic-send', email: 'stranger@example.test', provider: 'ok' },
    { op: 'magic-open', email: 'stranger@example.test' },
    { op: 'magic-send', email: 'invited@example.test', provider: 'ok' },
    { op: 'magic-open', email: 'invited@example.test' },
    { op: 'magic-send', email: 'first@example.test', provider: 'ok' },
    { op: 'magic-open', email: 'first@example.test' },
  ])
  // the send cannot tell who may sign up without saying who has an account
  assert.equal(results[0].status, 200, JSON.stringify(results[0]))
  assert.equal(results[2].body, results[0].body)
  refused(results[1], 'SIGNUP_RESTRICTED')
  signedIn(results[3])
  signedIn(results[5])
  assert.deepEqual(await users(owner), ['first@example.test', 'invited@example.test'])
  // the invited account waits for its invitation instead of getting a team of its own
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM teams')).rows[0].n, 1)

  const domains = { ...LINK, registration: { mode: 'domain-open', allowedDomains: ['example.test'] } }
  const [outside, inside, opened] = runSteps(ownerUrl, domains, [
    { op: 'magic-send', email: 'someone@elsewhere.test', provider: 'ok' },
    { op: 'magic-send', email: 'member@example.test', provider: 'ok' },
    { op: 'magic-open', email: 'member@example.test' },
  ])
  assert.deepEqual([outside.status, outside.code, outside.sends], [403, 'DOMAIN_NOT_ALLOWED', 0], JSON.stringify(outside))
  assert.equal(inside.status, 200, JSON.stringify(inside))
  signedIn(opened)
})

test('a send the provider could not do answers EMAIL_SEND_FAILED for any address; the signup intent reaches the new account; an app that does not list the method serves nothing', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await addUser(owner, 'known-user', 'known@example.test')

  const [failKnown, failUnknown, throwKnown] = runSteps(ownerUrl, LINK, [
    { op: 'magic-send', email: 'known@example.test', provider: 'fail' },
    { op: 'magic-send', email: 'unknown@example.test', provider: 'fail' },
    { op: 'magic-send', email: 'known@example.test', provider: 'throw' },
  ])
  for (const r of [failKnown, failUnknown, throwKnown]) {
    assert.deepEqual([r.status, r.code, r.sends], [503, 'EMAIL_SEND_FAILED', 1], JSON.stringify(r))
    assert.doesNotMatch(r.body!, /stub provider detail/, 'the provider text stays on the server')
  }
  assert.equal(failKnown.body, failUnknown.body)
  assert.equal(failKnown.body, throwKnown.body)

  const intent = { ...LINK, signupIntent: { enabled: true, roleMap: { client: 'member' } } }
  const [, opened] = runSteps(ownerUrl, intent, [
    { op: 'magic-send', email: 'client@example.test', provider: 'ok' },
    { op: 'magic-open', email: 'client@example.test', signupIntent: 'client' },
  ])
  signedIn(opened)
  const { rows } = await owner.query(`SELECT m.role FROM team_members m JOIN users u ON u.id = m."userId" WHERE u.email = 'client@example.test'`)
  assert.deepEqual(rows, [{ role: 'member' }])

  const [notListed] = runSteps(ownerUrl, { ...LINK, methods: ['email-otp'] }, [{ op: 'magic-send', email: 'known@example.test', provider: 'ok' }])
  assert.deepEqual([notListed.status, notListed.sends], [404, 0], JSON.stringify(notListed))
})

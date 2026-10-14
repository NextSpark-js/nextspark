/**
 * The registration gates on core's real auth routes and Better Auth (Jest maps better-auth to a mock): password
 * sign-up, a first email-code sign-in, signup-with-invite and the Google callback, run by
 * fixtures/registration-gates/driver.mts against a throwaway cluster with core's migrations. Only Google's token
 * exchange is stubbed.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'
const FIXTURE = path.join(CORE, 'tests/node/fixtures/registration-gates')
const ORIGIN = 'http://localhost:5173'

type Step = { op: 'password'; email: string; inviteToken?: string } | { op: 'otp'; email: string } | { op: 'google'; email: string; emailVerified?: boolean } | { op: 'invite'; email: string; token: string }
type Result = Step & { status: number; code?: string; location?: string }

function runSteps(databaseUrl: string, teams: string, steps: Step[]): Result[] {
  const appConfig = {
    teams: { mode: teams },
    auth: {
      registration: { mode: 'invitation-only' },
      methods: ['email-otp', 'email-password', 'google'],
      emailAndPassword: { enabled: true },
    },
  }
  const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(FIXTURE, 'driver.mts')], {
    cwd: CORE,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'test',
      TSX_TSCONFIG_PATH: path.join(FIXTURE, 'tsconfig.json'),
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: 'registration-gates-secret-0123456789abcdef',
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      GOOGLE_CLIENT_ID: '1234567890-registrationgates.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'registration-gates-google-secret',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_registrationgatesregistrationgates',
      RESEND_FROM_EMAIL: 'noreply@example.test',
      DISABLE_RATE_LIMITING: 'true',
      REGISTRATION_GATES_APP_CONFIG: JSON.stringify(appConfig),
      REGISTRATION_GATES_STEPS: JSON.stringify(steps),
    },
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return results
}

const users = async (owner: pg.Client) =>
  (await owner.query<{ email: string }>('SELECT email FROM users ORDER BY email')).rows.map(r => r.email)

async function invite(owner: pg.Client, email: string, token: string, expired = false) {
  await owner.query(
    `INSERT INTO team_invitations ("teamId", email, role, token, "invitedBy", "expiresAt")
     SELECT id, $1, 'member', $2, "ownerId", now() + ($3 || ' days')::interval FROM teams ORDER BY "createdAt" LIMIT 1`,
    [email, token, expired ? '-1' : '7'],
  )
}

const refused = (r: Result) => r.code === 'SIGNUP_RESTRICTED' || r.location?.includes('error=SIGNUP_RESTRICTED')

test('multi-tenant invitation-only: the first sign-up bootstraps, then sign-up needs an invitation', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)

  // empty database: the first sign-up is the bootstrap and gets its own (not global) team
  const [first] = runSteps(ownerUrl, 'multi-tenant', [{ op: 'password', email: 'first@example.test' }])
  assert.equal(first.status, 200, JSON.stringify(first))
  assert.deepEqual((await owner.query('SELECT "isGlobal" FROM teams')).rows, [{ isGlobal: false }])

  // one team exists: no invitation, no account
  await invite(owner, 'invited-otp@example.test', 'token-otp')
  await invite(owner, 'invited-password@example.test', 'token-password')
  const results = runSteps(ownerUrl, 'multi-tenant', [
    { op: 'password', email: 'stranger-password@example.test' },
    { op: 'otp', email: 'stranger-otp@example.test' },
    { op: 'google', email: 'stranger-google@example.test' },
    // a pending invitation proves nothing about who posts its address with a password: that goes through signup-with-invite
    { op: 'password', email: 'invited-password@example.test' },
    // the code proves the address, so an invited address signs up with it
    { op: 'otp', email: 'invited-otp@example.test' },
  ])
  for (const r of results.slice(0, 4)) assert.ok(refused(r), `refused: ${JSON.stringify(r)}`)
  assert.equal(results[4].status, 200, JSON.stringify(results[4]))
  assert.deepEqual(await users(owner), ['first@example.test', 'invited-otp@example.test'])
  // the invited account waits for its invitation instead of getting a team of its own
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM teams')).rows[0].n, 1)
})

test('single-tenant invitation-only: unchanged, the global team closes sign-up', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)

  const [first] = runSteps(ownerUrl, 'single-tenant', [{ op: 'password', email: 'first@example.test' }])
  assert.equal(first.status, 200, JSON.stringify(first))
  assert.deepEqual((await owner.query('SELECT "isGlobal" FROM teams')).rows, [{ isGlobal: true }])

  await invite(owner, 'invited-otp@example.test', 'token-otp')
  const results = runSteps(ownerUrl, 'single-tenant', [
    { op: 'password', email: 'stranger-password@example.test' },
    { op: 'otp', email: 'stranger-otp@example.test' },
    { op: 'otp', email: 'invited-otp@example.test' },
  ])
  assert.ok(refused(results[0]) && refused(results[1]), JSON.stringify(results))
  assert.equal(results[2].status, 200, JSON.stringify(results[2]))
  assert.deepEqual(await users(owner), ['first@example.test', 'invited-otp@example.test'])
})

test('signup-with-invite with a password: a valid invitation creates the account in the invited team, an unknown or expired token creates nothing', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  runSteps(ownerUrl, 'multi-tenant', [{ op: 'password', email: 'first@example.test' }])
  await invite(owner, 'invited@example.test', 'token-valid')
  await invite(owner, 'late@example.test', 'token-expired', true)

  const results = runSteps(ownerUrl, 'multi-tenant', [
    { op: 'invite', email: 'invited@example.test', token: 'token-valid' },
    { op: 'invite', email: 'nobody@example.test', token: 'token-unknown' },
    { op: 'invite', email: 'late@example.test', token: 'token-expired' },
    // a direct password sign-up carrying a token is refused (here by the route gate; the plugin's own check is in its Jest test)
    { op: 'password', email: 'late@example.test', inviteToken: 'token-expired' },
  ])
  assert.equal(results[0].status, 201, JSON.stringify(results[0]))
  assert.deepEqual([results[1].status, results[1].code], [404, 'INVITATION_NOT_FOUND'])
  assert.deepEqual([results[2].status, results[2].code], [410, 'INVITATION_EXPIRED'])
  assert.ok(refused(results[3]), JSON.stringify(results[3]))

  assert.deepEqual(await users(owner), ['first@example.test', 'invited@example.test'])
  const { rows } = await owner.query(`
    SELECT t."ownerId" = f.id AS "firstsTeam", m.role, i.status FROM team_members m
    JOIN users u ON u.id = m."userId" JOIN teams t ON t.id = m."teamId"
    JOIN users f ON f.email = 'first@example.test' JOIN team_invitations i ON i.token = 'token-valid'
    WHERE u.email = 'invited@example.test'`)
  assert.deepEqual(rows, [{ firstsTeam: true, role: 'member', status: 'accepted' }])
})

for (const teams of ['single-tenant', 'multi-tenant']) {
  test(`${teams} invitation-only: the Google callback signs in an existing user and redirects a new address to the error page`, { skip, timeout: 300000 }, async t => {
    const { owner, ownerUrl } = await cutoverDatabase(t)
    // the first user bootstraps with Google
    const [first] = runSteps(ownerUrl, teams, [{ op: 'google', email: 'first@example.test' }])
    assert.equal(first.status, 302, JSON.stringify(first))
    assert.ok(!first.location?.includes('auth-error'), JSON.stringify(first))

    await invite(owner, 'invited@example.test', 'token-google')
    await invite(owner, 'unverified@example.test', 'token-unverified')
    const [again, stranger, unverified, invited] = runSteps(ownerUrl, teams, [
      { op: 'google', email: 'first@example.test' },
      { op: 'google', email: 'stranger@example.test' },
      // an invited address the provider has not verified proves nothing
      { op: 'google', email: 'unverified@example.test', emailVerified: false },
      { op: 'google', email: 'invited@example.test' },
    ])
    // the existing user signs in as usual
    assert.equal(again.status, 302, JSON.stringify(again))
    assert.ok(!again.location?.includes('auth-error'), JSON.stringify(again))
    // a new address without an invitation goes to the error page every other registration refusal uses
    assert.equal(stranger.status, 302, JSON.stringify(stranger))
    assert.match(stranger.location ?? '', /\/auth-error\?error=SIGNUP_RESTRICTED(&|$)/)
    assert.equal(unverified.status, 302, JSON.stringify(unverified))
    assert.match(unverified.location ?? '', /\/auth-error\?error=SIGNUP_RESTRICTED(&|$)/)
    // an invited, verified address signs up
    assert.equal(invited.status, 302, JSON.stringify(invited))
    assert.ok(!invited.location?.includes('auth-error'), JSON.stringify(invited))
    assert.deepEqual(await users(owner), ['first@example.test', 'invited@example.test'])
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM session s JOIN users u ON u.id = s."userId" WHERE u.email = 'first@example.test'`)).rows[0].n, 2)
  })
}

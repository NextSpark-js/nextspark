/**
 * GitHub and Apple sign-in on core's real auth routes and Better Auth (#279), run by
 * fixtures/registration-gates/driver.mts against a throwaway cluster with core's migrations. Only the providers'
 * token and user endpoints are stubbed. Covers the registration gate on a non-Google callback, the profile mapping,
 * linking by verified email (and its refusal on an unverified one), an address-less GitHub account, and Apple's
 * form_post callback with its signed client secret and first-consent name.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { generateKeyPairSync, verify } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { socialProviderList, socialProviders } from 'better-auth/social-providers'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'
const FIXTURE = path.join(CORE, 'tests/node/fixtures/registration-gates')
const ORIGIN = 'http://localhost:5173'
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })

type Step =
  | { op: 'otp'; email: string }
  | { op: 'github'; email: string; emailVerified?: boolean; name?: string | null; noEmail?: boolean; id?: number }
  | { op: 'apple'; email: string; emailVerified?: boolean; firstName?: string; lastName?: string }
  | { op: 'apple-id-token'; email: string; emailVerified: boolean }
type Result = Step & { body?: string; setsSession?: boolean; status: number; code?: string; location?: string; responseMode?: string; postStatus?: number; postLocation?: string; appleClientSecret?: string }

function runSteps(databaseUrl: string, registration: string, steps: Step[]): Result[] {
  const appConfig = {
    teams: { mode: 'multi-tenant' },
    auth: { registration: { mode: registration }, methods: ['email-otp', 'github', 'apple'] },
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
      BETTER_AUTH_SECRET: 'social-providers-secret-0123456789abcdef',
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      GITHUB_CLIENT_ID: 'Ov23liSocialProvider',
      GITHUB_CLIENT_SECRET: 'social-providers-github-secret',
      APPLE_CLIENT_ID: 'com.example.web',
      APPLE_TEAM_ID: 'TEAM123456',
      APPLE_KEY_ID: 'KEY1234567',
      APPLE_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_socialprovidersregistrationgates',
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

const signedIn = (r: Result) => r.status === 302 && !!r.location && !r.location.includes('error=')
const errorOf = (r: Result) => (r.location ? new URL(r.location, ORIGIN).searchParams.get('error') : null)

async function accounts(owner: pg.Client) {
  const { rows } = await owner.query<{ email: string; providers: string; firstName: string | null; lastName: string | null; role: string; language: string | null; emailVerified: boolean }>(`
    SELECT u.email, string_agg(a."providerId", ',' ORDER BY a."providerId") AS providers, u."firstName", u."lastName", u.role, u.language, u."emailVerified"
      FROM users u LEFT JOIN account a ON a."userId" = u.id GROUP BY u.id ORDER BY u.email`)
  return rows
}

test('the Jest mock of better-auth/social-providers lists what the installed Better Auth knows', async () => {
  // a CommonJS file in an ESM package: read its list rather than import it
  const mock = fs.readFileSync(path.join(CORE, 'tests/jest/__mocks__/better-auth-social-providers.js'), 'utf8')
  assert.deepEqual(JSON.parse(mock.match(/const socialProviderList = (\[.*\])/)![1]).sort(), [...socialProviderList].sort())
})

test('open registration: GitHub signs up a verified address, maps the profile, and refuses what it cannot trust', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const [created, again, unverified, noEmail] = runSteps(ownerUrl, 'open', [
    { op: 'github', email: 'octo@example.test', name: 'Octo Cat User' },
    { op: 'github', email: 'octo@example.test' },
    { op: 'github', email: 'unverified@example.test', emailVerified: false, id: 5151 },
    { op: 'github', email: 'none@example.test', noEmail: true, id: 6161 },
  ])
  assert.ok(signedIn(created), JSON.stringify(created))
  assert.ok(signedIn(again), JSON.stringify(again))
  // a primary address GitHub has not verified creates no account
  assert.equal(errorOf(unverified), 'SOCIAL_EMAIL_UNVERIFIED', JSON.stringify(unverified))
  assert.match(unverified.location ?? '', /\/auth-error\?/)
  // no address at all: Better Auth stops before any account
  assert.equal(errorOf(noEmail), 'email_not_found', JSON.stringify(noEmail))

  assert.deepEqual(await accounts(owner), [{
    email: 'octo@example.test', providers: 'github', firstName: 'Octo', lastName: 'Cat User', role: 'member', language: 'en', emailVerified: true,
  }])
})

test('linking by verified email: GitHub joins an existing verified account, never on an unverified address', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const [first, second, linked, notLinked] = runSteps(ownerUrl, 'open', [
    { op: 'otp', email: 'ada@example.test' },
    { op: 'otp', email: 'grace@example.test' },
    { op: 'github', email: 'ada@example.test', id: 1001 },
    { op: 'github', email: 'grace@example.test', emailVerified: false, id: 1002 },
  ])
  assert.equal(first.status, 200, JSON.stringify(first))
  assert.equal(second.status, 200, JSON.stringify(second))
  assert.ok(signedIn(linked), JSON.stringify(linked))
  assert.equal(errorOf(notLinked), 'account_not_linked', JSON.stringify(notLinked))
  const rows = await accounts(owner)
  assert.equal(rows.length, 2, JSON.stringify(rows))
  assert.ok((rows.find(r => r.email === 'ada@example.test')?.providers ?? '').split(',').includes('github'), JSON.stringify(rows))
  assert.ok(!(rows.find(r => r.email === 'grace@example.test')?.providers ?? '').includes('github'), JSON.stringify(rows))
})

test('invitation-only: the GitHub and Apple callbacks meet the same gate as Google\'s', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const [bootstrap] = runSteps(ownerUrl, 'invitation-only', [{ op: 'github', email: 'first@example.test' }])
  assert.ok(signedIn(bootstrap), JSON.stringify(bootstrap))
  await owner.query(
    `INSERT INTO team_invitations ("teamId", email, role, token, "invitedBy", "expiresAt")
     SELECT id, 'invited@example.test', 'member', 'token-github', "ownerId", now() + interval '7 days' FROM teams LIMIT 1`)
  const [strangerGithub, strangerApple, invited, again] = runSteps(ownerUrl, 'invitation-only', [
    { op: 'github', email: 'stranger@example.test', id: 2002 },
    { op: 'apple', email: 'stranger-apple@example.test' },
    { op: 'github', email: 'invited@example.test', id: 2003 },
    { op: 'github', email: 'first@example.test' },
  ])
  for (const refused of [strangerGithub, strangerApple]) {
    assert.match(refused.location ?? '', /\/auth-error\?error=SIGNUP_RESTRICTED(&|$)/, JSON.stringify(refused))
  }
  assert.ok(signedIn(invited), JSON.stringify(invited))
  assert.ok(signedIn(again), JSON.stringify(again))
  assert.deepEqual((await accounts(owner)).map(r => r.email), ['first@example.test', 'invited@example.test'])
})

test('Apple: form_post callback, a client secret signed with the .p8 key, the name from the first consent', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const [first, later, hidden] = runSteps(ownerUrl, 'open', [
    { op: 'apple', email: 'tim@example.test', firstName: 'Tim', lastName: 'Apple' },
    // later sign-ins carry no name
    { op: 'apple', email: 'tim@example.test' },
    // a private relay address is what the account gets
    { op: 'apple', email: 'abc123@privaterelay.appleid.com', firstName: 'Hidden', lastName: 'Mail' },
  ])
  for (const r of [first, later, hidden]) {
    assert.equal(r.responseMode, 'form_post')
    // the cross-site POST becomes a GET on the same callback, under the auth base path
    assert.equal(r.postStatus, 302, JSON.stringify(r))
    assert.match(r.postLocation ?? '', /^http:\/\/localhost:5173\/api\/auth\/callback\/apple\?/)
    assert.ok(signedIn(r), JSON.stringify(r))
  }
  const [header, payload, signature] = first.appleClientSecret!.split('.')
  assert.ok(verify('sha256', Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')))
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), { alg: 'ES256', kid: 'KEY1234567' })
  assert.deepEqual(
    (({ iss, aud, sub }) => ({ iss, aud, sub }))(JSON.parse(Buffer.from(payload, 'base64url').toString())),
    { iss: 'TEAM123456', aud: 'https://appleid.apple.com', sub: 'com.example.web' },
  )

  assert.deepEqual((await accounts(owner)).map(({ email, providers, firstName, lastName }) => ({ email, providers, firstName, lastName })), [
    { email: 'abc123@privaterelay.appleid.com', providers: 'apple', firstName: 'Hidden', lastName: 'Mail' },
    { email: 'tim@example.test', providers: 'apple', firstName: 'Tim', lastName: 'Apple' },
  ])
})

test("the installed Better Auth refuses cognito without domain, region and userPoolId, as the Jest mock does", () => {
  const credentials = { clientId: 'cognito-id', clientSecret: 'cognito-secret' }
  assert.throws(() => socialProviders.cognito(credentials as never))
  assert.doesNotThrow(() => socialProviders.cognito({ ...credentials, domain: 'auth.example.com', region: 'eu-west-1', userPoolId: 'eu-west-1_abc' } as never))
})

test('Apple id-token sign-in (native apps): an unverified email is refused with SOCIAL_EMAIL_UNVERIFIED, a verified one signs in', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const [unverified, verified] = runSteps(ownerUrl, 'open', [
    { op: 'apple-id-token', email: 'native-unverified@example.test', emailVerified: false },
    { op: 'apple-id-token', email: 'native@example.test', emailVerified: true },
  ])
  assert.ok(unverified.status >= 400, JSON.stringify(unverified))
  assert.match(unverified.body ?? '', /SOCIAL_EMAIL_UNVERIFIED/, JSON.stringify(unverified))
  assert.equal(unverified.setsSession, false)
  assert.equal(verified.status, 200, JSON.stringify(verified))
  assert.equal(verified.setsSession, true, JSON.stringify(verified))
  assert.deepEqual((await accounts(owner)).map(({ email, providers }) => ({ email, providers })), [{ email: 'native@example.test', providers: 'apple' }])
})

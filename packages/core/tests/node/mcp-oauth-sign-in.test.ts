/**
 * #541: an MCP authorization goes on after the sign-in it sent the browser to, whichever method signs in. The
 * authorize endpoint answers a signed-out browser with the login page and a signed query; the auth client sends that
 * query with the sign-in, and the sign-in then answers with the next step of the authorization instead of the
 * dashboard. Google (a redirect to the provider and back) and a sign-in link (opened later, from an email) both
 * leave the page in between, so the query has to survive the round trip.
 *
 * Real Better Auth and the real auth route, in a child process (fixtures/registration-gates/driver.mts) against a
 * throwaway cluster; Google's token endpoint and the email provider are stubbed there.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const FIXTURE = path.join(CORE, 'tests/node/fixtures/registration-gates')
const ORIGIN = 'http://localhost:3000'
const CLIENT = 'mcp-sign-in-test-client'
const REDIRECT = 'http://127.0.0.1:53999/callback'
const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'

type Result = { op: string; status: number; location?: string; signedInTo?: string; setsSession?: boolean; body?: string; code?: string }

function runSteps(databaseUrl: string, steps: object[], env: Record<string, string> = {}): Result[] {
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
      BETTER_AUTH_SECRET: 'mcp-oauth-sign-in-secret-0123456789abcdef',
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      GOOGLE_CLIENT_ID: '1234567890-mcpsignin.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'mcp-sign-in-google-secret',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_mcpsigninregistrationgates',
      RESEND_FROM_EMAIL: 'noreply@example.test',
      DISABLE_RATE_LIMITING: 'true',
      MCP_OAUTH_ENABLED: 'true',
      REGISTRATION_GATES_APP_CONFIG: JSON.stringify({
        teams: { mode: 'multi-tenant' },
        auth: { registration: { mode: 'open' }, methods: ['email-otp', 'magic-link', 'google'] },
      }),
      REGISTRATION_GATES_STEPS: JSON.stringify(steps),
      ...env,
    } as NodeJS.ProcessEnv,
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  if (process.env.MCP_SIGN_IN_DEBUG) console.error(run.stderr.slice(-3000))
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return results
}

async function registerClient(owner: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await owner.query(
    `INSERT INTO "oauthClient" (id, "clientId", name, "redirectUris", "tokenEndpointAuthMethod", "grantTypes", "responseTypes", "requirePKCE", scopes, "applicationType", "createdAt", "updatedAt")
     VALUES ('mcp-sign-in-test', $1, 'Sign-in test client', $2::jsonb, 'none', '["authorization_code","refresh_token"]'::jsonb, '["code"]'::jsonb, true, '["openid","offline_access"]'::jsonb, 'native', now(), now())`,
    [CLIENT, JSON.stringify([REDIRECT])]
  )
}
const authorize = (email: string) => ({ op: 'mcp-authorize', email, clientId: CLIENT, redirectUri: REDIRECT, scope: 'openid offline_access' })
/**
 * The sign-in came back to the authorization endpoint with the client's own request (nothing of the signature left),
 * and the endpoint then went on to a step of the authorization: the team picker, the consent screen or the client.
 */
function continues(r: Result) {
  const back = new URL(r.signedInTo ?? '', ORIGIN)
  const sameRequest = back.pathname === '/api/auth/oauth2/authorize' && back.searchParams.get('client_id') === CLIENT &&
    back.searchParams.get('redirect_uri') === REDIRECT && back.searchParams.get('code_challenge_method') === 'S256' &&
    ![...back.searchParams.keys()].some(name => name === 'sig' || name === 'exp' || name.startsWith('ba_'))
  return sameRequest && !!r.location && (/^\/oauth\/(select-team|consent)\?/.test(r.location) || r.location.startsWith(REDIRECT))
}

test('an MCP authorization sends a signed-out browser to the login page with its signed query', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await registerClient(owner)
  const [start] = runSteps(ownerUrl, [authorize('nobody@example.test')])
  assert.ok(start.location?.startsWith('/login?') && start.location.includes('sig='), JSON.stringify(start))
})

test('Google sign-in from that login page goes on with the authorization', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await registerClient(owner)
  const [, google] = runSteps(ownerUrl, [authorize('google-user@example.test'), { op: 'mcp-google', email: 'google-user@example.test' }])
  assert.equal(google.setsSession, true, JSON.stringify(google))
  assert.ok(continues(google), `the callback goes on with the authorization: ${JSON.stringify(google)}`)
})

test('a sign-in link asked for from that login page goes on with the authorization when it is opened', { skip, timeout: 300000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await registerClient(owner)
  // the tsconfig of the sign-in link tests: its paths give the email templates their translations outside Next.js
  const [, magic] = runSteps(ownerUrl, [authorize('link-user@example.test'), { op: 'mcp-magic', email: 'link-user@example.test' }], {
    TSX_TSCONFIG_PATH: path.join(CORE, 'tests/node/fixtures/otp-send-failures/tsconfig.json'),
  })
  assert.equal(magic.setsSession, true, JSON.stringify(magic))
  assert.ok(continues(magic), `the link goes on with the authorization: ${JSON.stringify(magic)}`)
})

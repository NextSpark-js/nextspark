/**
 * #495: a real Better Auth 1.7 with core's account theme plugin and reader, on core's migrations. Wherever a response
 * issues a session the account's saved theme goes to the readable `nextspark.account_theme` cookie (the theme
 * script applies it before the first paint); an account with no valid saved theme, a failed read and a sign-out
 * expire it; a session read that issues no session leaves it alone.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the
 * PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { betterAuth } from 'better-auth'
import { HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'
import { accountThemePlugin, readAccountThemeFrom } from '../../src/lib/auth/account-theme-plugin'

const PASSWORD = 'Passw0rd!123'

function themeCookie(response: Response): string | undefined {
  return response.headers.getSetCookie().find(c => c.startsWith('nextspark.account_theme='))
}

test('the account theme cookie follows the sessions Better Auth issues', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const pg = await import('pg')
  const pool = new pg.default.Pool({ connectionString: ownerUrl })
  // the cluster stops under it at the end of the test
  pool.on('error', () => {})
  let failRead = false
  const read = readAccountThemeFrom(pool)
  const make = (baseURL: string, advanced?: Parameters<typeof betterAuth>[0]['advanced']) => betterAuth({
    database: pool,
    secret: 'a-test-secret-with-enough-entropy-0123456789',
    baseURL,
    advanced,
    emailAndPassword: { enabled: true },
    user: { modelName: 'users' },
    plugins: [accountThemePlugin(async (userId) => {
      if (failRead) throw new Error('database down')
      return read(userId)
    })],
  })
  const auth = make('http://localhost:3000')
  const post = (path: string, body: unknown, cookie = '', base = 'http://localhost:3000', instance = auth) => instance.handler(new Request(`${base}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }))
  const signIn = (email: string, base?: string, instance?: typeof auth) => post('/sign-in/email', { email, password: PASSWORD }, '', base, instance)

  // A sign-up issues a session too: an account with no saved theme expires the cookie (another account's may be there)
  const signUp = await post('/sign-up/email', { email: 'a@example.test', password: PASSWORD, name: 'A' })
  assert.equal(signUp.status, 200)
  assert.match(themeCookie(signUp) ?? '', /^nextspark\.account_theme=; Max-Age=0/)
  const userId = (await owner.query(`SELECT id FROM users WHERE email = 'a@example.test'`)).rows[0].id

  // The sample shape of the meta: the theme with other preferences
  await owner.query(
    `INSERT INTO users_metas ("userId", "metaKey", "metaValue", "dataType") VALUES ($1, 'uiPreferences', '{"theme": "dark", "sidebarCollapsed": false}', 'json')`,
    [userId]
  )
  const signedIn = await signIn('a@example.test')
  assert.equal(signedIn.status, 200)
  const cookie = themeCookie(signedIn) ?? ''
  assert.match(cookie, /^nextspark\.account_theme=dark;/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Max-Age=34560000/)
  assert.doesNotMatch(cookie, /HttpOnly/i, 'the inline script reads it')
  assert.doesNotMatch(cookie, /Secure/i, 'over http')

  // A session read that issues no session leaves the cookie alone
  const session = signedIn.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  const read1 = await auth.handler(new Request('http://localhost:3000/api/auth/get-session', { headers: { cookie: session } }))
  assert.equal(read1.status, 200)
  assert.equal(themeCookie(read1), undefined)

  // Sign-out expires it
  const signedOut = await post('/sign-out', {}, session)
  assert.equal(signedOut.status, 200)
  assert.match(themeCookie(signedOut) ?? '', /^nextspark\.account_theme=; Max-Age=0/)

  // "system" is a theme; a value that is none is not copied
  await owner.query(`UPDATE users_metas SET "metaValue" = '{"theme": "system"}' WHERE "userId" = $1`, [userId])
  assert.match(themeCookie(await signIn('a@example.test')) ?? '', /^nextspark\.account_theme=system;/)
  await owner.query(`UPDATE users_metas SET "metaValue" = '{"theme": "neon; Path=/x"}' WHERE "userId" = $1`, [userId])
  assert.match(themeCookie(await signIn('a@example.test')) ?? '', /^nextspark\.account_theme=; Max-Age=0/)

  // A failed read does not fail the sign-in and leaves no stale theme
  await owner.query(`UPDATE users_metas SET "metaValue" = '{"theme": "light"}' WHERE "userId" = $1`, [userId])
  failRead = true
  const withoutRead = await signIn('a@example.test')
  failRead = false
  assert.equal(withoutRead.status, 200)
  assert.match(themeCookie(withoutRead) ?? '', /^nextspark\.account_theme=; Max-Age=0/)

  // Secure over https
  const httpsAuth = make('https://app.example.test')
  const overHttps = await signIn('a@example.test', 'https://app.example.test', httpsAuth)
  assert.equal(overHttps.status, 200)
  assert.match(themeCookie(overHttps) ?? '', /^nextspark\.account_theme=light;.*Secure/i)

  // Secure exactly when the session cookie is, not by the request URL: core's production config
  // (useSecureCookies and a secure default attribute, lib/auth.ts) behind a proxy that speaks http to the app
  const prodAuth = make('http://localhost:3000', { useSecureCookies: true, defaultCookieAttributes: { secure: true } })
  const behindProxy = await signIn('a@example.test', 'http://localhost:3000', prodAuth)
  assert.equal(behindProxy.status, 200)
  assert.ok(behindProxy.headers.getSetCookie().some(c => /session_token=/.test(c) && /Secure/i.test(c)), 'the session cookie is Secure')
  assert.match(themeCookie(behindProxy) ?? '', /^nextspark\.account_theme=light;.*Secure/i)
  await pool.end()
})

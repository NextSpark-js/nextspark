/**
 * #324: the contract lib/auth.ts relies on. A user.create `after` hook runs once the user is committed; when it
 * deletes the user and throws an APIError, a real Better Auth 1.7 sign-up answers that error and leaves no user,
 * account or session row. Also records what the email sign-up had already done by then (verification email, session
 * cookie, cookie cache).
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the
 * PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { betterAuth, APIError } from 'better-auth'
import { HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

test('a failing user.create after hook with a compensating delete fails the sign-up and leaves no rows', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  const pg = await import('pg')
  const pool = new pg.default.Pool({ connectionString: ownerUrl })
  const verificationEmails: string[] = []
  const auth = betterAuth({
    database: pool,
    secret: 'a-test-secret-with-enough-entropy-0123456789',
    baseURL: 'http://localhost:3000',
    emailAndPassword: { enabled: true },
    emailVerification: { sendOnSignUp: true, sendVerificationEmail: async ({ user }) => { verificationEmails.push(user.email) } },
    session: { cookieCache: { enabled: true, maxAge: 300 } },
    user: { modelName: 'users' },
    databaseHooks: { user: { create: { after: async (user: { id: string }) => {
      await pool.query('DELETE FROM "users" WHERE id = $1', [user.id])
      throw new APIError('INTERNAL_SERVER_ERROR', { code: 'TEAM_CREATION_FAILED', message: 'Your account could not be set up.' })
    } } } },
  })

  const response = await auth.handler(new Request('http://localhost:3000/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: 'a@example.test', password: 'Passw0rd!123', name: 'A' }),
  }))

  assert.equal(response.status, 500)
  assert.equal((await response.json()).code, 'TEAM_CREATION_FAILED')
  for (const table of ['users', 'account', 'session']) {
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, table)
  }

  // What had already happened before the hook ran (recorded in the docs): the verification email went out, and the
  // response carries a session cookie. The cookie cannot be used: the session row is gone.
  assert.deepEqual(verificationEmails, ['a@example.test'])
  const cookies = response.headers.getSetCookie().map(c => c.split(';')[0])
  const session = await auth.api.getSession({ headers: new Headers({ cookie: cookies.join('; ') }), query: { disableCookieCache: true } })
  assert.equal(session, null)
  // With the cookie cache on, a read that does not skip it still sees the session for the cache's maxAge: core's
  // API routes skip it (disableCookieCache), a page that reads the cookie cache only does not.
  assert.ok(cookies.some(c => c.startsWith('better-auth.session_data=')))
  const cached = await auth.api.getSession({ headers: new Headers({ cookie: cookies.join('; ') }) })
  assert.ok(cached, 'the cookie cache still answers with the session')
  await pool.end()
})

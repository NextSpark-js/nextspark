/**
 * #392: Better Auth 1.7 accepts a password sign-in only when the credential account's "accountId" is the user's id.
 * - the sample data of core, the default theme and the project templates writes "accountId" = "userId";
 * - migration 044 fixes the rows an older seed (or an import) wrote with another value, once per user, and skips what
 *   it cannot decide (several credential rows, a taken key) or must not touch (OAuth accounts);
 * - a real Better Auth 1.7 signs in with the seeded sample account.
 *
 * The database tests start a throwaway cluster with initdb and pg_ctl on a free port, and are skipped when they are
 * not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { betterAuth } from 'better-auth'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'
const ROOT = path.resolve(CORE, '../..')
const MIGRATION_044 = fs.readFileSync(path.join(CORE, 'migrations/044_credential_account_id_is_user_id.sql'), 'utf8')

const SEEDS = [
  'packages/core/migrations/090_sample_data.sql',
  'apps/dev/migrations/090_demo_users_teams.sql',
  'apps/dev/migrations/091_greek_teams_billing.sql',
  ...['blog', 'crm', 'productivity'].map(name => `packages/core/templates/projects/${name}/migrations/999_theme_sample_data.sql`),
]

/** The (id, userId, accountId) of every 'credential' row an INSERT in `sql` writes, in either layout the seeds use. */
function credentialRows(sql: string) {
  const multiline = /'([^']*)',\s*\n\s*'([^']*)',\s*\n\s*'([^']*)',\s*\n\s*'credential'/g
  const oneline = /\('([^']*)', '([^']*)', '([^']*)', 'credential'/g
  return [...sql.matchAll(multiline), ...sql.matchAll(oneline)].map(m => ({ id: m[1], userId: m[2], accountId: m[3] }))
}

test('every sample credential account writes accountId = userId', () => {
  for (const file of SEEDS) {
    const sql = fs.readFileSync(path.join(ROOT, file), 'utf8')
    const rows = credentialRows(sql)
    const count = sql.split("'credential'").length - 1
    assert.ok(rows.length > 0 && rows.length === count, `${file}: parsed ${rows.length} of ${count} credential rows`)
    assert.deepEqual(rows.filter(r => r.accountId !== r.userId), [], file)
  }
})

const addUsers = (ids: string[]) => `INSERT INTO users (id, email) VALUES ${ids.map(id => `('${id}', '${id}@example.test')`).join(', ')}`
const insertAccount = (id: string, userId: string, accountId: string, providerId = 'credential') =>
  `INSERT INTO account (id, "accountId", "providerId", "userId", password) VALUES ('${id}', '${accountId}', '${providerId}', '${userId}', 'salt:hash')`

test('044 sets accountId = userId on credential rows, and leaves the rest as it is', { skip, timeout: 240000 }, async t => {
  const { owner } = await cutoverDatabase(t)
  await owner.query(`
    ${addUsers(['u-fix', 'u-ok', 'u-twice', 'u-oauth', 'u-blocked', 'u-squatter'])};
    ${insertAccount('a-fix', 'u-fix', 'u-fix@example.test')};
    ${insertAccount('a-ok', 'u-ok', 'u-ok')};
    ${insertAccount('a-twice-1', 'u-twice', 'u-twice@example.test')};
    ${insertAccount('a-twice-2', 'u-twice', 'other-key')};
    ${insertAccount('a-oauth-g', 'u-oauth', 'google-sub-1', 'google')};
    ${insertAccount('a-oauth-c', 'u-oauth', 'u-oauth@example.test')};
    ${insertAccount('a-blocked', 'u-blocked', 'u-blocked@example.test')};
    ${insertAccount('a-squatter', 'u-squatter', 'u-blocked')};
    ${insertAccount('a-squatter-2', 'u-squatter', 'other-squat-key')};
    ${insertAccount('a-oauth-same-id', 'u-oauth', 'u-fix', 'github')}
  `)
  const notices: string[] = []
  owner.on('notice', n => notices.push(n.message ?? ''))
  await owner.query(MIGRATION_044)
  assert.match(notices.join('\n'), /Credential accounts: 2 set to accountId = userId; 2 user\(s\) with several credential rows and 1 row\(s\) whose target key is taken left unchanged/)

  // a-oauth-c (the only credential row of u-oauth) is fixed; the google and github rows are not touched
  assert.deepEqual((await owner.query(`SELECT id, "accountId", "providerId" FROM account ORDER BY id`)).rows, [
    { id: 'a-blocked', accountId: 'u-blocked@example.test', providerId: 'credential' },
    { id: 'a-fix', accountId: 'u-fix', providerId: 'credential' },
    { id: 'a-oauth-c', accountId: 'u-oauth', providerId: 'credential' },
    { id: 'a-oauth-g', accountId: 'google-sub-1', providerId: 'google' },
    { id: 'a-oauth-same-id', accountId: 'u-fix', providerId: 'github' },
    { id: 'a-ok', accountId: 'u-ok', providerId: 'credential' },
    { id: 'a-squatter', accountId: 'u-blocked', providerId: 'credential' },
    { id: 'a-squatter-2', accountId: 'other-squat-key', providerId: 'credential' },
    { id: 'a-twice-1', accountId: 'u-twice@example.test', providerId: 'credential' },
    { id: 'a-twice-2', accountId: 'other-key', providerId: 'credential' },
  ])

  // idempotent: a second run changes nothing, not even updatedAt
  const digest = async () => (await owner.query(`SELECT md5(string_agg((a.*)::text, '|' ORDER BY id)) AS d FROM account a`)).rows[0].d
  const before = await digest()
  await owner.query(MIGRATION_044)
  assert.equal(await digest(), before)
  assert.match(notices.at(-1) ?? '', /Credential accounts: 0 set .*2 user\(s\).* 1 row/)
})

test('a real Better Auth 1.7 signs in with the seeded sample account, and with an older seed only after 044', { skip, timeout: 240000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  // 090 refuses to run outside a runner session; the runner sets this for a development run with sample data
  await owner.query(`SET nextspark.seed_sample_data = 'on'`)
  await owner.query(fs.readFileSync(path.join(CORE, 'migrations/090_sample_data.sql'), 'utf8'))
  const pg = await import('pg')
  const pool = new pg.default.Pool({ connectionString: ownerUrl })
  const auth = betterAuth({
    database: pool,
    secret: 'a-test-secret-with-enough-entropy-0123456789',
    baseURL: 'http://localhost:3000',
    emailAndPassword: { enabled: true },
    user: { modelName: 'users' },
  })
  const signIn = (email: string) => auth.api.signInEmail({ body: { email, password: 'Pandora1234' } })

  for (const email of ['superadmin@nextspark.dev', 'developer@nextspark.dev']) {
    assert.equal((await signIn(email)).user.email, email)
  }

  // a project seeded by core up to 0.1.0-beta.200 holds the email as accountId
  await owner.query(`UPDATE account SET "accountId" = (SELECT email FROM users WHERE users.id = account."userId") WHERE "providerId" = 'credential'`)
  await assert.rejects(signIn('superadmin@nextspark.dev'), /Invalid email or password/)
  await owner.query(MIGRATION_044)
  assert.equal((await signIn('superadmin@nextspark.dev')).user.id, 'test-superadmin-001')
  assert.equal((await signIn('developer@nextspark.dev')).user.id, 'test-developer-001')
  await pool.end()
})

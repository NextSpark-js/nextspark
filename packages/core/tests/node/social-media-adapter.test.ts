/**
 * social-media-publisher keeps the project's tables behind its adapter (#476): no SQL of the plugin's routes and
 * libraries names a table the plugin does not create, and the accounts, assign and publish routes answer 501 with
 * the guide when no adapter is registered. With a test adapter (fixtures/audit-logs-api/adapter-driver.mts) they
 * answer as the user on the nextspark_app cutover: the accounts with the adapter's entities, a post handed to the
 * adapter, and the refreshed token written to the user's social_accounts row.
 *
 * The routes' part is skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID, webcrypto } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const PLUGIN = path.join(CORE, '../../plugins/social-media-publisher')
const FIXTURE = path.join(CORE, 'tests/node/fixtures/audit-logs-api')
// The tables the plugin's migrations create (audit_logs is renamed social_audit_logs by 003)
const PLUGIN_TABLES = new Set(['social_accounts', 'social_audit_logs'])

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full)
    return entry.name.endsWith('.ts') ? [full] : []
  })
}

test('social-media-publisher: the SQL of its routes and libraries names only the plugin\'s tables (#476)', () => {
  const found: string[] = []
  for (const file of [...sourceFiles(path.join(PLUGIN, 'api')), ...sourceFiles(path.join(PLUGIN, 'lib'))]) {
    // without comments: they describe the project's tables in prose
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const [, table] of code.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/g)) {
      if (table !== 'SET') found.push(`${path.relative(PLUGIN, file)}: ${table}`)
    }
  }
  assert.ok(found.length > 0, 'the scan finds the plugin\'s own queries')
  assert.deepEqual(found.filter(entry => !PLUGIN_TABLES.has(entry.split(': ')[1])), [], 'a project table belongs behind the adapter')
})

type Step = { route: 'accounts' | 'assign' | 'publish'; query?: string; key: string; adapter?: boolean; body?: unknown }
type Account = { platformAccountId: string; accessToken: string; alreadyAssignedToEntity: boolean; connectedClients: unknown[] }
type Body = { accounts?: Account[]; entitySlug?: string | null; code?: string; guide?: string; error?: string; postId?: string }
type Result = { route: string; status: number; body: Body }

async function apiKey(owner: pg.Client, userId: string, scopes: string[]) {
  const key = `sk_test_${randomBytes(32).toString('hex')}`
  await owner.query(
    `INSERT INTO api_key ("keyHash", "keyPrefix", name, "userId", scopes) VALUES ($1, $2, 'test', $3, $4)`,
    [createHash('sha256').update(key).digest('hex'), key.slice(0, 16), userId, scopes],
  )
  return key
}

/** A token as TokenEncryption stores it (`encrypted:iv:keyId`, AES-256-GCM, base64), with `rawKey`. */
async function encrypt(rawKey: Buffer, token: string) {
  const key = await webcrypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = randomBytes(12)
  const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, Buffer.from(token))
  return `${Buffer.from(encrypted).toString('base64')}:${iv.toString('base64')}:v1`
}

test('social-media-publisher: 501 with the guide without an adapter, and the routes through a registered adapter as the user (#476)', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, appUrl, ownerUrl } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('ua', 'a@example.test', 'A', 'member', true), ('ub', 'b@example.test', 'B', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'ua'), ('team-b', 'Team B', 'team-b', 'ub');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'ua', 'owner'), ('team-b', 'ub', 'owner');
  `)
  for (const file of fs.readdirSync(path.join(PLUGIN, 'migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await owner.query(fs.readFileSync(path.join(PLUGIN, 'migrations', file), 'utf8'))
  }
  const rawKey = randomBytes(32)
  const stored = await encrypt(rawKey, 'page-token')
  // expires in 5 minutes: listed, and refreshed by the publish route before it posts
  await owner.query(
    `INSERT INTO social_accounts ("userId", platform, "platformAccountId", username, "accessToken", "tokenExpiresAt")
     VALUES ('ua', 'facebook_page', 'page-1', 'Page One', $1, now() + interval '5 minutes')`, [stored])
  const keyA = await apiKey(owner, 'ua', ['social:read', 'social:write'])
  const keyB = await apiKey(owner, 'ub', ['social:read', 'social:write'])
  const entity = randomUUID()
  const assignment = randomUUID()
  const content = randomUUID()
  const publish = { accountId: assignment, entityId: content, platform: 'facebook_page', caption: 'Hello' }
  const assign = { entityId: entity, accounts: [{ platform: 'facebook_page', platformAccountId: 'page-1', username: 'Page One', accessToken: 'page-token' }] }

  const steps: Step[] = [
    // no adapter registered
    { route: 'accounts', query: `?entityId=${entity}`, key: keyA },
    { route: 'assign', key: keyA, body: assign },
    { route: 'publish', key: keyA, body: publish },
    { route: 'accounts', key: keyA },
    // the test adapter registered
    { route: 'accounts', query: `?entityId=${entity}`, key: keyA, adapter: true },
    { route: 'accounts', query: `?entityId=${entity}`, key: keyB, adapter: true },
    { route: 'accounts', key: keyB, adapter: true },
    { route: 'publish', key: keyA, adapter: true, body: publish },
  ]
  const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(FIXTURE, 'adapter-driver.mts')], {
    cwd: CORE,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'test',
      TSX_TSCONFIG_PATH: path.join(FIXTURE, 'tsconfig.json'),
      DATABASE_URL: appUrl,
      DATABASE_SERVICE_URL: ownerUrl,
      BETTER_AUTH_SECRET: 'social-adapter-secret-0123456789abcdef0',
      BETTER_AUTH_URL: 'http://localhost:5173',
      NEXT_PUBLIC_APP_URL: 'http://localhost:5173',
      DISABLE_RATE_LIMITING: 'true',
      OAUTH_ENCRYPTION_KEY: rawKey.toString('base64'),
      FACEBOOK_CLIENT_ID: 'test-app',
      FACEBOOK_CLIENT_SECRET: 'test-secret',
      SOCIAL_ENTITY_ID: entity,
      SOCIAL_ASSIGNMENT_ID: assignment,
      SOCIAL_ADAPTER_STEPS: JSON.stringify(steps),
    },
  })
  const lines = run.stdout.split('\n')
  const results = lines.filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  const [noAccounts, noAssign, noPublish, ownAccounts, accounts, otherUser, otherList, published] = results

  // 1. Without an adapter: what needs one answers 501 with what is missing and the guide; the user's own accounts list
  for (const result of [noAccounts, noAssign, noPublish]) {
    assert.equal(result.status, 501, JSON.stringify(result))
    assert.equal(result.body.code, 'SOCIAL_ADAPTER_NOT_REGISTERED')
    assert.match(result.body.error!, /registerSocialPlatformAdapter\(\).*src\/instrumentation\.ts/)
    assert.match(result.body.guide!, /plugins\/social-media-publisher\/docs\/03-advanced-usage\/04-adapter-integration\.md$/)
  }
  assert.equal(ownAccounts.status, 200, JSON.stringify(ownAccounts))
  assert.deepEqual(ownAccounts.body.accounts!.map(a => [a.platformAccountId, a.accessToken, a.alreadyAssignedToEntity, a.connectedClients]), [['page-1', 'page-token', false, []]])
  assert.equal(ownAccounts.body.entitySlug, null)

  // 2. With the adapter: the entity's view, its entities from the adapter, and nothing of another user's
  assert.equal(accounts.status, 200, JSON.stringify(accounts))
  assert.deepEqual(accounts.body.accounts!.map(a => [a.platformAccountId, a.alreadyAssignedToEntity, a.connectedClients]), [['page-1', true, [{ id: entity, name: 'Project One' }]]])
  assert.equal(accounts.body.entitySlug, 'projects')
  assert.equal(otherUser.status, 404, JSON.stringify(otherUser))
  assert.equal(otherList.status, 200, JSON.stringify(otherList))
  assert.deepEqual(otherList.body.accounts, [])

  // 3. Publish: the post goes to the adapter, not to a table of the plugin's choosing, and the refreshed token is
  //    written to the user's row as the user
  assert.equal(published.status, 200, JSON.stringify(published))
  assert.equal(published.body.postId, 'page-1_post-9')
  const recorded = lines.filter(l => l.startsWith('RECORDED ')).map(l => JSON.parse(l.slice(9)))
  assert.equal(recorded.length, 1, run.stdout)
  assert.equal(recorded[0].userId, 'ua')
  assert.deepEqual({ ...recorded[0].post, publishedAt: typeof recorded[0].post.publishedAt },
    { entityId: content, accountId: assignment, platform: 'facebook_page', postId: 'page-1_post-9', postUrl: 'https://www.facebook.com/page-1_post-9', publishedAt: 'string' })
  const { rows: [row] } = await owner.query(`SELECT "accessToken", "tokenExpiresAt" > now() + interval '30 days' AS refreshed FROM social_accounts`)
  assert.notEqual(row.accessToken, stored, 'the refreshed token is stored')
  assert.equal(row.refreshed, true)
})

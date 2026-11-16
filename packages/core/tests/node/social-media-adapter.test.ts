/**
 * social-media-publisher keeps the project's tables behind its adapter (#476): no SQL of the plugin's routes and
 * libraries names a table the plugin does not create, and the accounts, assign and publish routes answer 501 with
 * the guide when no adapter is registered. With a test adapter (fixtures/audit-logs-api/adapter-driver.mts) they
 * answer as the user on the nextspark_app cutover: the accounts with the adapter's entities, a post handed to the
 * adapter, and the refreshed token written to the user's social_accounts row. No response carries a token: the
 * accounts route and the OAuth callback's preview list account details only, and assign reads the token of the
 * account it is asked for on the server (a token in its body is not read), from the user's own accounts only.
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

type Step = { route: 'accounts' | 'assign' | 'publish' | 'callback'; query?: string; key: string; adapter?: boolean; body?: unknown }
type Account = { platformAccountId: string; alreadyAssignedToEntity: boolean; connectedClients: unknown[] }
type Body = {
  accounts?: Account[]; entitySlug?: string | null; code?: string; guide?: string; error?: string; postId?: string
  results?: Array<{ platformAccountId: string; success: boolean; error?: string }>
}
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

async function decrypt(rawKey: Buffer, stored: string) {
  const [encrypted, iv] = stored.split(':').map(part => Buffer.from(part, 'base64'))
  const key = await webcrypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt'])
  return Buffer.from(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, encrypted)).toString()
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
  const entityB = randomUUID()
  const assignment = randomUUID()
  const content = randomUUID()
  const publish = { accountId: assignment, entityId: content, platform: 'facebook_page', caption: 'Hello' }
  // as an older client sends it: with a token (and details) of its own, which the route does not read
  const assign = { entityId: entity, accounts: [{ platform: 'facebook_page', platformAccountId: 'page-1', username: 'Spoofed', accessToken: 'client-token' }] }

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
  const runDriver = (driverSteps: Step[]) => {
    const child = spawnSync(process.execPath, ['--import', 'tsx', path.join(FIXTURE, 'adapter-driver.mts')], {
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
        SOCIAL_ENTITY_B_ID: entityB,
        SOCIAL_ADAPTER_STEPS: JSON.stringify(driverSteps),
      },
    })
    const output = `${child.stdout}\n${child.stderr}`
    const results = child.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
    assert.equal(results.length, driverSteps.length, `the driver ran every step\n${output}`)
    return { stdout: child.stdout, output, results }
  }
  const run = runDriver(steps)
  const lines = run.stdout.split('\n')
  const results = run.results
  const [noAccounts, noAssign, noPublish, ownAccounts, accounts, otherUser, otherList, published] = results

  // 1. Without an adapter: what needs one answers 501 with what is missing and the guide; the user's own accounts list
  for (const result of [noAccounts, noAssign, noPublish]) {
    assert.equal(result.status, 501, JSON.stringify(result))
    assert.equal(result.body.code, 'SOCIAL_ADAPTER_NOT_REGISTERED')
    assert.match(result.body.error!, /registerSocialPlatformAdapter\(\).*src\/instrumentation\.ts/)
    assert.match(result.body.guide!, /plugins\/social-media-publisher\/docs\/03-advanced-usage\/04-adapter-integration\.md$/)
  }
  // The stored account and the Page Graph returns for its token
  assert.equal(ownAccounts.status, 200, JSON.stringify(ownAccounts))
  assert.deepEqual(ownAccounts.body.accounts!.map(a => [a.platformAccountId, a.alreadyAssignedToEntity, a.connectedClients]), [['page-1', false, []], ['page-2', false, []]])
  assert.equal(ownAccounts.body.entitySlug, null)

  // 2. With the adapter: the entity's view, its entities from the adapter, and nothing of another user's
  assert.equal(accounts.status, 200, JSON.stringify(accounts))
  assert.deepEqual(accounts.body.accounts!.map(a => [a.platformAccountId, a.alreadyAssignedToEntity, a.connectedClients]), [['page-1', true, [{ id: entity, name: 'Project One' }]], ['page-2', false, []]])
  assert.equal(accounts.body.entitySlug, 'projects')
  assert.equal(otherUser.status, 404, JSON.stringify(otherUser))
  assert.equal(otherList.status, 200, JSON.stringify(otherList))
  assert.deepEqual(otherList.body.accounts, [])
  // No account carries a token: neither the stored one (decrypted or as stored) nor the Page's from Graph
  for (const result of [ownAccounts, accounts, otherList]) {
    const json = JSON.stringify(result.body)
    for (const secret of ['page-token', 'graph-page-token', stored]) assert.ok(!json.includes(secret), `${secret} in ${json}`)
    assert.ok(!/accessToken/i.test(json), json)
  }

  // 3. Publish: the post goes to the adapter, not to a table of the plugin's choosing, and the refreshed token is
  //    written to the user's row as the user
  assert.equal(published.status, 200, JSON.stringify(published))
  assert.equal(published.body.postId, 'page-1_post-9')
  const recorded = lines.filter(l => l.startsWith('RECORDED ')).map(l => JSON.parse(l.slice(9)))
  assert.equal(recorded.length, 1, run.stdout)
  assert.equal(recorded[0].userId, 'ua')
  assert.deepEqual({ ...recorded[0].post, publishedAt: typeof recorded[0].post.publishedAt },
    { entityId: content, accountId: assignment, platform: 'facebook_page', postId: 'page-1_post-9', postUrl: 'https://www.facebook.com/page-1_post-9', publishedAt: 'string' })
  const { rows: [row] } = await owner.query(`SELECT "accessToken", "tokenExpiresAt" > now() + interval '30 days' AS refreshed FROM social_accounts WHERE "platformAccountId" = 'page-1'`)
  assert.notEqual(row.accessToken, stored, 'the refreshed token is stored')
  assert.equal(row.refreshed, true)
  assert.match(run.stdout, /Token refreshed and encrypted for platformAccountId page-1/)

  // 4. Assign takes the account's token on the server: from the user's row (a token in the body is not read nor
  //    stored), or for a Page found through Graph from Graph, stored in a row of the user's; another user's account
  //    is not found. The OAuth callback's preview lists the Pages without their tokens.
  const refreshedToken = row.accessToken
  const assigned = runDriver([
    { route: 'assign', key: keyA, adapter: true, body: assign },
    { route: 'assign', key: keyA, adapter: true, body: { entityId: entity, accounts: [{ platformAccountId: 'page-2' }] } },
    { route: 'assign', key: keyB, adapter: true, body: { entityId: entityB, accounts: [{ platformAccountId: 'page-1' }] } },
    { route: 'callback', key: keyA, adapter: true, query: `?code=oauth-code&state=${encodeURIComponent(`s&platform=facebook_page&entityId=${entity}&mode=preview`)}` },
  ])
  const [fromRow, fromGraph, foreignAssign, preview] = assigned.results
  const saved = assigned.stdout.split('\n').filter(l => l.startsWith('SAVED ')).map(l => JSON.parse(l.slice(6)))
  for (const result of [fromRow, fromGraph]) {
    assert.equal(result.status, 200, JSON.stringify(result))
    assert.deepEqual(result.body.results!.map(r => r.success), [true], JSON.stringify(result))
  }
  assert.deepEqual(saved.map(s => [s.userId, s.data.platformAccountId, s.data.accessToken, s.data.username]),
    [['ua', 'page-1', 'fresh-token', 'Page One'], ['ua', 'page-2', 'graph-page-token', 'Page Two']], assigned.stdout)
  assert.ok(!assigned.output.includes('client-token'), 'the token in the body is not used')
  const tokens = Object.fromEntries((await owner.query(`SELECT "platformAccountId", "userId", "accessToken" FROM social_accounts`)).rows
    .map(r => [r.platformAccountId, [r.userId, r.accessToken]]))
  assert.deepEqual(tokens['page-1'], ['ua', refreshedToken], 'the stored row is left as it was')
  assert.equal(tokens['page-2'][0], 'ua')
  assert.equal(await decrypt(rawKey, tokens['page-2'][1]), 'graph-page-token')
  assert.equal(foreignAssign.status, 200, JSON.stringify(foreignAssign))
  assert.deepEqual(foreignAssign.body.results!.map(r => [r.platformAccountId, r.success, r.error]),
    [['page-1', false, 'Account not found among your connected accounts']])
  assert.equal(preview.status, 200, JSON.stringify(preview))
  const html = String(preview.body)
  assert.match(html, /oauth-preview/)
  assert.match(html, /"platformAccountId":"page-2"/)
  assert.ok(!html.includes('graph-page-token') && !/accessToken/.test(html), html)

  // 5. A token whose row another user owns: the refresh updates no row, says so, and does not claim it stored it
  await owner.query(`UPDATE social_accounts SET "userId" = 'ub', "accessToken" = $1, "tokenExpiresAt" = now() + interval '5 minutes' WHERE "platformAccountId" = 'page-1'`, [stored])
  const foreign = runDriver([{ route: 'publish', key: keyA, adapter: true, body: publish }])
  assert.equal(foreign.results[0].status, 200, JSON.stringify(foreign.results[0]))
  assert.match(foreign.output, /Token refreshed for platformAccountId page-1 but not stored: no social_accounts row of this user matched/)
  assert.doesNotMatch(foreign.output, /Token refreshed and encrypted/)
  assert.equal((await owner.query(`SELECT "accessToken" FROM social_accounts WHERE "platformAccountId" = 'page-1'`)).rows[0].accessToken, stored)
})

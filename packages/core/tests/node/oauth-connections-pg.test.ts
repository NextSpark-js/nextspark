/**
 * The rules of MCP browser sign-in that live in the database (#541), against a real PostgreSQL with core's
 * migrations applied from nothing: migration 049's triggers and locks, and the code that relies on them
 * (lib/mcp/oauth/connection-store, lib/mcp/oauth/purge). The Jest suites of those modules mock the queries, so they
 * run no trigger and take no lock: what two connections do to each other is only seen here.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { CORE, cutoverDatabase, HAS_POSTGRES } from './_pg-cutover'

const READ = 'tasks:read'
const WRITE = 'tasks:write'
const BASE = ['openid', 'offline_access']

/** Whether a promise is still pending after `ms`: it is waiting on a lock. */
async function stillWaiting(promise: Promise<unknown>, ms = 400): Promise<boolean> {
  const settled = promise.then(() => true, () => true)
  return !(await Promise.race([settled, new Promise<false>(resolve => setTimeout(() => resolve(false), ms))]))
}

test('MCP browser sign-in: the rules the database holds', { skip: !HAS_POSTGRES && 'initdb, pg_ctl or postgres not on PATH', timeout: 300000 }, async t => {
  const db = await cutoverDatabase(t)
  process.env.DATABASE_URL = db.ownerUrl
  delete process.env.DATABASE_SERVICE_URL
  const core = await import('../../src/lib/db')
  const store = await import('../../src/lib/mcp/oauth/connection-store')
  const { purgeExpiredOAuth } = await import('../../src/lib/mcp/oauth/purge')
  t.after(() => core.pool.end())

  const owner = db.owner
  const other = new pg.Client({ connectionString: db.ownerUrl })
  other.on('error', () => {})
  await other.connect()
  t.after(() => other.end())

  // ---------------------------------------------------------------- fixtures
  await owner.query(`
    INSERT INTO "users" (id, email, name, role, "emailVerified", "createdAt", "updatedAt") VALUES
      ('u-ana', 'ana@example.com', 'Ana', 'member', true, now(), now()),
      ('u-bea', 'bea@example.com', 'Bea', 'member', true, now(), now()),
      ('u-dev', 'dev@example.com', 'Dev', 'developer', true, now(), now());
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-1', 'One', 'one', 'u-ana'), ('team-2', 'Two', 'two', 'u-ana');
    INSERT INTO team_members ("teamId", "userId", role) VALUES
      ('team-1', 'u-ana', 'owner'), ('team-2', 'u-ana', 'owner'), ('team-1', 'u-bea', 'member'), ('team-1', 'u-dev', 'member')
      ON CONFLICT DO NOTHING;
    INSERT INTO "oauthClient" (id, "clientId", name, uri, "redirectUris") VALUES
      ('c-1', 'https://client.example/meta', 'Client', 'https://client.example', '["https://client.example/cb"]'),
      ('c-2', 'opaque-client', 'Other', NULL, '["https://other.example/cb"]');`)
  const CLIENT = 'https://client.example/meta'

  let serial = 0
  const consent = (userId: string, teamId: string, scopes: string[], clientId = CLIENT) =>
    owner.query(
      `INSERT INTO "oauthConsent" (id, "clientId", "userId", "referenceId", scopes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())`,
      [`consent-${++serial}`, clientId, userId, teamId, JSON.stringify(scopes)]
    )
  const tokenSql = `INSERT INTO "oauthRefreshToken" (id, token, "clientId", "userId", "referenceId", scopes, "expiresAt", "createdAt", revoked, "rotatedAt")
                    VALUES ($1, $1, $2, $3, $4, $5::jsonb, now() + ($6 || ' days')::interval, now(), $7, $7)`
  /** A refresh token: live by default, `replaced` for one that rotation already replaced, `days` until it expires. */
  const tokenArgs = (userId: string, teamId: string, scopes: string[], { replaced = false, days = 30, clientId = CLIENT } = {}) => {
    const id = `rt-${++serial}`
    return { id, args: [id, clientId, userId, teamId, JSON.stringify(scopes), String(days), replaced ? new Date(Date.now() - 60_000) : null] }
  }
  const token = async (userId: string, teamId: string, scopes: string[], options = {}) => {
    const { id, args } = tokenArgs(userId, teamId, scopes, options)
    await owner.query(tokenSql, args)
    return id
  }
  const tokensOf = async (userId: string, teamId: string) =>
    (await owner.query(`SELECT id FROM "oauthRefreshToken" WHERE "userId" = $1 AND "referenceId" = $2 AND "clientId" = $3 ORDER BY id`, [userId, teamId, CLIENT])).rows.map(r => r.id)
  const scopesOf = async (id: string) => (await owner.query(`SELECT scopes FROM "oauthRefreshToken" WHERE id = $1`, [id])).rows[0]?.scopes
  const consentScopes = async (userId: string, teamId: string) =>
    (await owner.query(`SELECT scopes FROM "oauthConsent" WHERE "userId" = $1 AND "referenceId" = $2 AND "clientId" = $3`, [userId, teamId, CLIENT])).rows[0]?.scopes
  const revocations = async (userId: string, teamId: string | null = null) =>
    Number((await owner.query(
      `SELECT count(*) FROM "oauthRevocation" WHERE "userId" = $1 AND ($2::text IS NULL OR "teamId" = $2)`, [userId, teamId]
    )).rows[0].count)
  const reset = () => owner.query(`DELETE FROM "oauthRefreshToken"; DELETE FROM "oauthConsent"; DELETE FROM "oauthRevocation"`)

  await t.test('049 applies on a database with nothing in it, and applying it again changes nothing', async () => {
    const before = (await owner.query(`SELECT tgname FROM pg_trigger WHERE tgname LIKE 'oauth_%' ORDER BY tgname`)).rows.map(r => r.tgname)
    assert.deepEqual(before, [
      'oauth_consent_narrowed',
      'oauth_consent_removed',
      'oauth_consent_requires_membership',
      'oauth_end_on_member_removed',
      'oauth_refresh_token_deleted',
      'oauth_refresh_token_requires_consent',
      'oauth_refresh_token_revoked',
      'oauth_revoke_on_password_change',
      'oauth_revoke_on_suspension',
    ])
    await owner.query(fs.readFileSync(path.join(CORE, 'migrations', '049_oauth_provider.sql'), 'utf8'))
    const after = (await owner.query(`SELECT tgname FROM pg_trigger WHERE tgname LIKE 'oauth_%' ORDER BY tgname`)).rows.map(r => r.tgname)
    assert.deepEqual(after, before)
  })

  await t.test('a refresh token is written only for a connection that is consented to, and within its consent', async () => {
    await reset()
    const refused = tokenArgs('u-ana', 'team-1', [...BASE, READ])
    await assert.rejects(owner.query(tokenSql, refused.args), /oauth connection ended/, 'no consent: refused')

    await consent('u-ana', 'team-1', [...BASE, READ])
    await token('u-ana', 'team-1', [...BASE, READ])
    await token('u-ana', 'team-1', [READ], {}) // a renewal that asked for less
    // a token that would hold more than the consent is written with what the consent has, in the token's order
    const wider = tokenArgs('u-ana', 'team-1', [WRITE, READ, 'customers:read', 'offline_access'])
    await owner.query(tokenSql, wider.args)
    assert.deepEqual(await scopesOf(wider.id), [READ, 'offline_access'])
    // the consent of another team, or of another client, is not this connection's
    await assert.rejects(owner.query(tokenSql, tokenArgs('u-ana', 'team-2', [READ]).args), /oauth connection ended/)
    await assert.rejects(owner.query(tokenSql, tokenArgs('u-ana', 'team-1', [READ], { clientId: 'opaque-client' }).args), /oauth connection ended/)
    // a token with no team is not an MCP grant: left alone
    await owner.query(
      `INSERT INTO "oauthRefreshToken" (id, token, "clientId", "userId", scopes, "expiresAt", "createdAt") VALUES ('rt-no-team', 'rt-no-team', $1, 'u-ana', '["openid"]', now() + interval '1 day', now())`,
      [CLIENT]
    )
    await owner.query(`DELETE FROM "oauthRefreshToken" WHERE id = 'rt-no-team'`)
  })

  await t.test('a connection has one consent: a second row for it is refused', async () => {
    await reset()
    await consent('u-ana', 'team-1', [READ])
    await assert.rejects(consent('u-ana', 'team-1', [READ, WRITE]), /uq_oauth_consent_connection/)
    // another team, another user and another client are other connections
    await consent('u-ana', 'team-2', [READ])
    await consent('u-bea', 'team-1', [READ])
    await consent('u-ana', 'team-1', [READ], 'opaque-client')
  })

  await t.test('ending a connection removes its consent and its tokens and records the revocation; the other connections stay', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ])
    await consent('u-ana', 'team-2', [...BASE, READ])
    await token('u-ana', 'team-1', [...BASE, READ], { replaced: true })
    await token('u-ana', 'team-1', [...BASE, READ])
    const elsewhere = await token('u-ana', 'team-2', [...BASE, READ])

    assert.equal((await store.userConnections('u-ana')).length, 2)
    assert.equal(await store.disconnect('u-ana', CLIENT, 'team-1'), true)
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [])
    assert.equal(await consentScopes('u-ana', 'team-1'), undefined)
    assert.ok((await revocations('u-ana', 'team-1')) >= 1, 'the revocation is recorded')
    assert.deepEqual(await tokensOf('u-ana', 'team-2'), [elsewhere], 'the same client in another team is untouched')
    assert.equal(await revocations('u-ana', 'team-2'), 0)
    assert.deepEqual((await store.userConnections('u-ana')).map(c => c.teamId), ['team-2'])
    assert.equal(await store.disconnect('u-ana', CLIENT, 'team-1'), false, 'nothing left to end')
  })

  await t.test('a consent alone (no refresh token) is ended with a revocation of its own', async () => {
    await reset()
    await consent('u-ana', 'team-1', [READ])
    assert.equal(await store.disconnect('u-ana', CLIENT, 'team-1'), true)
    assert.ok((await revocations('u-ana', 'team-1')) >= 1)
  })

  await t.test('a consent removed by any hand ends its connection for good: nothing comes back with the next consent', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE])
    await consent('u-ana', 'team-2', [...BASE, READ])
    const replaced = await token('u-ana', 'team-1', [...BASE, READ, WRITE], { replaced: true })
    const live = await token('u-ana', 'team-1', [...BASE, READ, WRITE])
    const elsewhere = await token('u-ana', 'team-2', [...BASE, READ])
    const before = await revocations('u-ana', 'team-1')
    // what the authorization server's own endpoint does: the row, and nothing else
    await owner.query(`DELETE FROM "oauthConsent" WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`)
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [], `${replaced} and ${live} went with the consent`)
    assert.ok((await revocations('u-ana', 'team-1')) > before, 'the access tokens issued before are refused from now on')
    assert.deepEqual(await tokensOf('u-ana', 'team-2'), [elsewhere], 'another connection of the same application is untouched')
    // the application is authorized again: a new consent, and nothing of the connection that was ended
    const marker = await revocations('u-ana', 'team-1')
    await consent('u-ana', 'team-1', [...BASE, READ])
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [])
    assert.equal(await revocations('u-ana', 'team-1'), marker, 'the revocation stands: a token issued before it stays refused')
    // a consent with no team is not a connection: removing it records nothing
    await owner.query(`INSERT INTO "oauthConsent" (id, "clientId", "userId", scopes, "createdAt", "updatedAt") VALUES ('consent-no-team', $1, 'u-ana', '["openid"]', now(), now())`, [CLIENT])
    const all = await revocations('u-ana')
    await owner.query(`DELETE FROM "oauthConsent" WHERE id = 'consent-no-team'`)
    assert.equal(await revocations('u-ana'), all)
  })

  await t.test('a renewal that writes its token first: the disconnection waits for it and then removes it', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ])
    await token('u-ana', 'team-1', [...BASE, READ], { replaced: true }) // what rotation left of the old token
    await other.query('BEGIN')
    await other.query(tokenSql, tokenArgs('u-ana', 'team-1', [...BASE, READ]).args) // the new token, not committed yet
    const ending = store.disconnect('u-ana', CLIENT, 'team-1')
    assert.equal(await stillWaiting(ending), true, 'the disconnection waits on the consent row the renewal holds')
    await other.query('COMMIT')
    assert.equal(await ending, true)
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [], 'the token the renewal wrote is gone with the rest')
    assert.ok((await revocations('u-ana', 'team-1')) >= 1)
  })

  await t.test('a disconnection that gets there first: the renewal waits for it and is then refused', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ])
    await token('u-ana', 'team-1', [...BASE, READ], { replaced: true })
    await other.query('BEGIN')
    await other.query(`DELETE FROM "oauthConsent" WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`) // disconnect, first statement
    const renewal = owner.query(tokenSql, tokenArgs('u-ana', 'team-1', [...BASE, READ]).args)
    renewal.catch(() => {})
    assert.equal(await stillWaiting(renewal), true, 'the renewal waits on the consent row being removed')
    await other.query(`DELETE FROM "oauthRefreshToken" WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`)
    await other.query('COMMIT')
    await assert.rejects(renewal, /oauth connection ended/)
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [], 'no live token survives')
  })

  await t.test('consenting again to less cuts the live tokens down to the consent and refuses every access token issued before', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE])
    const broadLive = await token('u-ana', 'team-1', [...BASE, READ, WRITE])
    const narrowLive = await token('u-ana', 'team-1', [...BASE, READ])
    await owner.query(`UPDATE "oauthConsent" SET scopes = $1::jsonb WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`, [JSON.stringify([...BASE, READ])])
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [broadLive, narrowLive].sort(), 'no token is removed: the connection goes on')
    assert.deepEqual(await scopesOf(broadLive), [...BASE, READ], 'the one that held more holds what the consent has')
    assert.deepEqual(await scopesOf(narrowLive), [...BASE, READ])
    assert.equal(await revocations('u-ana', 'team-1'), 1)
  })

  await t.test('the token that held more was already replaced by one that holds less: the revocation is recorded all the same', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE])
    const ancestor = await token('u-ana', 'team-1', [...BASE, READ, WRITE], { replaced: true }) // its access token is still out
    const successor = await token('u-ana', 'team-1', [...BASE, READ])
    await owner.query(`UPDATE "oauthConsent" SET scopes = $1::jsonb WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`, [JSON.stringify([...BASE, READ])])
    assert.equal(await revocations('u-ana', 'team-1'), 1, 'no live token held more, and the access token of the replaced one is refused all the same')
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [ancestor, successor].sort())
    // a replaced token is left as it is: it issues nothing, and the authorization server answers a repeated request from it
    assert.deepEqual(await scopesOf(ancestor), [...BASE, READ, WRITE])
    // consenting to more refuses nothing and changes no token
    await owner.query(`UPDATE "oauthConsent" SET scopes = $1::jsonb WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`, [JSON.stringify([...BASE, READ, WRITE])])
    assert.equal(await revocations('u-ana', 'team-1'), 1)
    assert.deepEqual(await scopesOf(successor), [...BASE, READ])
  })

  await t.test('a renewal of a token that holds more, in flight while the consent is narrowed, ends up holding no more than the consent', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE])
    // the narrowing gets there first: the renewal waits and writes its token with what the consent has by then
    await other.query('BEGIN')
    await other.query(`UPDATE "oauthConsent" SET scopes = $1::jsonb WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`, [JSON.stringify([...BASE, READ])])
    const late = tokenArgs('u-ana', 'team-1', [...BASE, READ, WRITE])
    const renewal = owner.query(tokenSql, late.args)
    assert.equal(await stillWaiting(renewal), true)
    await other.query('COMMIT')
    await renewal
    assert.deepEqual(await scopesOf(late.id), [...BASE, READ])
    // the renewal gets there first: the narrowing waits and then cuts down what it wrote
    await owner.query(`UPDATE "oauthConsent" SET scopes = $1::jsonb WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`, [JSON.stringify([...BASE, READ, WRITE])])
    await other.query('BEGIN')
    const early = tokenArgs('u-ana', 'team-1', [...BASE, READ, WRITE])
    await other.query(tokenSql, early.args)
    const narrowing = owner.query(`UPDATE "oauthConsent" SET scopes = $1::jsonb WHERE "userId" = 'u-ana' AND "referenceId" = 'team-1'`, [JSON.stringify([...BASE, READ])])
    assert.equal(await stillWaiting(narrowing), true)
    await other.query('COMMIT')
    await narrowing
    assert.deepEqual(await scopesOf(early.id), [...BASE, READ])
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [late.id, early.id].sort(), 'both renewals left a token: neither was refused')
  })

  // Better Auth renews in steps, each its own statement: it reads the old token, marks it replaced, writes the new
  // one with the scopes it read. What happens between those steps is what these two follow.
  const markReplaced = (id: string) => owner.query(`UPDATE "oauthRefreshToken" SET revoked = now(), "rotatedAt" = now() WHERE id = $1 AND revoked IS NULL`, [id])
  const liveOf = async (userId: string, teamId: string) =>
    (await owner.query(`SELECT id, scopes FROM "oauthRefreshToken" WHERE "userId" = $1 AND "referenceId" = $2 AND revoked IS NULL AND "expiresAt" > now() ORDER BY id`, [userId, teamId])).rows

  await t.test('permissions taken away between the steps of a renewal: the renewal still leaves a live token, holding less', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE])
    const old = await token('u-ana', 'team-1', [...BASE, READ, WRITE])
    const read = await scopesOf(old) // step 1: the authorization server reads the token it is about to replace
    assert.equal(await store.narrowConnection('u-ana', CLIENT, 'team-1', [READ]), 'narrowed') // the user edits the permissions
    assert.deepEqual(await scopesOf(old), [...BASE, READ])
    assert.equal(await revocations('u-ana', 'team-1'), 1)
    await markReplaced(old) // step 2
    const next = tokenArgs('u-ana', 'team-1', read) // step 3: with the scopes it read at step 1
    await owner.query(tokenSql, next.args)
    assert.deepEqual(await liveOf('u-ana', 'team-1'), [{ id: next.id, scopes: [...BASE, READ] }], 'still connected, with what the consent has')
    assert.equal(await revocations('u-ana', 'team-1'), 1, 'replacing a token is not ending a connection')
  })

  await t.test('a connection ended between the steps of a renewal: the renewal leaves nothing', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ])
    const old = await token('u-ana', 'team-1', [...BASE, READ])
    const read = await scopesOf(old) // step 1
    assert.equal(await store.disconnect('u-ana', CLIENT, 'team-1'), true)
    assert.equal((await markReplaced(old)).rowCount, 0) // step 2 finds nothing to mark
    await assert.rejects(owner.query(tokenSql, tokenArgs('u-ana', 'team-1', read).args), /oauth connection ended/) // step 3
    assert.deepEqual(await liveOf('u-ana', 'team-1'), [])
  })

  await t.test('taking permissions away from a connection cuts its live tokens down: it stays connected with less', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE, 'customers:read'])
    const replaced = await token('u-ana', 'team-1', [...BASE, READ, WRITE, 'customers:read'], { replaced: true })
    const live = await token('u-ana', 'team-1', [...BASE, READ, WRITE, 'customers:read'])

    assert.equal(await store.narrowConnection('u-ana', CLIENT, 'team-1', [READ, 'customers:read', 'posts:delete']), 'narrowed')
    assert.deepEqual(await consentScopes('u-ana', 'team-1'), [...BASE, READ, 'customers:read'], 'what was named and held; nothing is added')
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [replaced, live].sort(), 'no token is removed')
    assert.deepEqual(await scopesOf(live), [...BASE, READ, 'customers:read'])
    assert.deepEqual(await scopesOf(replaced), [...BASE, READ, WRITE, 'customers:read'], 'a replaced token is left as it is')
    assert.equal(await revocations('u-ana', 'team-1'), 1, 'the access tokens issued before are refused')
    assert.deepEqual(await store.grantedScopes('u-ana', CLIENT, 'team-1'), [READ, 'customers:read'])

    assert.equal(await store.narrowConnection('u-ana', CLIENT, 'team-1', [READ, 'customers:read']), 'unchanged')
    assert.equal(await revocations('u-ana', 'team-1'), 1, 'nothing changed, nothing refused')
    assert.equal(await store.narrowConnection('u-ana', CLIENT, 'team-1', []), 'nothing-left')
    assert.equal(await store.narrowConnection('u-ana', CLIENT, 'team-1', ['posts:read']), 'nothing-left')
    assert.deepEqual(await consentScopes('u-ana', 'team-1'), [...BASE, READ, 'customers:read'])
    assert.equal(await store.narrowConnection('u-ana', CLIENT, 'team-2', [READ]), 'not-found')
    assert.equal(await store.grantedScopes('u-ana', CLIENT, 'team-2'), null)
  })

  await t.test('a scope the operator retires is taken away from every connection that holds it, and comes back only with a new consent', async () => {
    await reset()
    // ana in team-1 holds it with other permissions, ana in team-2 holds nothing else, bea does not hold it
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE, 'customers:read'])
    const replaced = await token('u-ana', 'team-1', [...BASE, READ, WRITE, 'customers:read'], { replaced: true })
    const live = await token('u-ana', 'team-1', [...BASE, READ, WRITE, 'customers:read'])
    await consent('u-ana', 'team-2', [...BASE, WRITE])
    await token('u-ana', 'team-2', [...BASE, WRITE])
    await consent('u-bea', 'team-1', [...BASE, READ])
    const hers = await token('u-bea', 'team-1', [...BASE, READ])

    // as the role of the app, which row-level security applies to, it changes nothing: the consents are service-only
    assert.deepEqual((await db.app.query(`SELECT narrowed, ended FROM public.revoke_oauth_scope($1)`, [WRITE])).rows, [{ narrowed: 0, ended: 0 }])
    assert.deepEqual(await consentScopes('u-ana', 'team-1'), [...BASE, READ, WRITE, 'customers:read'])

    assert.deepEqual(await store.revokeScopeFromConnections(WRITE), { narrowed: 1, ended: 1 })

    assert.deepEqual(await consentScopes('u-ana', 'team-1'), [...BASE, READ, 'customers:read'], 'the consent lost it and kept the rest')
    assert.deepEqual(await scopesOf(live), [...BASE, READ, 'customers:read'], 'so did its live token')
    assert.deepEqual(await scopesOf(replaced), [...BASE, READ, WRITE, 'customers:read'], 'a replaced token is left as it is')
    assert.equal(await revocations('u-ana', 'team-1'), 1, 'the access tokens issued before are refused')

    assert.equal(await consentScopes('u-ana', 'team-2'), undefined, 'a connection left with no entity permission is ended')
    assert.deepEqual(await tokensOf('u-ana', 'team-2'), [])
    assert.ok(await revocations('u-ana', 'team-2') >= 1, 'and its access tokens are refused')

    assert.deepEqual(await consentScopes('u-bea', 'team-1'), [...BASE, READ], 'a connection that did not hold it is not touched')
    assert.deepEqual(await scopesOf(hers), [...BASE, READ])
    assert.equal(await revocations('u-bea', 'team-1'), 0)

    // the tool comes back and the application renews with what it remembers: the token is cut down to the consent
    const renewed = await token('u-ana', 'team-1', [...BASE, READ, WRITE, 'customers:read'])
    assert.deepEqual(await scopesOf(renewed), [...BASE, READ, 'customers:read'], 'not held again without a new consent')

    assert.deepEqual(await store.revokeScopeFromConnections(WRITE), { narrowed: 0, ended: 0 }, 'nothing left to take')
    assert.equal(await revocations('u-ana', 'team-1'), 1, 'and nothing refused for it')

    // only an entity permission can be retired: never a wildcard, never an identity scope
    for (const notOne of ['*', 'tasks:*', 'offline_access', 'tasks: write', '']) {
      await assert.rejects(owner.query(`SELECT * FROM public.revoke_oauth_scope($1)`, [notOne]), /not an entity scope/, notOne)
      assert.throws(() => store.revokeScopeFromConnections(notOne), /Not an entity scope/, notOne)
    }
    await assert.rejects(owner.query(`SELECT * FROM public.revoke_oauth_scope(NULL)`), /not an entity scope/)
  })

  await t.test('`nextspark mcp:revoke-scope` reports first, applies with --yes, and refuses a role that cannot see the consents', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ, WRITE])
    await consent('u-ana', 'team-2', [...BASE, WRITE])
    await consent('u-bea', 'team-1', [...BASE, READ])
    await owner.query(`INSERT INTO "oauthResource" (id, identifier, name, "allowedScopes") VALUES ('r-1', 'https://app.example/api/mcp', 'MCP', $1::jsonb) ON CONFLICT (identifier) DO UPDATE SET "allowedScopes" = EXCLUDED."allowedScopes"`, [JSON.stringify([...BASE, READ])])
    const script = path.join(CORE, 'scripts', 'db', 'revoke-oauth-scope.mjs')
    const run = (args: string[], env: Record<string, string>) => {
      const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...env } })
      return { status: result.status, output: `${result.stdout}${result.stderr}` }
    }

    const report = run([WRITE], { DATABASE_URL: db.ownerUrl })
    assert.equal(report.status, 0, report.output)
    assert.match(report.output, /No tool of the running app needs this scope/)
    assert.match(report.output, /Held by 2 connections; 1 of them holds no other permission and would be ended\./)
    assert.match(report.output, /Nothing was changed\. Run it again with --yes/)
    assert.deepEqual(await consentScopes('u-ana', 'team-1'), [...BASE, READ, WRITE], 'reporting changes nothing')

    // a scope a tool still needs is said to be one
    assert.match(run([READ], { DATABASE_URL: db.ownerUrl }).output, /A tool of the running app still needs this scope/)

    // the role of the app after the cutover: it would see no consent and say there is nothing to do
    const blind = run([WRITE, '--yes'], { DATABASE_URL: db.appUrl })
    assert.equal(blind.status, 1)
    assert.match(blind.output, /is subject to row-level security and cannot see the consents\..*Nothing was changed\./s)
    assert.deepEqual(await consentScopes('u-ana', 'team-1'), [...BASE, READ, WRITE])

    // the service role is used before the app's, when the deployment has one
    const applied = run([WRITE, '--yes'], { DATABASE_URL: db.appUrl, DATABASE_SERVICE_URL: db.ownerUrl })
    assert.equal(applied.status, 0, applied.output)
    assert.match(applied.output, /tasks:write revoked: 1 connection narrowed, 1 ended\./)
    assert.deepEqual(await consentScopes('u-ana', 'team-1'), [...BASE, READ])
    assert.equal(await consentScopes('u-ana', 'team-2'), undefined)
    assert.deepEqual(await consentScopes('u-bea', 'team-1'), [...BASE, READ])
    assert.match(run([WRITE, '--yes'], { DATABASE_URL: db.ownerUrl }).output, /Held by 0 connections.*tasks:write revoked: 0 connections narrowed, 0 ended\./s)

    // what is not an entity scope, or not one argument, is refused before connecting
    for (const args of [['*'], ['tasks:*'], ['offline_access'], [], [READ, WRITE], [WRITE, '--force']]) {
      const refused = run(args, { DATABASE_URL: db.ownerUrl })
      assert.equal(refused.status, 1, args.join(' '))
      assert.match(refused.output, /Nothing was changed\./, args.join(' '))
    }
    assert.match(run([WRITE], {}).output, /None of MIGRATE_DATABASE_URL, DATABASE_SERVICE_URL and DATABASE_URL is set/)
    await owner.query(`DELETE FROM "oauthResource" WHERE id = 'r-1'`)
  })

  await t.test("ending another member's connection decides on the roles the database has at that moment, and holds them", async () => {
    await reset()
    await consent('u-bea', 'team-1', [...BASE, READ])
    const hers = await token('u-bea', 'team-1', [...BASE, READ])
    const seen: Array<[string | null, string]> = []
    const decide = (answer: boolean) => (appRole: string | null, teamRole: string) => { seen.push([appRole, teamRole]); return answer }

    assert.equal(await store.disconnectAs('u-ana', decide(false), 'u-bea', CLIENT, 'team-1'), false)
    assert.deepEqual(await tokensOf('u-bea', 'team-1'), [hers], 'refused: nothing is touched')
    assert.equal(await store.disconnectAs('nobody', decide(true), 'u-bea', CLIENT, 'team-1'), false, 'not a member of the team: never asked')
    assert.deepEqual(seen, [['member', 'owner']], 'the role in the app and the role in the team, read together')

    // the role in the app is being changed at this moment: the disconnection waits for that change and decides on its result
    await other.query('BEGIN')
    await other.query(`UPDATE "users" SET role = 'member' WHERE id = 'u-dev'`)
    const byDev = store.disconnectAs('u-dev', (appRole, teamRole) => { seen.push([appRole, teamRole]); return appRole === 'developer' }, 'u-bea', CLIENT, 'team-1')
    assert.equal(await stillWaiting(byDev), true, 'waits on the row of the user whose role is changing')
    await other.query('COMMIT')
    assert.equal(await byDev, false)
    assert.deepEqual(seen.at(-1), ['member', 'member'], 'decided on the role as it is after the change')
    assert.deepEqual(await tokensOf('u-bea', 'team-1'), [hers])

    assert.equal(await store.disconnectAs('u-ana', decide(true), 'u-bea', CLIENT, 'team-1'), true)
    assert.deepEqual(await tokensOf('u-bea', 'team-1'), [])
    assert.ok((await revocations('u-bea', 'team-1')) >= 1)
  })

  await t.test('other members\' connections are read by team, and never the reader\'s own', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ])
    await consent('u-bea', 'team-1', [...BASE, READ, WRITE])
    await token('u-ana', 'team-1', [...BASE, READ])
    await token('u-bea', 'team-1', [...BASE, READ, WRITE])
    const others = await store.othersConnections('u-ana', ['team-1', 'team-2'])
    assert.deepEqual(others.map(c => [c.userId, c.teamId, c.clientHost, c.scopes]), [['u-bea', 'team-1', 'client.example', [READ, WRITE]]])
    assert.deepEqual(await store.othersConnections('u-ana', []), [])
    assert.deepEqual((await store.membershipsOf('u-ana')).map(m => `${m.teamId}:${m.role}`).sort(), ['team-1:owner', 'team-2:owner'])
  })

  await t.test('a suspended account loses its consents with its tokens, so every application asks again', async () => {
    await reset()
    await consent('u-bea', 'team-1', [...BASE, READ])
    const hers = await token('u-bea', 'team-1', [...BASE, READ])
    await owner.query(`UPDATE "users" SET role = 'suspended' WHERE id = 'u-bea'`)
    assert.equal(await consentScopes('u-bea', 'team-1'), undefined)
    assert.deepEqual(await tokensOf('u-bea', 'team-1'), [], `${hers} went with its consent`)
    assert.ok((await revocations('u-bea')) >= 1)
    await assert.rejects(owner.query(tokenSql, tokenArgs('u-bea', 'team-1', [...BASE, READ]).args), /oauth connection ended/, 'a renewal in flight cannot write its token')
    await owner.query(`UPDATE "users" SET role = 'member' WHERE id = 'u-bea'`)
  })

  await t.test('a member removed from a team loses the connections to it, and they do not come back when the member does', async () => {
    await reset()
    await consent('u-bea', 'team-1', [...BASE, READ, WRITE])
    await consent('u-bea', 'team-1', [...BASE, READ], 'opaque-client')
    await consent('u-ana', 'team-1', [...BASE, READ])
    const replaced = await token('u-bea', 'team-1', [...BASE, READ, WRITE], { replaced: true })
    const live = await token('u-bea', 'team-1', [...BASE, READ, WRITE])
    const anas = await token('u-ana', 'team-1', [...BASE, READ])
    const before = await revocations('u-bea', 'team-1')

    await owner.query(`DELETE FROM team_members WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`)
    assert.deepEqual(await tokensOf('u-bea', 'team-1'), [], `${replaced} and ${live} went with the membership`)
    assert.equal(await consentScopes('u-bea', 'team-1'), undefined)
    assert.equal(Number((await owner.query(`SELECT count(*) FROM "oauthConsent" WHERE "userId" = 'u-bea'`)).rows[0].count), 0, 'every application, not one')
    assert.ok((await revocations('u-bea', 'team-1')) >= before + 2, 'one revocation for each connection that ended')
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [anas], 'another member of the team keeps theirs')
    // a renewal in flight cannot write its new token: there is no consent left for it
    await assert.rejects(owner.query(tokenSql, tokenArgs('u-bea', 'team-1', [READ]).args), /oauth connection ended/)

    // back in the team, with whatever role: nothing of the old connections is there
    await owner.query(`INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-1', 'u-bea', 'admin')`)
    assert.deepEqual(await tokensOf('u-bea', 'team-1'), [])
    assert.equal(await consentScopes('u-bea', 'team-1'), undefined)
    assert.deepEqual((await store.userConnections('u-bea')).map(c => c.teamId), [])
    await owner.query(`UPDATE team_members SET role = 'member' WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`)
  })

  await t.test('a consent is written only for a member of the team', async () => {
    await reset()
    await assert.rejects(consent('u-bea', 'team-2', [READ]), /oauth consent refused/, 'Bea is not in team 2')
    await assert.rejects(consent('u-ana', 'no-such-team', [READ]), /oauth consent refused/)
    await consent('u-bea', 'team-1', [READ])
    // moved to a team the user is not in: refused as well
    await assert.rejects(owner.query(`UPDATE "oauthConsent" SET "referenceId" = 'team-2' WHERE "userId" = 'u-bea'`), /oauth consent refused/)
    // a consent with no team is not an MCP grant: left alone
    await owner.query(`INSERT INTO "oauthConsent" (id, "clientId", "userId", scopes, "createdAt", "updatedAt") VALUES ('consent-no-team', $1, 'u-bea', '["openid"]', now(), now())`, [CLIENT])
    await owner.query(`DELETE FROM "oauthConsent" WHERE id = 'consent-no-team'`)
  })

  await t.test('a removal that gets there first: the consent being written waits for it and is then refused', async () => {
    await reset()
    await other.query('BEGIN')
    await other.query(`DELETE FROM team_members WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`)
    let settled = false
    const writing = consent('u-bea', 'team-1', [...BASE, READ]).then(
      () => { settled = true; return 'written' },
      (error: Error) => { settled = true; return error.message }
    )
    await new Promise(resolve => setTimeout(resolve, 300))
    assert.equal(settled, false, 'the consent waits for the removal to end')
    await other.query('COMMIT')
    assert.match(await writing, /oauth consent refused/)
    assert.equal(await consentScopes('u-bea', 'team-1'), undefined)
    await owner.query(`INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-1', 'u-bea', 'member')`)
  })

  await t.test('a consent that gets there first: the removal waits for it and then takes it away', async () => {
    await reset()
    await other.query('BEGIN')
    await other.query(
      `INSERT INTO "oauthConsent" (id, "clientId", "userId", "referenceId", scopes, "createdAt", "updatedAt") VALUES ('consent-race', $1, 'u-bea', 'team-1', $2::jsonb, now(), now())`,
      [CLIENT, JSON.stringify([...BASE, READ])]
    )
    let removed = false
    const removing = owner.query(`DELETE FROM team_members WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`).then(() => { removed = true })
    await new Promise(resolve => setTimeout(resolve, 300))
    assert.equal(removed, false, 'the removal waits for the consent being written')
    await other.query('COMMIT')
    await removing
    assert.equal(await consentScopes('u-bea', 'team-1'), undefined, 'the consent written just before went with the membership')
    await owner.query(`INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-1', 'u-bea', 'member')`)
  })

  await t.test('a change of role does not wait for a consent being written, nor the other way round', async () => {
    await reset()
    await other.query('BEGIN')
    await other.query(
      `INSERT INTO "oauthConsent" (id, "clientId", "userId", "referenceId", scopes, "createdAt", "updatedAt") VALUES ('consent-role', $1, 'u-bea', 'team-1', '["tasks:read"]', now(), now())`,
      [CLIENT]
    )
    await owner.query(`UPDATE team_members SET role = 'admin' WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`)
    await other.query('COMMIT')
    await owner.query(`UPDATE team_members SET role = 'member' WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`)
  })

  await t.test('a change of role is not a removal: the connection stays', async () => {
    await reset()
    await consent('u-bea', 'team-1', [...BASE, READ])
    const live = await token('u-bea', 'team-1', [...BASE, READ])
    await owner.query(`UPDATE team_members SET role = 'admin' WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`)
    assert.deepEqual(await tokensOf('u-bea', 'team-1'), [live])
    await owner.query(`UPDATE team_members SET role = 'member' WHERE "teamId" = 'team-1' AND "userId" = 'u-bea'`)
  })

  await t.test('deleting a team ends every connection to it, and leaves the connections to other teams', async () => {
    await reset()
    await owner.query(`INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-3', 'Three', 'three', 'u-ana')`)
    await owner.query(`INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-3', 'u-ana', 'owner'), ('team-3', 'u-bea', 'member')`)
    await consent('u-ana', 'team-3', [...BASE, READ])
    await consent('u-bea', 'team-3', [...BASE, READ])
    await consent('u-ana', 'team-1', [...BASE, READ])
    await token('u-ana', 'team-3', [...BASE, READ])
    await token('u-bea', 'team-3', [...BASE, READ])
    const elsewhere = await token('u-ana', 'team-1', [...BASE, READ])

    // what TeamService.delete does: the team is marked and its members removed
    await owner.query(`UPDATE teams SET "deletedAt" = now() WHERE id = 'team-3'`)
    await owner.query(`DELETE FROM team_members WHERE "teamId" = 'team-3'`)
    assert.deepEqual(await tokensOf('u-ana', 'team-3'), [])
    assert.deepEqual(await tokensOf('u-bea', 'team-3'), [])
    assert.equal(Number((await owner.query(`SELECT count(*) FROM "oauthConsent" WHERE "referenceId" = 'team-3'`)).rows[0].count), 0)
    assert.ok((await revocations('u-ana', 'team-3')) >= 1)
    assert.ok((await revocations('u-bea', 'team-3')) >= 1)
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [elsewhere])

    // and when the row itself is purged, with members still in it: the cascade ends them the same way
    await owner.query(`INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-4', 'Four', 'four', 'u-ana')`)
    await owner.query(`INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-4', 'u-bea', 'member')`)
    await consent('u-bea', 'team-4', [...BASE, READ])
    await token('u-bea', 'team-4', [...BASE, READ])
    await owner.query(`DELETE FROM teams WHERE id = 'team-4'`)
    assert.deepEqual(await tokensOf('u-bea', 'team-4'), [])
    await owner.query(`DELETE FROM teams WHERE id = 'team-3'`)
  })

  await t.test('a user who is deleted takes their connections with them, and nothing fails on the way', async () => {
    await reset()
    await owner.query(`INSERT INTO "users" (id, email, name, role, "emailVerified", "createdAt", "updatedAt") VALUES ('u-gone', 'gone@example.com', 'Gone', 'member', true, now(), now())`)
    await owner.query(`INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-1', 'u-gone', 'member')`)
    await consent('u-gone', 'team-1', [...BASE, READ])
    await token('u-gone', 'team-1', [...BASE, READ])
    await owner.query(`DELETE FROM "users" WHERE id = 'u-gone'`)
    assert.deepEqual(await tokensOf('u-gone', 'team-1'), [])
    assert.equal(Number((await owner.query(`SELECT count(*) FROM "oauthConsent" WHERE "userId" = 'u-gone'`)).rows[0].count), 0)
  })

  await t.test('the purge removes what expired and keeps a replaced token until its own expiry', async () => {
    await reset()
    await consent('u-ana', 'team-1', [...BASE, READ])
    const live = await token('u-ana', 'team-1', [...BASE, READ])
    const replaced = await token('u-ana', 'team-1', [...BASE, READ], { replaced: true })
    const expired = await token('u-ana', 'team-1', [...BASE, READ], { days: -2 })
    const justExpired = await token('u-ana', 'team-1', [...BASE, READ], { days: 0 })
    // a replaced token is old news after a day, and still what the authorization server recognises a reuse by
    await owner.query(`UPDATE "oauthRefreshToken" SET revoked = now() - interval '5 days', "rotatedAt" = now() - interval '5 days' WHERE id = $1`, [replaced])
    await owner.query(`INSERT INTO "oauthRevocation" ("userId", "clientId", "teamId", "revokedAt") VALUES
      ('u-ana', $1, 'team-1', now() - interval '3 days'), ('u-ana', $1, 'team-1', now() - interval '2 days'), ('u-bea', $1, 'team-1', now() - interval '9 days')`, [CLIENT])

    const result = await purgeExpiredOAuth()
    assert.equal(result.refreshTokens, 1)
    assert.deepEqual(await tokensOf('u-ana', 'team-1'), [live, replaced, justExpired].sort(), `${expired} went, nothing else`)
    assert.equal(result.revocations, 1, "the older of ana's two; each user's newest stays whatever its age")
    assert.equal(await revocations('u-ana'), 1)
    assert.equal(await revocations('u-bea'), 1)
    assert.deepEqual(await purgeExpiredOAuth(), { refreshTokens: 0, accessTokens: 0, clientAssertions: 0, teamSelections: 0, revocations: 0, signingKeys: 0 })
  })
})

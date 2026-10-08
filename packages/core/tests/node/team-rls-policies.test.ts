/**
 * The team policies on the RLS-enforced connection (the documented nextspark_app cutover): core's migrations run as
 * the owner, then every statement runs as a login role that inherits nextspark_app, with app.user_id set as the app
 * sets it. The statements are the ones the API routes send.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the
 * PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** A throwaway cluster with core's migrations (no sample data), an owner client and an app client. */
async function cutoverDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-rls-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const connect = async (user: string) => {
    const client = new pg.Client({ connectionString: `postgresql://${user}@127.0.0.1:${port}/postgres?sslmode=disable` })
    // the cluster stops under it at the end of the test
    client.on('error', () => {})
    await client.connect()
    t.after(() => client.end())
    return client
  }
  const owner = await connect('owner')
  for (const file of fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql').sort()) {
    await owner.query(fs.readFileSync(path.join(CORE, 'migrations', file), 'utf8'))
  }
  // the documented cutover: a login without BYPASSRLS that inherits nextspark_app
  await owner.query('CREATE ROLE app_login LOGIN NOSUPERUSER NOBYPASSRLS INHERIT IN ROLE nextspark_app')
  const app = await connect('app_login')
  return { owner, app }
}

/** Runs `sql` on the app connection as `userId`, in its own transaction, as lib/db.ts does. */
function asUser(app: pg.Client) {
  return async (userId: string, sql: string, params: unknown[] = []) => {
    await app.query('BEGIN')
    try {
      await app.query(`SET LOCAL app.user_id = '${userId}'`)
      const result = await app.query(sql, params)
      await app.query('COMMIT')
      return result
    } catch (error) {
      await app.query('ROLLBACK')
      throw error
    }
  }
}

const RLS = /row-level security|cannot change/

async function seed(owner: pg.Client) {
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('owna', 'owna@example.test', 'Owner A', 'member', true),
      ('adma', 'adma@example.test', 'Admin A', 'member', true),
      ('mema', 'mema@example.test', 'Member A', 'member', true),
      ('ownb', 'ownb@example.test', 'Owner B', 'member', true),
      ('memb', 'memb@example.test', 'Member B', 'member', true),
      ('inv', 'Inv@Example.test', 'Invitee', 'member', true),
      ('outsider', 'outsider@example.test', 'Outsider', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'owna'), ('team-b', 'Team B', 'team-b', 'ownb');
    INSERT INTO team_members ("teamId", "userId", role) VALUES
      ('team-a', 'owna', 'owner'), ('team-a', 'adma', 'admin'), ('team-a', 'mema', 'member'),
      ('team-b', 'ownb', 'owner'), ('team-b', 'memb', 'member');
    INSERT INTO team_invitations (id, "teamId", email, role, token, "invitedBy") VALUES
      ('inv-a', 'team-a', 'inv@example.test', 'member', 'token-a', 'owna'),
      ('inv-b', 'team-b', 'inv@example.test', 'member', 'token-b', 'ownb');
    INSERT INTO team_invitations (id, "teamId", email, role, token, "invitedBy", "expiresAt") VALUES
      ('inv-old', 'team-b', 'outsider@example.test', 'member', 'token-old', 'ownb', now() - interval '1 day');
  `)
}

test('a user creates a team and joins it as its owner, once', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  await seed(owner)
  const as = asUser(app)

  // POST /api/v1/teams
  const created = await as('memb', `INSERT INTO "teams" (name, slug, description, "ownerId") VALUES ($1, $2, $3, $4) RETURNING *`, ['New', 'new-team', null, 'memb'])
  const teamId = created.rows[0].id
  await as('memb', `INSERT INTO "team_members" ("teamId", "userId", role, "joinedAt") VALUES ($1, $2, 'owner', NOW())`, [teamId, 'memb'])
  assert.equal((await as('memb', 'SELECT role FROM "team_members" WHERE "teamId" = $1', [teamId])).rows[0].role, 'owner')

  // nobody else becomes its owner, and its owner does not join it twice
  await assert.rejects(as('outsider', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ($1, 'outsider', 'owner')`, [teamId]), RLS)
  await assert.rejects(as('memb', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-b', 'memb', 'owner')`), RLS)
  // a team created for someone else is refused, as before
  await assert.rejects(as('memb', `INSERT INTO "teams" (name, slug, "ownerId") VALUES ('X', 'x-team', 'owna') RETURNING *`), RLS)
  // the owner of a team with members cannot add a second owner row (the creator's own team A)
  await assert.rejects(as('owna', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-a', 'outsider', 'owner')`), RLS)
})

test('an existing user accepts or declines their own invitation, and only that', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  await seed(owner)
  const as = asUser(app)

  // the role of another invitation, or no invitation at all, is refused
  await assert.rejects(as('inv', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-a', 'inv', 'admin')`), RLS)
  await assert.rejects(as('outsider', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-a', 'outsider', 'member')`), RLS)
  // an expired invitation does not let its invitee in
  await assert.rejects(as('outsider', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-b', 'outsider', 'member')`), RLS)
  // a member does not add someone else, even someone invited
  await assert.rejects(as('owna', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-a', 'inv', 'member')`), RLS)
  // the invitee does not change the invitation's role or team
  await assert.rejects(as('inv', `UPDATE "team_invitations" SET role = 'admin' WHERE id = 'inv-a'`), RLS)
  await assert.rejects(as('inv', `UPDATE "team_invitations" SET "teamId" = 'team-b' WHERE id = 'inv-a'`), RLS)
  // nor its expiry: the join check trusts it
  await assert.rejects(as('inv', `UPDATE "team_invitations" SET "expiresAt" = now() + interval '10 years' WHERE id = 'inv-a'`), RLS)

  // POST /api/v1/team-invitations/:token/accept, in one transaction (the email differs in case)
  await app.query('BEGIN')
  await app.query(`SET LOCAL app.user_id = 'inv'`)
  const member = await app.query(
    `INSERT INTO "team_members" ("teamId", "userId", role, "invitedBy", "joinedAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    ['team-a', 'inv', 'member', 'owna']
  )
  const accepted = await app.query(`UPDATE "team_invitations" SET status = 'accepted', "acceptedAt" = NOW(), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`, ['inv-a'])
  await app.query('COMMIT')
  assert.equal(member.rows[0].role, 'member')
  // joining already consumed the invitation, so the route's own claim finds nothing left to change
  assert.equal(accepted.rowCount, 0)
  assert.equal((await owner.query(`SELECT status FROM team_invitations WHERE id = 'inv-a'`)).rows[0].status, 'accepted')

  // an accepted invitation does not let them join again (no second row, no second team)
  await assert.rejects(as('inv', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-a', 'inv', 'member')`), /duplicate|row-level security/)
  // nor after being removed
  assert.equal((await as('owna', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'inv'`)).rowCount, 1)
  await assert.rejects(as('inv', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-a', 'inv', 'member')`), RLS)

  // POST /api/v1/team-invitations/:token/decline
  const declined = await as('inv', `UPDATE "team_invitations" SET status = 'declined', "declinedAt" = NOW(), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, ['inv-b'])
  assert.equal(declined.rowCount, 1)
  // the invitee of an expired invitation marks it expired (the accept route does)
  assert.equal((await as('outsider', `UPDATE "team_invitations" SET status = 'expired' WHERE id = 'inv-old'`)).rowCount, 1)
  // nobody else answers someone's invitation
  await owner.query(`INSERT INTO team_invitations (id, "teamId", email, role, token, "invitedBy") VALUES ('inv-c', 'team-b', 'mema@example.test', 'member', 'token-c', 'ownb')`)
  assert.equal((await as('memb', `UPDATE "team_invitations" SET status = 'accepted' WHERE id = 'inv-c'`)).rowCount, 0)
})

test('team_members follow the API: owner and admin manage lower roles, nobody touches the owner row, anyone else leaves', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  await seed(owner)
  const as = asUser(app)
  const count = async (sql: string, params: unknown[] = []) => (await owner.query(sql, params)).rowCount

  // a plain member of team B: no self-promotion, no demoting or removing the owner, no outsider
  assert.equal((await as('memb', `UPDATE "team_members" SET role = 'owner' WHERE "teamId" = 'team-b' AND "userId" = 'memb'`)).rowCount, 0)
  assert.equal((await as('memb', `UPDATE "team_members" SET role = 'admin' WHERE "teamId" = 'team-b' AND "userId" = 'memb'`)).rowCount, 0)
  assert.equal((await as('memb', `UPDATE "team_members" SET role = 'member' WHERE "teamId" = 'team-b' AND "userId" = 'ownb'`)).rowCount, 0)
  assert.equal((await as('memb', `DELETE FROM "team_members" WHERE "teamId" = 'team-b' AND "userId" = 'ownb'`)).rowCount, 0)
  await assert.rejects(as('memb', `INSERT INTO "team_members" ("teamId", "userId", role) VALUES ('team-b', 'owna', 'owner')`), RLS)
  // a foreign owner reaches nothing in team A
  assert.equal((await as('ownb', `UPDATE "team_members" SET role = 'viewer' WHERE "teamId" = 'team-a' AND "userId" = 'mema'`)).rowCount, 0)
  assert.equal((await as('ownb', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'mema'`)).rowCount, 0)

  // an admin manages members, not admins nor the owner, and does not grant admin or owner
  assert.equal((await as('adma', `UPDATE "team_members" SET role = 'viewer' WHERE "teamId" = 'team-a' AND "userId" = 'mema'`)).rowCount, 1)
  await assert.rejects(as('adma', `UPDATE "team_members" SET role = 'admin' WHERE "teamId" = 'team-a' AND "userId" = 'mema'`), RLS)
  assert.equal((await as('adma', `UPDATE "team_members" SET role = 'member' WHERE "teamId" = 'team-a' AND "userId" = 'owna'`)).rowCount, 0)
  assert.equal((await as('adma', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'owna'`)).rowCount, 0)

  // the owner promotes and demotes (the members route), never to owner, and never edits their own row
  assert.equal((await as('owna', `UPDATE "team_members" SET role = 'admin', "updatedAt" = CURRENT_TIMESTAMP WHERE "teamId" = 'team-a' AND "userId" = 'mema' RETURNING *`)).rowCount, 1)
  assert.equal((await as('owna', `UPDATE "team_members" SET role = 'member' WHERE "teamId" = 'team-a' AND "userId" = 'mema'`)).rowCount, 1)
  await assert.rejects(as('owna', `UPDATE "team_members" SET role = 'owner' WHERE "teamId" = 'team-a' AND "userId" = 'adma'`), RLS)
  assert.equal((await as('owna', `UPDATE "team_members" SET role = 'admin' WHERE "teamId" = 'team-a' AND "userId" = 'owna'`)).rowCount, 0)
  // a membership does not move to another user
  await assert.rejects(as('owna', `UPDATE "team_members" SET "userId" = 'outsider' WHERE "teamId" = 'team-a' AND "userId" = 'mema'`), /cannot change/)

  // a superadmin has no RLS path to memberships: deleting a user removes them through the foreign key's cascade
  await owner.query(`INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('sup', 'sup@example.test', 'Super', 'superadmin', true)`)
  assert.equal((await as('sup', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'owna'`)).rowCount, 0)
  assert.equal((await as('sup', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'mema'`)).rowCount, 0)

  // leaving: anyone but the owner
  assert.equal((await as('owna', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'owna'`)).rowCount, 0)
  assert.equal((await as('mema', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'mema'`)).rowCount, 1)
  // the owner removes an admin (the members route's DELETE)
  assert.equal((await as('owna', `DELETE FROM "team_members" WHERE "teamId" = 'team-a' AND "userId" = 'adma' RETURNING id`)).rowCount, 1)
  assert.equal(await count(`SELECT 1 FROM team_members WHERE "teamId" = 'team-a'`), 1)
  // deleting the team still removes its members (the foreign key's cascade)
  await as('owna', `DELETE FROM "teams" WHERE id = 'team-a'`)
  assert.equal(await count(`SELECT 1 FROM team_members WHERE "teamId" = 'team-a'`), 0)
})

const RELATIONS = fs.readFileSync(path.join(CORE, 'templates/projects/starter/entities/posts/migrations/004_entity_taxonomy_relations.sql'), 'utf8')
const PERMISSIVE = `
  DROP POLICY "Entity taxonomy relations authenticated read" ON entity_taxonomy_relations;
  DROP POLICY "Entity taxonomy relations authenticated insert" ON entity_taxonomy_relations;
  DROP POLICY "Entity taxonomy relations authenticated delete" ON entity_taxonomy_relations;
  CREATE POLICY "Entity taxonomy relations authenticated read" ON entity_taxonomy_relations FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Entity taxonomy relations authenticated insert" ON entity_taxonomy_relations FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Entity taxonomy relations authenticated delete" ON entity_taxonomy_relations FOR DELETE TO authenticated USING (true);`

for (const upgrade of [false, true]) {
  test(`taxonomy relations stay inside the entity's team (${upgrade ? 'a project created before, upgraded by 033' : 'a new project'})`, { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
    const { owner, app } = await cutoverDatabase(t)
    await seed(owner)
    // the posts and pages tables of the posts entity, reduced to what the relations look at; a theme entity with a team
    await owner.query(`
      CREATE TABLE posts (id TEXT PRIMARY KEY, "teamId" TEXT, status TEXT, locale TEXT);
      CREATE TABLE pages (id TEXT PRIMARY KEY, "teamId" TEXT, status TEXT, locale TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, "teamId" TEXT);
    `)
    await owner.query(RELATIONS)
    if (upgrade) {
      await owner.query(PERMISSIVE)
      await owner.query(fs.readFileSync(path.join(CORE, 'migrations/033_team_member_roles_and_taxonomy_relations.sql'), 'utf8'))
    }
    await owner.query(`
      INSERT INTO posts VALUES ('post-a', 'team-a', 'published', 'en'), ('post-b', 'team-b', 'draft', 'en');
      INSERT INTO products VALUES ('prod-a', 'team-a');
      INSERT INTO taxonomies (id, type, slug, name, "teamId") VALUES
        ('cat-a', 'post_category', 'cat-a', 'Cat A', 'team-a'), ('cat-b', 'post_category', 'cat-b', 'Cat B', 'team-b'),
        ('cat-global', 'post_category', 'cat-global', 'Cat global', NULL), ('tag-a', 'media_tag', 'tag-a', 'Tag A', 'team-a');
      INSERT INTO media (id, "userId", "teamId", url, filename, "fileSize", "mimeType") VALUES ('media-a', 'owna', 'team-a', 'https://x.test/a.png', 'a.png', 1, 'image/png');
      INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES
        ('posts', 'post-a', 'cat-a'), ('posts', 'post-b', 'cat-b'), ('media', 'media-a', 'tag-a');
    `)
    const as = asUser(app)

    // another team's member: reads, unlinks and links nothing of team A
    assert.equal((await as('memb', `SELECT * FROM entity_taxonomy_relations WHERE "entityId" IN ('post-a', 'media-a')`)).rowCount, 0)
    assert.equal((await as('memb', `DELETE FROM entity_taxonomy_relations WHERE "entityId" IN ('post-a', 'media-a')`)).rowCount, 0)
    await assert.rejects(as('memb', `INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES ('media', 'media-a', 'cat-b')`), RLS)
    await assert.rejects(as('memb', `INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES ('posts', 'post-a', 'cat-global')`), RLS)
    // their own team's rows
    assert.equal((await as('memb', `SELECT * FROM entity_taxonomy_relations`)).rowCount, 1)

    // a member of team A: their entities, with their team's taxonomies or global ones, not another team's
    assert.equal((await as('mema', `SELECT * FROM entity_taxonomy_relations`)).rowCount, 2)
    await assert.rejects(as('mema', `INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES ('posts', 'post-a', 'cat-b')`), RLS)
    await as('mema', `INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES ('posts', 'post-a', 'cat-global')`)
    await as('mema', `INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES ('products', 'prod-a', 'cat-a')`)
    await assert.rejects(as('mema', `INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES ('no_such_table', 'x', 'cat-a')`), RLS)
    assert.equal((await as('mema', `DELETE FROM entity_taxonomy_relations WHERE "entityId" = 'post-a' AND "taxonomyId" = 'cat-global'`)).rowCount, 1)

    // deleting a post on the RLS connection still removes its relations (the cleanup trigger)
    await as('mema', `DELETE FROM posts WHERE id = 'post-a'`)
    assert.equal((await owner.query(`SELECT 1 FROM entity_taxonomy_relations WHERE "entityId" = 'post-a'`)).rowCount, 0)
  })
}

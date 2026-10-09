/**
 * Deleting a media row removes its taxonomy relations. 021 created that trigger only when entity_taxonomy_relations
 * already existed, and the posts entity migration that creates it runs after core's, so a fresh database never had
 * it; 034 creates it whatever the order. The migrations run as db:migrate orders them: core's (no sample data), then
 * the starter's entity migrations sorted by file name.
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
const STARTER_ENTITIES = path.join(CORE, 'templates/projects/starter/entities')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

async function throwawayDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-trigger-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const client = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable` })
  // the cluster stops under it at the end of the test
  client.on('error', () => {})
  await client.connect()
  t.after(() => client.end())
  return client
}

const coreMigrations = () =>
  fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql').sort()
    .map(f => path.join(CORE, 'migrations', f))

const starterEntityMigrations = () =>
  fs.readdirSync(STARTER_ENTITIES)
    .flatMap(entity => {
      const dir = path.join(STARTER_ENTITIES, entity, 'migrations')
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).map(f => path.join(dir, f)) : []
    })
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

async function run(client: pg.Client, files: string[]) {
  for (const file of files) await client.query(fs.readFileSync(file, 'utf8'))
}

async function mediaTriggers(client: pg.Client) {
  const { rows } = await client.query(
    `SELECT t.tgname, p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'public.media'::regclass AND NOT t.tgisinternal AND t.tgname = 'cleanup_media_entity_taxonomy'`,
  )
  return rows as Array<{ tgname: string; proname: string }>
}

/** A media row with one tag relation; returns the number of its relations left after a hard delete of the row. */
async function relationsLeftAfterHardDelete(client: pg.Client) {
  await client.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('u1', 'u1@example.test', 'U1', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-1', 'Team 1', 'team-1', 'u1');
    INSERT INTO media (id, "userId", "teamId", url, filename, "fileSize", "mimeType")
      VALUES ('m1', 'u1', 'team-1', 'https://cdn.example.test/a.png', 'a.png', 10, 'image/png'),
             ('m2', 'u1', 'team-1', 'https://cdn.example.test/b.png', 'b.png', 10, 'image/png');
    INSERT INTO taxonomies (id, type, slug, name, "teamId") VALUES ('tag-1', 'media_tag', 'tag-1', 'Tag 1', 'team-1');
    INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId") VALUES ('media', 'm1', 'tag-1'), ('media', 'm2', 'tag-1');
  `)
  await client.query(`DELETE FROM media WHERE id = 'm1'`)
  const { rows } = await client.query(`SELECT "entityId" FROM entity_taxonomy_relations WHERE "entityType" = 'media' ORDER BY 1`)
  return rows.map(r => r.entityId)
}

test('on a fresh database the trigger exists after every migration, and a hard delete removes the media relations', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const client = await throwawayDatabase(t)
  await run(client, [...coreMigrations(), ...starterEntityMigrations()])
  assert.deepEqual(await mediaTriggers(client), [{ tgname: 'cleanup_media_entity_taxonomy', proname: 'cleanup_media_entity_taxonomy_relations' }])
  assert.deepEqual(await relationsLeftAfterHardDelete(client), ['m2'])
})

test('a hard delete of media works when no entity_taxonomy_relations table exists', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const client = await throwawayDatabase(t)
  await run(client, coreMigrations())
  await client.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('u1', 'u1@example.test', 'U1', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-1', 'Team 1', 'team-1', 'u1');
    INSERT INTO media (id, "userId", "teamId", url, filename, "fileSize", "mimeType")
      VALUES ('m1', 'u1', 'team-1', 'https://cdn.example.test/a.png', 'a.png', 10, 'image/png');
  `)
  const { rowCount } = await client.query(`DELETE FROM media WHERE id = 'm1'`)
  assert.equal(rowCount, 1)
})

test('on a database where 021 created the trigger, 034 replaces it with one trigger of the same effect, idempotently', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const client = await throwawayDatabase(t)
  const [before034, migration034] = [coreMigrations().filter(f => !f.includes('034_')), coreMigrations().find(f => f.includes('034_'))!]
  await run(client, [...before034, ...starterEntityMigrations()])
  // what 021 creates when the relations table already exists
  await client.query(`CREATE TRIGGER cleanup_media_entity_taxonomy AFTER DELETE ON public."media"
    FOR EACH ROW EXECUTE FUNCTION public.cleanup_entity_taxonomy_relations('media')`)
  await run(client, [migration034, migration034])
  assert.deepEqual(await mediaTriggers(client), [{ tgname: 'cleanup_media_entity_taxonomy', proname: 'cleanup_media_entity_taxonomy_relations' }])
  assert.deepEqual(await relationsLeftAfterHardDelete(client), ['m2'])
})

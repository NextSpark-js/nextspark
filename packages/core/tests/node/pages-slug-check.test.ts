/**
 * The slug CHECK of pages follows `access.allowNestedSlugs` (#332). 004_pages_slug_check.sql replaces `valid_slug`
 * with the rule the entity config asks for, and db:migrate tells it which one (nextspark.pages_allow_nested_slugs).
 * `a/b` is accepted by the app (`validatePublicSlug`) and by the database with `true`, and refused by both with `false`.
 *
 * Throwaway cluster on a free port; skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { CORE, HAS_POSTGRES } from './_pg-cutover'
import { validatePublicSlug } from '../../src/lib/entities/public-slug'

const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const PAGES = path.join(CORE, 'templates/projects/starter/entities/pages')
const MIGRATION = '004_pages_slug_check.sql'
const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function throwawayDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-slug-pg-'))
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
  const client = new pg.Client({ connectionString: url })
  // the cluster stops under it at the end of the test
  client.on('error', () => {})
  await client.connect()
  t.after(() => client.end())
  // the test writes pages rows without the users and teams they point at
  await client.query('SET session_replication_role = replica')
  return { url, client }
}

/** A project with the starter's pages entity: its config with the option set, and its migrations (without 004 when asked). */
function project(t: TestContext, nested: boolean | string, withSlugMigration = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-slug-project-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const entity = path.join(root, 'entities/pages')
  fs.cpSync(path.join(PAGES, 'migrations'), path.join(entity, 'migrations'), { recursive: true })
  if (!withSlugMigration) fs.rmSync(path.join(entity, 'migrations', MIGRATION))
  const config = fs.readFileSync(path.join(PAGES, 'pages.config.ts'), 'utf8')
  assert.match(config, /basePath: '\/',/)
  fs.writeFileSync(path.join(entity, 'pages.config.ts'), config.replace("basePath: '/',", typeof nested === 'string' ? nested : `basePath: '/',\n    allowNestedSlugs: ${nested},`))
  return root
}

function migrate(root: string, url: string) {
  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  const result = spawnSync(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 120000 })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

async function insert(client: pg.Client, slug: string) {
  await client.query(`INSERT INTO public.pages ("userId", "teamId", slug, title) VALUES ('u', 't', $1, 'T')`, [slug])
}

const rejected = (client: pg.Client, slug: string) =>
  insert(client, slug).then(() => false, (error: { constraint?: string }) => error.constraint === 'valid_slug')

test('allowNestedSlugs: true -> app and database accept a/b, and still refuse malformed slugs', { skip, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const run = migrate(project(t, true), url)
  assert.equal(run.status, 0, run.output)
  assert.match(run.output, /004_pages_slug_check\.sql/)
  assert.equal(validatePublicSlug({ access: { basePath: '/', allowNestedSlugs: true } }, 'ab/cd'), null)
  await insert(client, 'a/b')
  await insert(client, 'about')
  for (const bad of ['/a', 'a/', 'a//b', 'A/b', 'a/b c', 'a.b/c']) assert.equal(await rejected(client, bad), true, bad)
})

test('allowNestedSlugs: false -> app and database refuse a/b', { skip, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const run = migrate(project(t, false), url)
  assert.equal(run.status, 0, run.output)
  assert.equal(validatePublicSlug({ access: { basePath: '/', allowNestedSlugs: false } }, 'a/b'), 'Slug cannot contain slashes')
  assert.equal(await rejected(client, 'a/b'), true)
  await insert(client, 'about')
})

test('a base path other than / accepts nested slugs without allowNestedSlugs, as the app does', { skip, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const run = migrate(project(t, "basePath: '/docs',"), url)
  assert.equal(run.status, 0, run.output)
  assert.doesNotMatch(run.output, /could not read/)
  assert.equal(validatePublicSlug({ access: { basePath: '/docs' } }, 'ab/cd'), null)
  await insert(client, 'a/b')
  assert.equal(await rejected(client, 'a//b'), true)
})

test('a config that cannot be read warns once, keeps the single-segment rule and does not fail the run', { skip, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const run = migrate(project(t, "basePath: '/',\n    allowNestedSlugs: process.env.NESTED === '1',"), url)
  assert.equal(run.status, 0, run.output)
  const warnings = run.output.split('\n').filter(line => line.includes('could not read access.allowNestedSlugs'))
  assert.equal(warnings.length, 1, run.output)
  assert.match(warnings[0], /entities\/pages\/pages\.config\.ts \(not a literal\); pages slug CHECK uses the single-segment rule/)
  assert.equal(await rejected(client, 'a/b'), true)
})

test('the app refuses a slug over 100 characters in all, as the table does', () => {
  const nested = { access: { basePath: '/', allowNestedSlugs: true } }
  const segment = 'a'.repeat(60)
  assert.equal(validatePublicSlug(nested, `${segment}/${segment}`), 'Slug cannot be longer than 100 characters')
  assert.equal(validatePublicSlug(nested, `${'a'.repeat(49)}/${'b'.repeat(50)}`), null)
})

test('004 on an existing pages table replaces valid_slug and keeps the stored rows', { skip, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  // a project at 003: valid_slug is the single-segment one, with a row in it
  assert.equal(migrate(project(t, true, false), url).status, 0)
  const def = async () => (await client.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'valid_slug' AND conrelid = 'public.pages'::regclass`)).rows.map(r => r.def)
  assert.deepEqual(await def(), [`CHECK (((slug)::text ~ '^[a-z0-9\\-]+$'::text))`])
  await insert(client, 'about')
  assert.equal(await rejected(client, 'a/b'), true)
  // a row the new rule refuses (the table had its constraint edited by hand): NOT VALID lets the migration through
  await client.query('ALTER TABLE public.pages DROP CONSTRAINT valid_slug')
  await insert(client, 'Bad_Slug')

  // the project upgrades with the option on: only 004 runs
  const run = migrate(project(t, true), url)
  assert.equal(run.status, 0, run.output)
  assert.match(run.output, /004_pages_slug_check\.sql/)
  assert.doesNotMatch(run.output, /Running 001_pages_table/)
  assert.deepEqual(await def(), [`CHECK (((slug)::text ~ '^[a-z0-9-]+(/[a-z0-9-]+)*$'::text)) NOT VALID`])
  await insert(client, 'a/b')
  assert.deepEqual((await client.query(`SELECT slug FROM public.pages ORDER BY slug`)).rows.map(r => r.slug).sort(), ['Bad_Slug', 'a/b', 'about'])

  // running it again changes nothing, and a table without the constraint, or without the table, is tolerated
  const sql = fs.readFileSync(path.join(PAGES, 'migrations', MIGRATION), 'utf8')
  await client.query(sql)
  assert.equal((await def()).length, 1)
  await client.query('ALTER TABLE public.pages DROP CONSTRAINT valid_slug')
  await client.query(sql)
  assert.equal((await def()).length, 1)
  await client.query('DROP TABLE public.pages CASCADE')
  await client.query(sql)
})

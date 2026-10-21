/**
 * The RLS helpers in policies are called as (SELECT public.helper()), so Postgres evaluates them once per statement
 * (#323). Migration 043 rewrites the policies that predate it; the entity templates carry the wrapped form.
 *
 * The migration tests start a throwaway cluster with initdb and pg_ctl on a free port, and are skipped when they are
 * not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase, asUser } from './_pg-cutover'

const MIGRATION = '043_rls_helpers_select_wrapper.sql'
const HELPERS = 'get_user_team_ids|is_superadmin|can_bypass_rls|get_auth_user_id'
// a call that is not wrapped: not after SELECT, and not the argument of the one-argument get_user_team_ids( form
const UNWRAPPED = new RegExp(`(?<!SELECT )(?<![\\w.])(?<!get_user_team_ids\\()(?:public\\.)?(?:${HELPERS})\\(\\)`)
const UNWRAPPED_FILE = new RegExp(UNWRAPPED.source, 'g')
const UNWRAPPED_ANY = /\b(?:ANY|ALL) ?\((?:public\.)?get_user_team_ids\(\)\)/

// the policies with a helper name inside a string: left as they were
const SKIPPED = ['ent_lit_select', 'ent_esc_quote', 'ent_esc_ident']

const POLICIES = `SELECT tablename, policyname, permissive, roles::text AS roles, cmd, qual, with_check
  FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`

/** pg_policies prints a wrapped call as "( SELECT f() AS f)" and the cast array form as "( SELECT f() AS f)::text[]". */
function unwrap(value: string | null) {
  if (value === null) return null
  return value
    .replace(/\(\s*SELECT (\w+\(\)) AS \w+\)/g, '$1')
    .replace(/(ANY|ALL) \((get_user_team_ids\(\))::text\[\]\)/g, '$1 ($2)')
}

// The shapes the entity templates had before: team isolation, a superadmin bypass and an owner check
const OLD_TEMPLATE_TABLES = `
  CREATE TABLE ent_team (id serial PRIMARY KEY, "teamId" text NOT NULL, "userId" text, title text);
  ALTER TABLE ent_team ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ent_team_all ON ent_team FOR ALL TO authenticated
    USING (public.is_superadmin() OR "teamId" = ANY(public.get_user_team_ids()))
    WITH CHECK (public.is_superadmin() OR "teamId" = ANY(public.get_user_team_ids()));
  CREATE TABLE ent_user (id serial PRIMARY KEY, "userId" text NOT NULL, title text);
  ALTER TABLE ent_user ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ent_user_select ON ent_user FOR SELECT TO authenticated USING ("userId" = public.get_auth_user_id());
  CREATE POLICY ent_user_insert ON ent_user FOR INSERT TO authenticated WITH CHECK ("userId" = public.get_auth_user_id());
  CREATE TABLE ent_child (id serial PRIMARY KEY, "parentId" int NOT NULL REFERENCES ent_team(id));
  ALTER TABLE ent_child ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ent_child_all ON ent_child FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM ent_team p WHERE p.id = "parentId" AND (p."teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin()))
  );
  -- a project policy with <> ALL, and one with a helper name inside a string (data, not a call)
  CREATE TABLE ent_all (id serial PRIMARY KEY, "teamId" text NOT NULL);
  ALTER TABLE ent_all ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ent_all_other ON ent_all FOR SELECT TO authenticated USING ("teamId" <> ALL (public.get_user_team_ids()));
  CREATE TABLE ent_lit (id serial PRIMARY KEY, "userId" text NOT NULL, title text);
  ALTER TABLE ent_lit ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ent_lit_select ON ent_lit FOR SELECT TO authenticated USING (title <> 'is_superadmin()' AND "userId" = public.get_auth_user_id());
  -- a literal with an escaped quote, and a quoted identifier with an apostrophe next to a literal
  CREATE TABLE ent_esc (id serial PRIMARY KEY, title text, "a'b" text);
  ALTER TABLE ent_esc ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ent_esc_quote ON ent_esc FOR SELECT TO authenticated USING (title <> 'it''s is_superadmin()');
  CREATE POLICY ent_esc_ident ON ent_esc FOR SELECT TO authenticated USING ("a'b" <> 'is_superadmin()');
  GRANT ALL ON ent_team, ent_user, ent_child, ent_all, ent_lit, ent_esc TO authenticated;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  INSERT INTO users (id, email, name, role, "emailVerified") VALUES
    ('owna', 'owna@example.test', 'Owner A', 'member', true),
    ('ownb', 'ownb@example.test', 'Owner B', 'member', true),
    ('root', 'root@example.test', 'Root', 'superadmin', true),
    ('outsider', 'outsider@example.test', 'Outsider', 'member', true);
  INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'owna'), ('team-b', 'Team B', 'team-b', 'ownb');
  INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'owna', 'owner'), ('team-b', 'ownb', 'owner');
  INSERT INTO ent_team ("teamId", "userId", title) SELECT 'team-a', 'owna', 'a' || g FROM generate_series(1, 3) g;
  INSERT INTO ent_team ("teamId", "userId", title) SELECT 'team-b', 'ownb', 'b' || g FROM generate_series(1, 2) g;
  INSERT INTO ent_user ("userId", title) VALUES ('owna', 'mine-a'), ('ownb', 'mine-b');
  INSERT INTO ent_child ("parentId") SELECT id FROM ent_team;
  INSERT INTO ent_esc (title, "a'b") VALUES ('x', 'y'), ('it''s is_superadmin()', 'is_superadmin()');
  INSERT INTO ent_all ("teamId") VALUES ('team-a'), ('team-b'), ('team-c');
  INSERT INTO ent_lit ("userId", title) VALUES ('owna', 'x'), ('owna', 'is_superadmin()'), ('ownb', 'y');
`

test('migration 043 wraps the helper calls of existing policies and changes nothing else', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t, { except: [MIGRATION] })
  await owner.query(OLD_TEMPLATE_TABLES)
  const as = asUser(app)
  const visible = async () => {
    const seen: Record<string, unknown> = {}
    for (const user of ['owna', 'ownb', 'root', 'outsider']) {
      for (const table of ['ent_team', 'ent_user', 'ent_child', 'ent_all', 'ent_lit', 'ent_esc', 'team_members', 'teams']) {
        seen[`${user}/${table}`] = (await as(user, `SELECT * FROM ${table} ORDER BY 1, 2`)).rows
      }
    }
    return seen
  }

  const policiesBefore = (await owner.query(POLICIES)).rows
  const seenBefore = await visible()
  assert.ok(policiesBefore.some(p => UNWRAPPED.test(`${p.qual} ${p.with_check}`)), 'the old shapes are unwrapped before the migration')
  // writes before: the owner of a team adds a row to it, and is refused another team's
  await as('owna', `INSERT INTO ent_team ("teamId", title) VALUES ('team-a', 'new')`)
  await assert.rejects(as('owna', `INSERT INTO ent_team ("teamId", title) VALUES ('team-b', 'x')`), /row-level security/)
  await owner.query(`DELETE FROM ent_team WHERE title = 'new'`)

  // one ALTER POLICY is refused (an event trigger fails the first one): that policy stays as it was, with a warning
  await owner.query(`
    CREATE SEQUENCE fail_first;
    CREATE FUNCTION refuse_first() RETURNS event_trigger LANGUAGE plpgsql AS $$
    BEGIN IF nextval('fail_first') = 1 THEN RAISE EXCEPTION 'refused'; END IF; END $$;
    CREATE EVENT TRIGGER refuse_first ON ddl_command_start WHEN TAG IN ('ALTER POLICY') EXECUTE FUNCTION refuse_first();
  `)
  const warnings: string[] = []
  owner.on('notice', n => warnings.push(n.message))
  const migration = fs.readFileSync(path.join(CORE, 'migrations', MIGRATION), 'utf8')
  await owner.query(migration)
  const refused = warnings.filter(w => /left unchanged: refused/.test(w))
  assert.equal(refused.length, 1, warnings.join('\n'))
  // the policy with a helper name inside a string is left alone, with a warning
  for (const [policy, table] of [['ent_lit_select', 'ent_lit'], ['ent_esc_quote', 'ent_esc'], ['ent_esc_ident', 'ent_esc']]) {
    assert.ok(warnings.some(w => w.startsWith(`${policy} on ${table} left unchanged: a string literal`)), `${policy}: ${warnings.join('\n')}`)
  }
  const stillUnwrapped = (await owner.query(POLICIES)).rows.filter(p => UNWRAPPED.test(`${p.qual} ${p.with_check}`)).map(p => p.policyname)
  assert.equal(stillUnwrapped.filter(n => !SKIPPED.includes(n)).length, 1, stillUnwrapped.join(', '))
  // with nothing refusing, the rest is rewritten
  await owner.query('DROP EVENT TRIGGER refuse_first')
  await owner.query(migration)
  const policiesAfter = (await owner.query(POLICIES)).rows

  // the same policies, with the same commands and roles, and expressions that differ only by the wrapper
  assert.equal(policiesAfter.length, policiesBefore.length)
  assert.deepEqual(
    policiesAfter.map(p => ({ ...p, qual: unwrap(p.qual), with_check: unwrap(p.with_check) })),
    policiesBefore,
  )
  for (const p of policiesAfter) {
    if (SKIPPED.includes(p.policyname)) continue
    assert.doesNotMatch(`${p.qual} ${p.with_check}`, UNWRAPPED, `${p.tablename}.${p.policyname} is still unwrapped`)
  }
  // <> ALL is cast like ANY, and the string is untouched
  assert.match(policiesAfter.find(p => p.policyname === 'ent_all_other').qual, /<> ALL \(\( SELECT get_user_team_ids\(\) AS get_user_team_ids\)::text\[\]\)/)
  assert.match(policiesAfter.find(p => p.policyname === 'ent_lit_select').qual, /'is_superadmin\(\)'::text\) AND \("userId" = get_auth_user_id\(\)\)/)

  // who sees what, and who may write what, is the same
  assert.deepEqual(await visible(), seenBefore)
  await as('owna', `INSERT INTO ent_team ("teamId", title) VALUES ('team-a', 'new')`)
  await assert.rejects(as('owna', `INSERT INTO ent_team ("teamId", title) VALUES ('team-b', 'x')`), /row-level security/)
  await assert.rejects(as('owna', `INSERT INTO ent_user ("userId", title) VALUES ('ownb', 'x')`), /row-level security/)
  await as('root', `INSERT INTO ent_team ("teamId", title) VALUES ('team-b', 'root')`)

  // a second run alters nothing
  await owner.query(migration)
  assert.deepEqual((await owner.query(POLICIES)).rows, policiesAfter)
})

test('a wrapped helper is evaluated once per statement: the plan has an InitPlan for it, not a call per row', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner } = await cutoverDatabase(t, { except: [MIGRATION] })
  await owner.query(OLD_TEMPLATE_TABLES)
  const plan = async () => {
    await owner.query('BEGIN')
    try {
      await owner.query(`SET LOCAL ROLE app_login`)
      await owner.query(`SET LOCAL app.user_id = 'owna'`)
      return (await owner.query(`EXPLAIN (COSTS OFF) SELECT * FROM ent_team`)).rows.map(r => r['QUERY PLAN']).join('\n')
    } finally {
      await owner.query('ROLLBACK')
    }
  }
  assert.doesNotMatch(await plan(), /InitPlan/)
  await owner.query(fs.readFileSync(path.join(CORE, 'migrations', MIGRATION), 'utf8'))
  assert.match(await plan(), /InitPlan/)
})

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function throwawayDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rls-wrap-pg-'))
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
  const connect = async () => {
    const client = new pg.Client({ connectionString: url })
    client.on('error', () => {})
    await client.connect()
    t.after(() => client.end())
    return client
  }
  return { url, connect }
}

/** db:migrate from a minimal project with no entities of its own: it applies core's migrations. */
function migrate(t: TestContext, url: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rls-wrap-project-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  const result = spawnSync(process.execPath, [path.join(CORE, 'scripts/db/run-migrations.mjs'), '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 120000 })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

test('db:migrate prints the policies 043 leaves alone, and a lock timeout fails the file so it is retried', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { url, connect } = await throwawayDatabase(t)
  const first = migrate(t, url)
  assert.equal(first.status, 0, first.output)
  assert.match(first.output, /Successfully executed 043_rls_helpers_select_wrapper\.sql/)
  assert.doesNotMatch(first.output, /left unchanged/)

  // 043 pending again, over a bare policy, and one with a helper name inside a string
  const owner = await connect()
  await owner.query(`
    CREATE TABLE late_team (id serial PRIMARY KEY, "teamId" text, title text);
    ALTER TABLE late_team ENABLE ROW LEVEL SECURITY;
    CREATE POLICY late_team_all ON late_team FOR ALL TO authenticated USING (public.is_superadmin() OR "teamId" = ANY(public.get_user_team_ids()));
    CREATE POLICY late_team_lit ON late_team FOR SELECT TO authenticated USING (title <> 'is_superadmin()');
    DELETE FROM _migrations WHERE filename = '${MIGRATION}';
    ALTER ROLE owner SET lock_timeout = '300ms';
  `)
  const policies = async () => (await owner.query(POLICIES)).rows
  const before = await policies()

  // a read lock held by another session (the ALTER POLICY waits for it, the catalog read does not): the file fails as a whole, nothing is rewritten, and it is not recorded as run
  const holder = await connect()
  await holder.query('BEGIN')
  await holder.query('LOCK TABLE late_team IN ACCESS SHARE MODE')
  const blocked = migrate(t, url)
  assert.notEqual(blocked.status, 0, blocked.output)
  assert.match(blocked.output, /lock timeout/)
  assert.equal((await owner.query(`SELECT 1 FROM _migrations WHERE filename = '${MIGRATION}'`)).rowCount, 0)
  assert.deepEqual(await policies(), before)
  await holder.query('ROLLBACK')

  // retried once the lock is gone: it applies, and the runner prints the policy it left alone
  const retried = migrate(t, url)
  assert.equal(retried.status, 0, retried.output)
  assert.match(retried.output, /late_team_lit on late_team left unchanged: a string literal contains a helper call/)
  assert.equal((await owner.query(`SELECT 1 FROM _migrations WHERE filename = '${MIGRATION}'`)).rowCount, 1)
  const after = await policies()
  assert.match(after.find(p => p.policyname === 'late_team_all').qual, /\( SELECT is_superadmin\(\) AS is_superadmin\)/)
  assert.deepEqual(after.find(p => p.policyname === 'late_team_lit'), before.find(p => p.policyname === 'late_team_lit'))
})

const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', '.next', 'dist', '.turbo'])
function* sqlFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* sqlFiles(file)
    else if (/\.sql(\.template)?$/.test(entry.name)) yield file
  }
}

test('the entity templates, the generated projects, the themes and the plugins write the helper calls wrapped', () => {
  const root = path.resolve(CORE, '../..')
  const coreMigrations = path.join(CORE, 'migrations') + path.sep
  // every migration file of the repository but core's own (those are applied history, rewritten by 043)
  const files = [...sqlFiles(root)].filter(file => file.includes(`${path.sep}migrations${path.sep}`) && !file.startsWith(coreMigrations))
  assert.ok(files.length > 60, `${files.length} files`)
  for (const file of files) {
    // comments included: the policies a template leaves commented out are copied from it; function bodies are not policies
    const text = fs.readFileSync(file, 'utf8').replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '')
    assert.equal(text.match(UNWRAPPED_FILE), null, `${path.relative(root, file)} calls an RLS helper without (SELECT ...)`)
    assert.doesNotMatch(text, UNWRAPPED_ANY, `${path.relative(root, file)} passes the helper to ANY or ALL unwrapped`)
  }
  const team = fs.readFileSync(path.join(CORE, 'templates/migrations/team-mode/001_entity_table.sql.template'), 'utf8')
  assert.match(team, /\(SELECT public\.is_superadmin\(\)\)/)
  assert.match(team, /ANY \(\(SELECT public\.get_user_team_ids\(\)\)::text\[\]\)/)
  for (const mode of ['private', 'shared', 'public']) {
    const text = fs.readFileSync(path.join(CORE, `templates/migrations/${mode}-mode/001_entity_table.sql.template`), 'utf8')
    assert.match(text, /\(SELECT public\.get_auth_user_id\(\)\)/, `${mode}-mode`)
  }
})

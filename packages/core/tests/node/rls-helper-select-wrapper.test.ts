/**
 * The RLS helpers in policies are called as (SELECT public.helper()), so Postgres evaluates them once per statement
 * (#323). Migration 043 rewrites the policies that predate it; the entity templates carry the wrapped form.
 *
 * The migration tests start a throwaway cluster with initdb and pg_ctl on a free port, and are skipped when they are
 * not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase, asUser } from './_pg-cutover'

const MIGRATION = '043_rls_helpers_select_wrapper.sql'
const HELPERS = 'get_user_team_ids|is_superadmin|can_bypass_rls|get_auth_user_id'
// a call that is not wrapped: not after SELECT, and not the argument of the one-argument get_user_team_ids( form
const UNWRAPPED = new RegExp(`(?<!SELECT )(?<![\\w.])(?<!get_user_team_ids\\()(?:public\\.)?(?:${HELPERS})\\(\\)`)
const UNWRAPPED_FILE = new RegExp(UNWRAPPED.source, 'g')
const UNWRAPPED_ANY = /\b(?:ANY|ALL) ?\((?:public\.)?get_user_team_ids\(\)\)/

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
  GRANT ALL ON ent_team, ent_user, ent_child, ent_all, ent_lit TO authenticated;
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
      for (const table of ['ent_team', 'ent_user', 'ent_child', 'ent_all', 'ent_lit', 'team_members', 'teams']) {
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
  assert.ok(warnings.some(w => /ent_lit_select on ent_lit left unchanged: a string literal/.test(w)))
  const stillUnwrapped = (await owner.query(POLICIES)).rows.filter(p => UNWRAPPED.test(`${p.qual} ${p.with_check}`)).map(p => p.policyname)
  assert.equal(stillUnwrapped.filter(n => n !== 'ent_lit_select').length, 1, stillUnwrapped.join(', '))
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
    if (p.policyname === 'ent_lit_select') continue
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

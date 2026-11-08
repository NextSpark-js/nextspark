/**
 * The runtime of the generated entity clients against core's real route modules, over real HTTP and a throwaway cluster
 * (fixtures/child-routes/client-driver.mts): the child client lists, creates, updates and deletes the rows of a nested child
 * entity the registry resolves (`customers` / `notes`), the answers have the shape the types declare (a delete is
 * `{ success: true, id }`, for a child row and for an entity), and another team's parent is a 404.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const FIXTURE = path.join(CORE, 'tests/node/fixtures/child-routes')

type Step = { step: string; value?: unknown; error?: string }

test('the child and entity clients work against the real routes: rows, delete answers, other teams', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, appUrl, ownerUrl } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('ua', 'a@example.test', 'A', 'member', true), ('ub', 'b@example.test', 'B', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'ua'), ('team-b', 'Team B', 'team-b', 'ub');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'ua', 'owner'), ('team-b', 'ub', 'owner');
    CREATE TABLE customers (
      id TEXT PRIMARY KEY, "userId" TEXT REFERENCES users(id), "teamId" TEXT NOT NULL REFERENCES teams(id),
      name TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY customers_all ON customers FOR ALL
      USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin())
      WITH CHECK ("teamId" = ANY(public.get_user_team_ids()));
    CREATE TABLE customers_notes (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "parentId" TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      body TEXT NOT NULL, stars NUMERIC,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    ALTER TABLE customers_notes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY customers_notes_team ON customers_notes FOR ALL TO authenticated
      USING (public.is_superadmin() OR EXISTS (SELECT 1 FROM customers t WHERE t.id = "parentId" AND t."teamId" = ANY(public.get_user_team_ids())))
      WITH CHECK (public.is_superadmin() OR EXISTS (SELECT 1 FROM customers t WHERE t.id = "parentId" AND t."teamId" = ANY(public.get_user_team_ids())));
    GRANT SELECT, INSERT, UPDATE, DELETE ON customers, customers_notes TO nextspark_app;
    INSERT INTO customers (id, "userId", "teamId", name) VALUES ('cust-a', 'ua', 'team-a', 'A Corp'), ('cust-b', 'ub', 'team-b', 'B Corp');
    INSERT INTO customers_notes (id, "parentId", body) VALUES ('note-a', 'cust-a', 'team A note'), ('note-b', 'cust-b', 'team B secret');
  `)
  const key = `sk_test_${randomBytes(32).toString('hex')}`
  await owner.query(
    `INSERT INTO api_key ("keyHash", "keyPrefix", name, "userId", scopes) VALUES ($1, $2, 'test', 'ua', ARRAY['customers:read', 'customers:write', 'customers:delete'])`,
    [createHash('sha256').update(key).digest('hex'), key.slice(0, 16)],
  )

  const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(FIXTURE, 'client-driver.mts')], {
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
      BETTER_AUTH_SECRET: 'client-routes-secret-0123456789abcdef0123',
      BETTER_AUTH_URL: 'http://localhost:5173',
      DISABLE_RATE_LIMITING: 'true',
      CLIENT_KEY: key,
      CLIENT_TEAM: 'team-a',
    },
  })
  const steps = Object.fromEntries(run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Step).map(s => [s.step, s]))
  const output = `${run.stdout}\n${run.stderr}`
  for (const name of ['list', 'create', 'update', 'delete', 'delete-again', 'other-team', 'delete-parent']) assert.ok(steps[name], `${name} ran\n${output}`)

  assert.deepEqual((steps.list.value as Array<{ id: string }>).map(row => row.id), ['note-a'], output)
  const created = steps.create.value as { id: string; parentId: string; body: string }
  assert.equal(created.parentId, 'cust-a', output)
  assert.equal(created.body, 'from the client')
  assert.equal((steps.update.value as { body: string }).body, 'changed', output)
  // a delete answers { success: true, id } - what the clients declare - for a child row and for an entity
  assert.equal((steps.delete.value as { success: boolean; id: string }).success, true, output)
  assert.equal((steps.delete.value as { id: string }).id, created.id)
  assert.match(steps['delete-again'].error ?? '', /not found/i, output)
  assert.match(steps['other-team'].error ?? '', /not found/i, output)
  // the body of an entity delete: entityApi.delete returns its `data`, which is what EntityDeleteResult declares
  assert.deepEqual((steps['delete-parent'].value as { data: unknown }).data, { success: true, id: 'cust-a' }, output)
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM customers_notes WHERE id = 'note-b'`)).rows[0].n, 1, "team B's row is untouched")
})

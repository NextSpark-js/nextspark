/**
 * The child-entity routes, through core's real route modules (fixtures/child-routes/driver.mts), against a throwaway
 * cluster with core's migrations, first on the owner role (a project without the nextspark_app cutover, where RLS hides
 * nothing) and then on the cutover: a member of team A, or an anonymous caller, cannot list, create, change or delete
 * the children of a team B parent; a team A member is served on its own parent. Callers authenticate with real API keys.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const FIXTURE = path.join(CORE, 'tests/node/fixtures/child-routes')

type Step = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; key?: string; team?: string; body?: unknown }
type Result = { method: string; path: string; status: number; body: { data?: unknown; code?: string } }

function runSteps(appUrl: string, ownerUrl: string, steps: Step[]): Result[] {
  const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(FIXTURE, 'driver.mts')], {
    cwd: CORE,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'test',
      TSX_TSCONFIG_PATH: path.join(FIXTURE, 'tsconfig.json'),
      // the routes run on the app pool (RLS evaluated); auth reads users and keys on the service pool
      DATABASE_URL: appUrl,
      DATABASE_SERVICE_URL: ownerUrl,
      BETTER_AUTH_SECRET: 'child-routes-secret-0123456789abcdef0123',
      BETTER_AUTH_URL: 'http://localhost:5173',
      NEXT_PUBLIC_APP_URL: 'http://localhost:5173',
      DISABLE_RATE_LIMITING: 'true',
      CHILD_ROUTES_STEPS: JSON.stringify(steps),
    },
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return results
}

/** A real API key row for `userId`; returns the key as a client presents it. */
async function apiKey(owner: pg.Client, userId: string, scopes: string[]) {
  const key = `sk_test_${randomBytes(32).toString('hex')}`
  await owner.query(
    `INSERT INTO api_key ("keyHash", "keyPrefix", name, "userId", scopes) VALUES ($1, $2, 'test', $3, $4)`,
    [createHash('sha256').update(key).digest('hex'), key.slice(0, 16), userId, scopes],
  )
  return key
}

test('child routes: a team A member cannot reach the children of a team B parent', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, appUrl, ownerUrl } = await cutoverDatabase(t)

  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('ua', 'a@example.test', 'A', 'member', true),
      ('ub', 'b@example.test', 'B', 'member', true),
      ('uv', 'v@example.test', 'V', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'ua'), ('team-b', 'Team B', 'team-b', 'ub');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'ua', 'owner'), ('team-b', 'ub', 'owner'), ('team-a', 'uv', 'viewer');

    -- an entity table and its child table, with the policies the entity and child migration templates write
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
  const keyA = await apiKey(owner, 'ua', ['customers:read', 'customers:write'])
  const keyAReadOnly = await apiKey(owner, 'ua', ['customers:read'])
  const keyViewer = await apiKey(owner, 'uv', ['customers:read', 'customers:write'])
  const a = { key: keyA, team: 'team-a' }
  const teamBRows = async () => (await owner.query(`SELECT id, body FROM customers_notes WHERE "parentId" = 'cust-b' ORDER BY id`)).rows
  /** Access is refused with `status` and nothing of team B's comes back. Checked before any success case. */
  const refused = (result: Result, status: number, code?: string) => {
    assert.doesNotMatch(JSON.stringify(result.body), /team B secret/, `team B's child rows came back: ${JSON.stringify(result)}`)
    assert.equal(result.status, status, JSON.stringify(result))
    if (code) assert.equal(result.body.code, code, JSON.stringify(result))
  }

  // 1. A project without the nextspark_app cutover: the routes run on the owner role, so RLS hides nothing and only the
  //    routes' own checks keep team B's children away from a team A caller and from an anonymous one.
  const [ownerRoleList, ownerRoleAnonymous, ownerRoleCreate, ownerRoleDelete] = runSteps(ownerUrl, ownerUrl, [
    { method: 'GET', path: '/api/v1/customers/cust-b/child/notes', ...a },
    { method: 'GET', path: '/api/v1/customers/cust-b/child/notes', team: 'team-a' },
    { method: 'POST', path: '/api/v1/customers/cust-b/child/notes', ...a, body: { body: 'planted' } },
    { method: 'DELETE', path: '/api/v1/customers/cust-b/child/notes/note-b', ...a },
  ])
  refused(ownerRoleList, 404)
  refused(ownerRoleAnonymous, 401)
  refused(ownerRoleCreate, 404)
  refused(ownerRoleDelete, 404)
  assert.deepEqual(await teamBRows(), [{ id: 'note-b', body: 'team B secret' }])

  // 2. On the cutover (RLS evaluated as the caller)
  const [
    listOther, createOther, updateOther, deleteOther, updateOtherViaOwn, otherTeamHeader,
    anonymous, readOnlyWrite, viewerRead, badBody, listOwn, createOwn,
  ] = runSteps(appUrl, ownerUrl, [
    { method: 'GET', path: '/api/v1/customers/cust-b/child/notes', ...a },
    { method: 'POST', path: '/api/v1/customers/cust-b/child/notes', ...a, body: { body: 'planted' } },
    { method: 'PUT', path: '/api/v1/customers/cust-b/child/notes/note-b', ...a, body: { body: 'changed' } },
    { method: 'DELETE', path: '/api/v1/customers/cust-b/child/notes/note-b', ...a },
    // a team B child addressed under the caller's own parent
    { method: 'PUT', path: '/api/v1/customers/cust-a/child/notes/note-b', ...a, body: { body: 'changed' } },
    { method: 'GET', path: '/api/v1/customers/cust-b/child/notes', key: keyA, team: 'team-b' },
    { method: 'GET', path: '/api/v1/customers/cust-b/child/notes', team: 'team-a' },
    { method: 'POST', path: '/api/v1/customers/cust-a/child/notes', key: keyAReadOnly, team: 'team-a', body: { body: 'x' } },
    { method: 'GET', path: '/api/v1/customers/cust-a/child/notes', key: keyViewer, team: 'team-a' },
    { method: 'POST', path: '/api/v1/customers/cust-a/child/notes', ...a, body: [{ body: 'x' }] },
    { method: 'GET', path: '/api/v1/customers/cust-a/child/notes', ...a },
    { method: 'POST', path: '/api/v1/customers/cust-a/child/notes', ...a, body: { body: "it's fine'); --", stars: 4 } },
  ])

  // refusals first: team B's parent does not exist for a team A member, and nothing is written
  for (const result of [listOther, createOther, updateOther, deleteOther, updateOtherViaOwn]) refused(result, 404)
  refused(otherTeamHeader, 403, 'TEAM_ACCESS_DENIED')
  refused(anonymous, 401)
  refused(readOnlyWrite, 403)
  refused(viewerRead, 403, 'PERMISSION_DENIED')
  refused(badBody, 400, 'VALIDATION_ERROR')
  assert.deepEqual(await teamBRows(), [{ id: 'note-b', body: 'team B secret' }])

  // then the owner is served on its own parent
  assert.equal(listOwn.status, 200, JSON.stringify(listOwn))
  assert.deepEqual((listOwn.body.data as Array<{ id: string }>).map(r => r.id), ['note-a'])
  assert.equal(createOwn.status, 200, JSON.stringify(createOwn))
  assert.equal((createOwn.body.data as { body: string }).body, "it's fine'); --")
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM customers_notes WHERE "parentId" = 'cust-a'`)).rows[0].n, 2)
})

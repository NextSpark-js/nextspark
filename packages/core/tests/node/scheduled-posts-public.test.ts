/**
 * A scheduled item (status `published`, `publishedAt` still to come) of a public entity is not public until its date
 * (#542): the anonymous list and single read of core's real entity routes (fixtures/scheduled-posts/driver.mts) leave
 * it out, while its author, through the same routes with an API key and the team header, still lists and reads it.
 * A published row with no date counts as published. Runs against a throwaway cluster with core's migrations, on the
 * nextspark_app cutover.
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

const FIXTURE = path.join(CORE, 'tests/node/fixtures/scheduled-posts')

type Step = { path: string; key?: string; team?: string }
type Result = { path: string; status: number; body: { data?: unknown; code?: string } }

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
      DATABASE_URL: appUrl,
      DATABASE_SERVICE_URL: ownerUrl,
      BETTER_AUTH_SECRET: 'scheduled-posts-secret-0123456789abcdef01',
      BETTER_AUTH_URL: 'http://localhost:5173',
      NEXT_PUBLIC_APP_URL: 'http://localhost:5173',
      DISABLE_RATE_LIMITING: 'true',
      SCHEDULED_POSTS_STEPS: JSON.stringify(steps),
    },
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return results
}

async function apiKey(owner: pg.Client, userId: string, scopes: string[]) {
  const key = `sk_test_${randomBytes(32).toString('hex')}`
  await owner.query(
    `INSERT INTO api_key ("keyHash", "keyPrefix", name, "userId", scopes) VALUES ($1, $2, 'test', $3, $4)`,
    [createHash('sha256').update(key).digest('hex'), key.slice(0, 16), userId, scopes],
  )
  return key
}

const ids = (result: Result) => ((result.body.data ?? []) as { id: string }[]).map(row => row.id).sort()

test('a scheduled post is hidden from the public reads until its date, and its author still sees it', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, appUrl, ownerUrl } = await cutoverDatabase(t)

  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('ua', 'a@example.test', 'A', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'ua');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'ua', 'owner');

    -- the posts table with the policies of the blog template's migration
    CREATE TABLE posts (
      id TEXT PRIMARY KEY, "userId" TEXT REFERENCES users(id), "teamId" TEXT NOT NULL REFERENCES teams(id),
      title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', "publishedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX posts_status_published_at_idx ON posts (status, "publishedAt" DESC);
    ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY posts_select ON posts FOR SELECT TO authenticated
      USING ("teamId" = ANY ((SELECT public.get_user_team_ids())::text[]) OR (SELECT public.is_superadmin()));
    CREATE POLICY posts_public_select ON posts FOR SELECT TO anon USING (status = 'published' AND "publishedAt" <= NOW());
    GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO nextspark_app;

    INSERT INTO posts (id, "userId", "teamId", title, status, "publishedAt") VALUES
      ('past', 'ua', 'team-a', 'Out already', 'published', now() - interval '1 day'),
      ('undated', 'ua', 'team-a', 'Published, no date', 'published', NULL),
      ('future', 'ua', 'team-a', 'Scheduled', 'published', now() + interval '7 days'),
      ('draft', 'ua', 'team-a', 'Draft', 'draft', NULL);
  `)
  const author = { key: await apiKey(owner, 'ua', ['posts:read', 'posts:write']), team: 'team-a' }

  const [publicList, publicAskingAll, publicFuture, publicPast, authorList, authorFuture] = runSteps(appUrl, ownerUrl, [
    { path: '/api/v1/posts' },
    { path: '/api/v1/posts?status=published,draft' },
    { path: '/api/v1/posts/future' },
    { path: '/api/v1/posts/past' },
    { path: '/api/v1/posts', ...author },
    { path: '/api/v1/posts/future', ...author },
  ])

  assert.equal(publicList.status, 200, JSON.stringify(publicList))
  assert.deepEqual(ids(publicList), ['past', 'undated'], 'the public list leaves out the scheduled post and the draft')
  assert.deepEqual(ids(publicAskingAll), ['past', 'undated'], 'whatever status the caller asks for')
  assert.equal(publicFuture.status, 404, JSON.stringify(publicFuture))
  assert.equal(publicPast.status, 200, JSON.stringify(publicPast))

  assert.equal(authorList.status, 200, JSON.stringify(authorList))
  assert.deepEqual(ids(authorList), ['draft', 'future', 'past', 'undated'], 'the author lists the scheduled post')
  assert.equal(authorFuture.status, 200, JSON.stringify(authorFuture))

  // the date comes: the same post is public on the next read
  await owner.query(`UPDATE posts SET "publishedAt" = now() - interval '1 minute' WHERE id = 'future'`)
  const [afterList, afterRead] = runSteps(appUrl, ownerUrl, [{ path: '/api/v1/posts' }, { path: '/api/v1/posts/future' }])
  assert.deepEqual(ids(afterList), ['future', 'past', 'undated'])
  assert.equal(afterRead.status, 200, JSON.stringify(afterRead))
})

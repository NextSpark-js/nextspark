/**
 * MediaService.teamUrls (#361) on a throwaway cluster with core's migrations: the statement behind POST
 * /api/v1/media/sign and the signing of public pages answers only the active files of the team asked for, on the
 * service connection (no user: a public page) and on the RLS-enforced session of a user. Skipped when initdb and
 * pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAS_POSTGRES, cutoverDatabase, asUser } from './_pg-cutover'
import { TEAM_URLS_SQL } from '../../src/lib/services/media.service'

const url = (n: number) => `https://s3.example.org/shared/uploads/${n}.png`

test('teamUrls: another team and a deleted file are not answered, by session or by service connection', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('ua', 'ua@example.test', 'A', 'member', true), ('ub', 'ub@example.test', 'B', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'ua'), ('team-b', 'Team B', 'team-b', 'ub');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'ua', 'owner'), ('team-b', 'ub', 'owner');
    INSERT INTO media (id, "userId", "teamId", url, filename, "fileSize", "mimeType", status) VALUES
      ('m1', 'ua', 'team-a', '${url(1)}', '1.png', 1, 'image/png', 'active'),
      ('m2', 'ua', 'team-a', '${url(2)}', '2.png', 1, 'image/png', 'deleted'),
      ('m3', 'ub', 'team-b', '${url(3)}', '3.png', 1, 'image/png', 'active');
  `)
  const all = [url(1), url(2), url(3), url(4)]
  const urls = (rows: { url: string }[]) => rows.map(r => r.url).sort()

  // service connection (a public page): the team and the status are the statement's own filter
  assert.deepEqual(urls((await owner.query(TEAM_URLS_SQL, [all, 'team-a'])).rows), [url(1)])
  assert.deepEqual(urls((await owner.query(TEAM_URLS_SQL, [all, 'team-b'])).rows), [url(3)])

  // session of a member (RLS evaluated): the same answer, and a team the user is not in answers nothing
  const as = asUser(app)
  assert.deepEqual(urls((await as('ua', TEAM_URLS_SQL, [all, 'team-a'])).rows), [url(1)])
  assert.deepEqual((await as('ua', TEAM_URLS_SQL, [all, 'team-b'])).rows, [])
})

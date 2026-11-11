/**
 * Which database the `db` project of a project's Jest suite runs against (#430): the project is found among the Jest
 * arguments, and a database the environment names is used only when it is on this machine or the opt-in is set.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error -- plain .mjs module
import { ALLOW_REMOTE_DATABASE, TEST_DATABASE_URL, isLocalHost, selectsDatabaseProject, testDatabaseTarget } from '../../scripts/test/test-database.mjs'

test('the db project is selected by --selectProjects, in either spelling and among others', () => {
  assert.equal(selectsDatabaseProject(['--selectProjects', 'db']), true)
  assert.equal(selectsDatabaseProject(['--selectProjects=db']), true)
  assert.equal(selectsDatabaseProject(['--ci', '--selectProjects', 'unit', 'db', '--maxWorkers=2']), true)
  assert.equal(selectsDatabaseProject(['--selectProjects=unit', '--selectProjects', 'db']), true)
  assert.equal(selectsDatabaseProject(['--selectProjects', 'unit']), false)
  assert.equal(selectsDatabaseProject(['--selectProjects', '--ci', 'db']), false, 'db after another option is a test path, not a project')
  assert.equal(selectsDatabaseProject(['db']), false)
  assert.equal(selectsDatabaseProject([]), false)
  assert.equal(selectsDatabaseProject(['--selectProjects', 'database']), false)
})

test('a host is local when it is this machine: nothing, a socket directory, localhost or a loopback address', () => {
  for (const host of ['', undefined, 'localhost', 'LocalHost', 'app.localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]', '/var/run/postgresql', 'localhost.']) {
    assert.equal(isLocalHost(host), true, String(host))
  }
  for (const host of ['db.example.com', '10.0.0.5', '192.168.1.2', '0.0.0.0', '128.0.0.1', 'host.docker.internal', 'localhost.example.com', '2001:db8::1']) {
    assert.equal(isLocalHost(host), false, host)
  }
})

test('with no NEXTSPARK_TEST_DATABASE_URL the db project gets a throwaway cluster, whatever DATABASE_URL says', () => {
  assert.deepEqual(testDatabaseTarget({}), { url: null })
  assert.deepEqual(testDatabaseTarget({ DATABASE_URL: 'postgres://u:p@prod.example.com/app' }), { url: null })
  assert.deepEqual(testDatabaseTarget({ [TEST_DATABASE_URL]: '' }), { url: null })
})

test('a database on this machine is used as named; one that is not is refused with the way to allow it', () => {
  const local = 'postgres://u:p@127.0.0.1:5432/app_test'
  assert.deepEqual(testDatabaseTarget({ [TEST_DATABASE_URL]: local }), { url: local })
  const remote = { [TEST_DATABASE_URL]: 'postgres://appuser:s3cretpass@db.example.com/shared' }
  assert.throws(() => testDatabaseTarget(remote), (error: Error) => {
    assert.match(error.message, /NEXTSPARK_TEST_DATABASE_URL points at host db\.example\.com, database shared, which is not this machine/)
    assert.match(error.message, /set NEXTSPARK_TEST_ALLOW_REMOTE_DATABASE=1/)
    assert.match(error.message, /unset NEXTSPARK_TEST_DATABASE_URL/)
    assert.match(error.message, /Nothing was run\./)
    assert.ok(!error.message.includes('s3cretpass') && !error.message.includes('appuser'), 'no credential in the message')
    return true
  })
  for (const allow of ['1', 'true', 'TRUE']) assert.deepEqual(testDatabaseTarget({ ...remote, [ALLOW_REMOTE_DATABASE]: allow }), { url: remote[TEST_DATABASE_URL] })
  for (const no of ['0', 'false', '', 'yes']) assert.throws(() => testDatabaseTarget({ ...remote, [ALLOW_REMOTE_DATABASE]: no }), /not this machine/, `ALLOW=${no}`)
})

test('a URL that cannot be read is refused: it could point anywhere', () => {
  assert.throws(() => testDatabaseTarget({ [TEST_DATABASE_URL]: 'not a url' }), /cannot be checked for being on this machine/)
  assert.throws(() => testDatabaseTarget({ [TEST_DATABASE_URL]: 'not a url', [ALLOW_REMOTE_DATABASE]: '1' }), /cannot be checked/, 'the opt-in is for a host that is not local, not for a URL nobody can read')
  // a host in the query string is the one that is connected to
  assert.throws(() => testDatabaseTarget({ [TEST_DATABASE_URL]: 'postgres://u@127.0.0.1/app?host=db.example.com' }), /points at host db\.example\.com/)
})

test('a URL with no host connects to PGHOST, so that is the host that is checked', () => {
  const noHost = 'postgresql:///app'
  assert.deepEqual(testDatabaseTarget({ [TEST_DATABASE_URL]: noHost }), { url: noHost })
  assert.deepEqual(testDatabaseTarget({ [TEST_DATABASE_URL]: noHost, PGHOST: '/var/run/postgresql' }), { url: noHost })
  assert.throws(() => testDatabaseTarget({ [TEST_DATABASE_URL]: noHost, PGHOST: 'db.example.com' }), /points at host db\.example\.com/)
  assert.throws(() => testDatabaseTarget({ [TEST_DATABASE_URL]: noHost, PGHOSTADDR: '10.0.0.5' }), /points at host 10\.0\.0\.5/)
  assert.deepEqual(testDatabaseTarget({ [TEST_DATABASE_URL]: 'postgresql://u@127.0.0.1/app', PGHOST: 'db.example.com' }), { url: 'postgresql://u@127.0.0.1/app' }, 'a host in the URL wins')
})

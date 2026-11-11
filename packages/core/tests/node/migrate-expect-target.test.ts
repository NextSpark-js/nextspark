/**
 * db:migrate --expect-database / --expect-host (#429). The runner compares the target it resolved with what was
 * expected before it connects: the destinations here are unreachable (port 1), so a run that got as far as a
 * connection would say so, and one that stopped on the expectation never does.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error -- plain .mjs module
import { destinationParts, describeDestination, unexpectedTarget } from '../../scripts/db/destination.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const URL_1 = 'postgres://appuser:s3cretpass@Db.Example.com:1/app'

function run(t: { after: (fn: () => void) => void }, args: string[], url = URL_1) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-expect-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  const result = spawnSync(process.execPath, [RUNNER, '--no-env-file', ...args], { cwd: root, env, encoding: 'utf8', timeout: 60000 })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

test('a database that is not the expected one stops the run before it connects', t => {
  const { status, out } = run(t, ['--expect-database', 'other'])
  assert.equal(status, 1)
  assert.match(out, /--expect-database other: the connection points at database app \(expected other\)\. Nothing was run\./)
  assert.doesNotMatch(out, /Migrating|Connected|Migration error|ECONNREFUSED/)
  assert.ok(!out.includes('s3cretpass') && !out.includes('appuser'), 'no credential is shown')
})

test('a host that is not the expected one stops the run before it connects, and both mismatches are named', t => {
  const host = run(t, ['--expect-host=prod.example.com'])
  assert.equal(host.status, 1)
  assert.match(host.out, /--expect-host prod\.example\.com: the connection points at host Db\.Example\.com \(expected prod\.example\.com\)/)
  assert.doesNotMatch(host.out, /Migration error|ECONNREFUSED/)
  const both = run(t, ['--expect-database', 'other', '--expect-host', 'prod.example.com'])
  assert.match(both.out, /database app \(expected other\) and host Db\.Example\.com \(expected prod\.example\.com\)/)
})

test('the expected target goes on to connect, and says it was the expected one; the host compares ignoring case', t => {
  const { status, out } = run(t, ['--expect-database', 'app', '--expect-host', 'db.example.com'])
  assert.match(out, /Migrating host Db\.Example\.com, database app \(the expected target\)/)
  // it got as far as the connection, which port 1 refuses (or the name does not resolve)
  assert.equal(status, 1)
  assert.match(out, /Migration error/)
})

test('--dry-run states the target before it connects too', t => {
  const { out } = run(t, ['--dry-run', '--expect-database', 'app'])
  assert.match(out, /Dry run against host Db\.Example\.com, database app \(the expected target\): nothing will be written/)
})

test('an expectation with no value is refused', t => {
  for (const args of [['--expect-database'], ['--expect-database='], ['--expect-host', '--dry-run']]) {
    const { status, out } = run(t, args)
    assert.equal(status, 1)
    assert.match(out, /--expect-(database|host) needs a value/)
  }
})

test('the target is read from the URL as the runner connects with it', () => {
  assert.deepEqual(destinationParts('postgres://u:p@[::1]:5432/app'), { host: '[::1]', database: 'app' })
  assert.deepEqual(destinationParts('postgres:///app?host=/var/run/postgresql'), { host: '/var/run/postgresql', database: 'app' })
  assert.equal(destinationParts('not a url'), null)
  assert.equal(describeDestination('postgres://u:p@h/db%20x'), 'host h, database db x')
})

test('unexpectedTarget accepts the matching target and names the difference otherwise', () => {
  assert.equal(unexpectedTarget('postgres://u:p@h/app', {}), null)
  assert.equal(unexpectedTarget('postgres://u:p@h/app', { database: 'app', host: 'H' }), null)
  assert.equal(unexpectedTarget('postgres://u:p@[::1]/app', { host: '::1' }), null)
  assert.equal(unexpectedTarget('postgres://u:p@h./app', { host: 'h' }), null)
  assert.match(unexpectedTarget('postgres://u:p@h/', { database: 'app' }), /database \(none\) \(expected app\)/)
  assert.match(unexpectedTarget('nonsense', { host: 'h' }), /cannot be read, so the target cannot be checked/)
  assert.ok(!unexpectedTarget('postgres://user:pass@h/other', { database: 'app' })?.includes('pass'))
})

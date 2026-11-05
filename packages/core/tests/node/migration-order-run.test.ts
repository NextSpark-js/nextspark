/**
 * db:migrate against a real PostgreSQL runs a 151_ migration before a 1001_ one (#382): the runner sorts with
 * compareMigrations, not as text. Text order would run 1001_ first, against a table 151_ has not created yet.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not
 * on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { HAS_POSTGRES, startCluster } from '../support/throwaway-postgres'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')

test('the runner applies 151_ before 1001_, and a second run applies nothing again', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { port, stop } = await startCluster('migration-order-pg')
  t.after(stop)
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-order-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'entities/widgets/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const migrations = path.join(root, 'entities/widgets/migrations')
  fs.writeFileSync(path.join(migrations, '151_create_log.sql'), "CREATE TABLE order_log (id serial PRIMARY KEY, file text); INSERT INTO order_log (file) VALUES ('151');")
  fs.writeFileSync(path.join(migrations, '1001_use_log.sql'), "INSERT INTO order_log (file) VALUES ('1001');")

  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  const migrate = () => spawnSync(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 60000 })

  const first = migrate()
  assert.equal(first.status, 0, `${first.stdout}${first.stderr}`)
  const client = new pg.Client({ connectionString: url })
  client.on('error', () => {})
  await client.connect()
  t.after(() => client.end())
  const log = async () => (await client.query('SELECT file FROM order_log ORDER BY id')).rows.map(row => row.file)
  assert.deepEqual(await log(), ['151', '1001'])

  const second = migrate()
  assert.equal(second.status, 0, `${second.stdout}${second.stderr}`)
  assert.deepEqual(await log(), ['151', '1001'])
})

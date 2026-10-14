/**
 * db:migrate resolves its connection with the exported environment first and the
 * project .env second, names the destination (host and database) before it runs,
 * and never prints a credential. Nothing here needs a database: the destinations
 * are unreachable, and the runner fails at the connection after naming them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')

const ENV_URL = 'postgres://envuser:envsecret@127.0.0.1:1/envdb'
const EXPORTED_URL = 'postgres://exportuser:exportsecret@127.0.0.1:1/exporteddb'
const SECRETS = ['envuser', 'envsecret', 'exportuser', 'exportsecret', 'postgres://']

function project(t: { after: (fn: () => void) => void }, envFile?: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-env-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.3.8' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  if (envFile !== undefined) fs.writeFileSync(path.join(root, '.env'), envFile)
  return root
}

function run(root: string, env: Record<string, string>, args: string[] = []) {
  const childEnv: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development', ...env }
  for (const key of ['DATABASE_URL', 'MIGRATE_DATABASE_URL']) if (!(key in env)) delete childEnv[key]
  const result = spawnSync(process.execPath, [RUNNER, ...args], { cwd: root, env: childEnv as NodeJS.ProcessEnv, encoding: 'utf8', timeout: 60000 })
  return `${result.stdout}${result.stderr}`
}

function noCredentials(output: string) {
  for (const secret of SECRETS) assert.ok(!output.includes(secret), `the output shows "${secret}"`)
}

test('an exported DATABASE_URL beats the project .env, and the output names host and database only', t => {
  const output = run(project(t, `DATABASE_URL=${ENV_URL}\n`), { DATABASE_URL: EXPORTED_URL })
  assert.match(output, /host 127\.0\.0\.1, database exporteddb/)
  assert.ok(!output.includes('envdb'), output)
  noCredentials(output)
})

test('an exported MIGRATE_DATABASE_URL beats the .env one', t => {
  const output = run(project(t, `DATABASE_URL=${ENV_URL}\nMIGRATE_DATABASE_URL=${ENV_URL}\n`), { MIGRATE_DATABASE_URL: EXPORTED_URL })
  assert.match(output, /database exporteddb/)
  assert.ok(!output.includes('envdb'), output)
  noCredentials(output)
})

test('with only the .env set, the .env is used as before', t => {
  const output = run(project(t, `DATABASE_URL=${ENV_URL}\n`), {})
  assert.match(output, /host 127\.0\.0\.1, database envdb/)
  noCredentials(output)
})

test('--no-env-file ignores the .env even when it is present', t => {
  const root = project(t, `DATABASE_URL=${ENV_URL}\n`)
  const none = run(root, {}, ['--no-env-file'])
  assert.match(none, /DATABASE_URL not found/)
  assert.ok(!none.includes('envdb'), none)
  const exported = run(root, { DATABASE_URL: EXPORTED_URL }, ['--no-env-file'])
  assert.match(exported, /database exporteddb/)
  noCredentials(exported)
})

test('a URL that cannot be read is named as such, never echoed', t => {
  const output = run(project(t), { DATABASE_URL: 'not a url but secret-token' })
  assert.match(output, /Migrating unreadable URL/)
  assert.ok(!output.includes('secret-token'), output)
})

test('a URL with an unencoded "/" in the password is not read as a host and database', t => {
  const output = run(project(t), { DATABASE_URL: 'postgres://alice:1234/s3cret@db.example.com/app' })
  assert.match(output, /Migrating unreadable URL/)
  for (const part of ['alice', '1234', 's3cret']) assert.ok(!output.includes(part), `the output shows "${part}"`)
})

test('an error message that names the role or the password is scrubbed', async () => {
  const { rememberSecrets, scrub } = await import('../../scripts/db/destination.mjs')
  const { migrationFailure } = await import('../../scripts/db/migration-time-limit.mjs')
  rememberSecrets('postgres://alice:p%40ss@db.example.com/app')
  const message = scrub('password authentication failed for user "alice" (p@ss) at postgres://alice:p%40ss@db.example.com/app')
  assert.equal(message, 'password authentication failed for user "***" (***) at ***')
  const failure = migrationFailure('001_x.sql', new Error('role "alice" does not exist'))
  assert.equal(failure, 'Failed to execute 001_x.sql: role "***" does not exist')
})

test('db:verify-tables follows the same precedence: the exported URL beats the .env', t => {
  const root = project(t, `DATABASE_URL=postgres://envuser:envsecret@127.0.0.1:2/envdb\n`)
  const result = spawnSync(process.execPath, [path.join(CORE, 'scripts/db/verify-tables.mjs')], {
    cwd: root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, DATABASE_URL: 'postgres://exportuser:exportsecret@127.0.0.1:1/exporteddb' },
  })
  const output = `${result.stdout}${result.stderr}`
  assert.match(output, /127\.0\.0\.1:1\b/, output)
  assert.ok(!output.includes('127.0.0.1:2'), output)
})

test('db:verify-tables prints no user or password from a server error', async t => {
  // A server that refuses every login the way PostgreSQL does, naming the role in the message
  const server = net.createServer(socket => {
    socket.once('data', () => {
      const field = (code: string, text: string) => Buffer.concat([Buffer.from(code), Buffer.from(`${text}\0`)])
      const body = Buffer.concat([field('S', 'FATAL'), field('C', '28P01'), field('M', 'password authentication failed for user "exportuser"'), Buffer.from('\0')])
      const header = Buffer.alloc(5)
      header.write('E')
      header.writeInt32BE(body.length + 4, 1)
      socket.end(Buffer.concat([header, body]))
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const { port } = server.address() as net.AddressInfo

  const child = spawn(process.execPath, [path.join(CORE, 'scripts/db/verify-tables.mjs')], {
    cwd: project(t), env: { ...process.env, DATABASE_URL: `postgres://exportuser:exportsecret@127.0.0.1:${port}/exporteddb?sslmode=disable` },
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  await new Promise(resolve => child.on('close', resolve))
  assert.match(output, /password authentication failed for user "\*\*\*"/, output)
  noCredentials(output)
})

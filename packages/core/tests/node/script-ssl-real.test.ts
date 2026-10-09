/**
 * The database scripts' SSL policy against a real PostgreSQL. With
 * NODE_ENV=production (in the process or the project .env) a URL without
 * sslmode connects as the application does: over SSL with a validated
 * certificate, and never in plaintext. Outside production it keeps libpq's
 * `prefer`.
 *
 * The tests start throwaway clusters with initdb and pg_ctl on a free port, one
 * without SSL and one with a self-signed certificate made with openssl, and are
 * skipped when those are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type pg from 'pg'
import { NO_SSL_IN_PRODUCTION, scriptClient } from '../../scripts/db/ssl-config.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const SSL_CONFIG = pathToFileURL(path.join(CORE, 'scripts/db/ssl-config.mjs')).href
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)
const HAS_OPENSSL = spawnSync('openssl', ['version']).status === 0
const PASSWORD = 's111-url-secret'

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** A throwaway cluster, with a self-signed certificate for 127.0.0.1 and localhost (pg names an IP host to TLS as localhost) when `ssl` is set; stopped and removed after the test. */
async function throwawayCluster(t: TestContext, { ssl = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-ssl-pg-'))
  const data = path.join(dir, 'data')
  const port = await freePort()
  execFileSync('initdb', ['-D', data, '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  const certificate = path.join(dir, 'server.crt')
  let options = `-h 127.0.0.1 -p ${port} -k ${dir}`
  if (ssl) {
    const key = path.join(dir, 'server.key')
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
      '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost', '-keyout', key, '-out', certificate], { stdio: 'ignore' })
    fs.chmodSync(key, 0o600)
    options += ` -c ssl=on -c ssl_cert_file=${certificate} -c ssl_key_file=${key}`
  }
  execFileSync('pg_ctl', ['-D', data, '-l', path.join(dir, 'log'), '-o', options, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', data, 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return { url: `postgresql://owner:${PASSWORD}@127.0.0.1:${port}/postgres`, certificate }
}

async function withNodeEnv<T>(nodeEnv: string, run: () => Promise<T>) {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = nodeEnv
  try {
    return await run()
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
}

/** Connects a script client and returns whether the session is over SSL. */
async function sessionSSL(url: string) {
  const client = scriptClient(url) as pg.Client
  await client.connect()
  try {
    return (await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()')).rows[0].ssl as boolean
  } finally {
    await client.end()
  }
}

/** A project db:migrate can start in, with `.env` as given and no migrations of its own. */
function project(t: TestContext, env: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'script-ssl-project-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.3.8' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  fs.writeFileSync(path.join(root, '.env'), env)
  return root
}

function migrate(root: string) {
  const childEnv: Record<string, string | undefined> = { ...process.env }
  for (const name of ['NODE_ENV', 'DATABASE_URL', 'MIGRATE_DATABASE_URL', 'MIGRATION_TIMEOUT_SECONDS', 'NEXTSPARK_SEED_SAMPLE_DATA']) delete childEnv[name]
  const result = spawnSync(process.execPath, [RUNNER], { cwd: root, env: childEnv as NodeJS.ProcessEnv, encoding: 'utf8', timeout: 120000 })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

test('server without SSL: production refuses a URL without sslmode, sslmode=disable connects, development falls back', { skip: !HAS_POSTGRES, timeout: 60000 }, async t => {
  const { url } = await throwawayCluster(t)

  await withNodeEnv('production', async () => {
    await assert.rejects(scriptClient(url).connect(), (error: Error) => {
      assert.equal(error.message, NO_SSL_IN_PRODUCTION)
      assert.match(error.message, /sslmode=disable/)
      assert.match(error.message, /sslmode=verify-full/)
      assert.doesNotMatch(error.message, new RegExp(`${PASSWORD}|127\\.0\\.0\\.1`))
      return true
    })
    assert.equal(await sessionSSL(`${url}?sslmode=disable`), false)
  })
  await withNodeEnv('development', async () => {
    assert.equal(await sessionSSL(url), false, 'the plaintext fallback outside production')
  })
})

test('db:migrate with NODE_ENV=production in the project .env refuses a server without SSL and does not print the URL', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url } = await throwawayCluster(t)

  const refused = migrate(project(t, `NODE_ENV=production\nDATABASE_URL="${url}"\n`))
  assert.equal(refused.status, 1, refused.output)
  assert.ok(refused.output.includes(NO_SSL_IN_PRODUCTION), refused.output)
  assert.ok(!refused.output.includes(PASSWORD), 'the URL, which holds the password, is never printed')

  const disabled = migrate(project(t, `NODE_ENV=production\nDATABASE_URL="${url}?sslmode=disable"\n`))
  assert.equal(disabled.status, 0, disabled.output)
  assert.match(disabled.output, /Connected to database/)
})

test('server with a self-signed certificate: production validates it, sslmode=require does not', { skip: !HAS_POSTGRES || !HAS_OPENSSL, timeout: 60000 }, async t => {
  const { url, certificate } = await throwawayCluster(t, { ssl: true })

  await withNodeEnv('production', async () => {
    await assert.rejects(scriptClient(url).connect(), /self[- ]signed certificate/)
    assert.equal(await sessionSSL(`${url}?sslmode=require`), true)
  })
  await withNodeEnv('development', async () => {
    assert.equal(await sessionSSL(url), true, 'outside production: SSL without validation')
  })

  // The same production connection once the certificate is trusted: what failed above was the validation.
  const trusted = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const { scriptClient } = await import(${JSON.stringify(SSL_CONFIG)})
    const client = scriptClient(process.env.URL)
    await client.connect()
    const { rows } = await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()')
    await client.end()
    process.stdout.write(String(rows[0].ssl))
  `], { env: { ...process.env, NODE_ENV: 'production', URL: url, NODE_EXTRA_CA_CERTS: certificate }, encoding: 'utf8', timeout: 30000 })
  assert.equal(trusted.status, 0, `${trusted.stdout}${trusted.stderr}`)
  assert.equal(trusted.stdout.trim(), 'true')
})

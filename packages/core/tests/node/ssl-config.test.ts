/**
 * The standalone database scripts intentionally duplicate the runtime SSL
 * policy. Keep their explicit decisions coupled without putting a script module
 * in the application bundle. A URL without sslmode differs only outside
 * production: scripts implement libpq's SSL `prefer` there, while in production
 * they validate the certificate as the runtime does.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  parseSSLConfig as scriptParseSSLConfig,
  prefersSSL,
  scriptConnectionOptions,
  setProjectEnv,
  stripSSLParams as scriptStripSSLParams,
} from '../../scripts/db/ssl-config.mjs'

const URL = 'postgresql://user:password@db.example.test:5432/nextspark'
const DB_SOURCE = join(import.meta.dirname, '../../src/lib/db.ts')

type ParseSSLConfig = (databaseUrl: string) => false | { rejectUnauthorized: boolean }

const parityCases = [
  { name: 'no URL', databaseUrl: '' },
  { name: 'sslmode=disable', databaseUrl: `${URL}?sslmode=disable` },
  { name: 'sslmode=require', databaseUrl: `${URL}?sslmode=require` },
  { name: 'sslmode=prefer', databaseUrl: `${URL}?sslmode=prefer` },
  { name: 'sslmode=allow', databaseUrl: `${URL}?sslmode=allow` },
  { name: 'sslmode=verify-ca', databaseUrl: `${URL}?sslmode=verify-ca` },
  { name: 'sslmode=verify-full', databaseUrl: `${URL}?sslmode=verify-full` },
  { name: 'normalized sslmode', databaseUrl: `${URL}?sslmode=%20Require%20` },
  { name: 'unknown sslmode', databaseUrl: `${URL}?sslmode=unknown` },
  { name: 'malformed URL with disable', databaseUrl: 'not-a-url-but-has-sslmode=disable' },
  { name: 'malformed URL without sslmode', databaseUrl: 'not-a-url' },
]

function withNodeEnv(nodeEnv: string, callback: () => void) {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = nodeEnv
  try {
    callback()
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
}

type RuntimeSSLHelpers = {
  parseSSLConfig: ParseSSLConfig
  stripSSLParams: (databaseUrl: string) => string
}

async function runtimeSSLHelpers(): Promise<RuntimeSSLHelpers> {
  const source = readFileSync(DB_SOURCE, 'utf8')
  const start = source.indexOf('export function stripSSLParams')
  const end = source.indexOf('\nconst databaseUrl', start)
  assert.ok(start >= 0 && end > start, 'src/lib/db.ts must contain SSL helpers before pool setup')

  // Import the TypeScript function through tsx without importing db.ts's pool
  // and its runtime-only dependency graph. The extracted source is the exact
  // function exported by db.ts, so a policy change there changes this test.
  const directory = mkdtempSync(join(tmpdir(), 'nextspark-runtime-ssl-policy-'))
  const modulePath = join(directory, 'runtime-ssl-policy.ts')
  writeFileSync(modulePath, `${source.slice(start, end)}\n`)
  try {
    const runtime = await import(pathToFileURL(modulePath).href) as { parseSSLConfig: ParseSSLConfig }
    return runtime
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('database scripts match the runtime for explicit and invalid SSL policy inputs', async () => {
  const runtime = await runtimeSSLHelpers()
  for (const nodeEnv of ['development', 'production']) {
    for (const { name, databaseUrl } of parityCases) {
      withNodeEnv(nodeEnv, () => {
        assert.deepEqual(
          scriptParseSSLConfig(databaseUrl),
          runtime.parseSSLConfig(databaseUrl),
          `${name} with NODE_ENV=${nodeEnv}`,
        )
        assert.equal(
          scriptStripSSLParams(databaseUrl),
          runtime.stripSSLParams(databaseUrl),
          `stripSSLParams: ${name} with NODE_ENV=${nodeEnv}`,
        )
      })
    }
  }
})

test('a valid URL without sslmode uses libpq SSL prefer outside production, and the runtime policy in production', async () => {
  const runtime = await runtimeSSLHelpers()
  withNodeEnv('development', () => {
    // Keep parseSSLConfig itself coupled: its callers outside connection
    // creation still have the runtime's documented environment policy.
    assert.deepEqual(scriptParseSSLConfig(URL), runtime.parseSSLConfig(URL))
    // Outside production the connection builder deliberately differs: it asks
    // for TLS first and scriptClient retries plaintext only for pg's exact
    // no-SSL server error.
    assert.equal(prefersSSL(URL), true)
    assert.deepEqual(scriptConnectionOptions(URL).ssl, { rejectUnauthorized: false })
    assert.notDeepEqual(scriptConnectionOptions(URL).ssl, runtime.parseSSLConfig(URL))
  })
  withNodeEnv('production', () => {
    assert.deepEqual(scriptConnectionOptions(URL).ssl, { rejectUnauthorized: true })
    assert.deepEqual(scriptConnectionOptions(URL).ssl, runtime.parseSSLConfig(URL))
  })
  // NODE_ENV=production in the project .env counts as it does for the sample data
  withNodeEnv('development', () => {
    setProjectEnv({ NODE_ENV: '"production" # live' })
    try {
      assert.deepEqual(scriptConnectionOptions(URL).ssl, { rejectUnauthorized: true })
    } finally {
      setProjectEnv({})
    }
    assert.deepEqual(scriptConnectionOptions(URL).ssl, { rejectUnauthorized: false })
  })
})

const WARNING = '[DB] WARNING: SSL disabled in production environment. This is insecure!'

/** Run `parse` in production with console.warn captured; returns the warnings it printed. */
function warningsFrom(parse: () => void): string[] {
  const warnings: string[] = []
  const original = console.warn
  console.warn = (message: string) => { warnings.push(message) }
  try {
    withNodeEnv('production', parse)
  } finally {
    console.warn = original
  }
  return warnings
}

const SSL_WARNED = Symbol.for('nextspark.dbSslDisabledWarned')
const forgetWarning = () => { delete (globalThis as Record<symbol, unknown>)[SSL_WARNED] }

// The warning is once per process, whichever copy of the module prints it (Next bundles one for instrumentation and
// one for the routes), so it is kept on globalThis. The parity test above already used it up: this test starts over.
test('sslmode=disable in production: silent on loopback, warns once for a remote host', async () => {
  const runtime = await runtimeSSLHelpers()
  const fresh = await import('../../scripts/db/ssl-config.mjs?fresh') as { parseSSLConfig: ParseSSLConfig }
  const implementations = { script: fresh.parseSSLConfig, runtime: runtime.parseSSLConfig }

  for (const [name, parse] of Object.entries(implementations)) {
    forgetWarning()
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '[::1]']) {
      const warnings = warningsFrom(() => { for (let i = 0; i < 3; i++) parse(`postgresql://u:p@${host}:5432/db?sslmode=disable`) })
      assert.deepEqual(warnings, [], `${name}: ${host}`)
    }
    const remote = warningsFrom(() => { for (let i = 0; i < 3; i++) parse(`${URL}?sslmode=disable`) })
    assert.deepEqual(remote, [WARNING], `${name}: remote host warns exactly once`)
  }
})

test('two copies of the module in one process print the warning once', async () => {
  const runtime = await runtimeSSLHelpers()
  const copyA = await import('../../scripts/db/ssl-config.mjs?copy-a') as { parseSSLConfig: ParseSSLConfig }
  const copyB = await import('../../scripts/db/ssl-config.mjs?copy-b') as { parseSSLConfig: ParseSSLConfig }
  forgetWarning()
  const warnings = warningsFrom(() => { for (const parse of [copyA.parseSSLConfig, copyB.parseSSLConfig, runtime.parseSSLConfig]) parse(`${URL}?sslmode=disable`) })
  assert.deepEqual(warnings, [WARNING])
})

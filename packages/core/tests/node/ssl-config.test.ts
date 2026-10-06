/**
 * The standalone database scripts intentionally duplicate the runtime SSL
 * policy. Keep their explicit decisions coupled without putting a script module
 * in the application bundle. A URL without sslmode deliberately differs:
 * scripts implement libpq's SSL `prefer`, while the runtime keeps its existing
 * environment default until its next release.
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

test('a valid URL without sslmode deliberately uses libpq SSL prefer in scripts', async () => {
  const runtime = await runtimeSSLHelpers()
  for (const nodeEnv of ['development', 'production']) {
    withNodeEnv(nodeEnv, () => {
      // Keep parseSSLConfig itself coupled: its callers outside connection
      // creation still have the runtime's documented environment policy.
      assert.deepEqual(scriptParseSSLConfig(URL), runtime.parseSSLConfig(URL), nodeEnv)
      // The connection builder is intentionally different: it asks for TLS
      // first and scriptClient retries plaintext only for pg's exact no-SSL
      // server error. Do not fold this back into runtime parity by accident.
      assert.equal(prefersSSL(URL), true, nodeEnv)
      assert.deepEqual(scriptConnectionOptions(URL).ssl, { rejectUnauthorized: false }, nodeEnv)
      assert.notDeepEqual(scriptConnectionOptions(URL).ssl, runtime.parseSSLConfig(URL), nodeEnv)
    })
  }
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

// Each implementation warns at most once per process, and the parity test above already used up the shared
// module's one warning: this test loads fresh instances of both.
test('sslmode=disable in production: silent on loopback, warns once for a remote host', async () => {
  const runtime = await runtimeSSLHelpers()
  const fresh = await import('../../scripts/db/ssl-config.mjs?fresh') as { parseSSLConfig: ParseSSLConfig }
  const implementations = { script: fresh.parseSSLConfig, runtime: runtime.parseSSLConfig }

  for (const [name, parse] of Object.entries(implementations)) {
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '[::1]']) {
      const warnings = warningsFrom(() => { for (let i = 0; i < 3; i++) parse(`postgresql://u:p@${host}:5432/db?sslmode=disable`) })
      assert.deepEqual(warnings, [], `${name}: ${host}`)
    }
    const remote = warningsFrom(() => { for (let i = 0; i < 3; i++) parse(`${URL}?sslmode=disable`) })
    assert.deepEqual(remote, [WARNING], `${name}: remote host warns exactly once`)
  }
})

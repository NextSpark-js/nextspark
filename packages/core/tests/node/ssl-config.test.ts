/**
 * The standalone database scripts intentionally duplicate the runtime SSL
 * policy. Keep their decisions coupled without putting a script module in the
 * application bundle.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseSSLConfig as scriptParseSSLConfig } from '../../scripts/db/ssl-config.mjs'

const URL = 'postgresql://user:password@db.example.test:5432/nextspark'
const DB_SOURCE = join(import.meta.dirname, '../../src/lib/db.ts')

type ParseSSLConfig = (databaseUrl: string) => false | { rejectUnauthorized: boolean }

const cases = [
  { name: 'no URL', databaseUrl: '' },
  { name: 'no sslmode', databaseUrl: URL },
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

async function runtimeParseSSLConfig(): Promise<ParseSSLConfig> {
  const source = readFileSync(DB_SOURCE, 'utf8')
  const start = source.indexOf('export function parseSSLConfig')
  const end = source.indexOf('\nconst databaseUrl', start)
  assert.ok(start >= 0 && end > start, 'src/lib/db.ts must contain parseSSLConfig before pool setup')

  // Import the TypeScript function through tsx without importing db.ts's pool
  // and its runtime-only dependency graph. The extracted source is the exact
  // function exported by db.ts, so a policy change there changes this test.
  const directory = mkdtempSync(join(tmpdir(), 'nextspark-runtime-ssl-policy-'))
  const modulePath = join(directory, 'runtime-ssl-policy.ts')
  writeFileSync(modulePath, `${source.slice(start, end)}\n`)
  try {
    const runtime = await import(pathToFileURL(modulePath).href) as { parseSSLConfig: ParseSSLConfig }
    return runtime.parseSSLConfig
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('database scripts make the same SSL decision as the application runtime', async () => {
  const parseRuntimeSSLConfig = await runtimeParseSSLConfig()
  for (const nodeEnv of ['development', 'production']) {
    for (const { name, databaseUrl } of cases) {
      withNodeEnv(nodeEnv, () => {
        assert.deepEqual(
          scriptParseSSLConfig(databaseUrl),
          parseRuntimeSSLConfig(databaseUrl),
          `${name} with NODE_ENV=${nodeEnv}`,
        )
      })
    }
  }
})

/**
 * The next.config template merges an optional next.config.extend.mjs (#329): headers and redirects after core's, rewrites
 * (core has none), and CSP sources appended to a directive. Without the file the config is what core always shipped.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

type Header = { key: string; value: string }
type Rule = { source: string; headers: Header[] }

async function load(extension: string | null, nodeEnv = 'production') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-next-config-extend-')))
  const previous = process.env.NODE_ENV
  try {
    const copy = path.join(root, 'next.config.mjs')
    fs.copyFileSync(path.join(REPO, 'packages/core/templates/next.config.mjs'), copy)
    if (extension !== null) fs.writeFileSync(path.join(root, 'next.config.extend.mjs'), extension)
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
    fs.symlinkSync(fs.realpathSync(path.join(REPO, 'apps/dev/node_modules/next-intl')), path.join(root, 'node_modules', 'next-intl'), 'dir')
    const { default: config } = await import(pathToFileURL(copy).href)
    ;(process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv
    return {
      keys: Object.keys(config).sort(),
      redirects: (await config.redirects()) as Array<{ source: string }>,
      headers: (await config.headers()) as Rule[],
      rewrites: config.rewrites ? await config.rewrites() : undefined,
    }
  } finally {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = previous
    fs.rmSync(root, { recursive: true, force: true })
  }
}

const cspOf = (rules: Rule[]) =>
  new Map(rules.flatMap(r => r.headers).find(h => h.key === 'Content-Security-Policy')!.value.split('; ').map(d => [d.split(' ')[0], d] as [string, string]))

const BASELINE = JSON.parse(fs.readFileSync(path.join(REPO, 'packages/core/tests/fixtures/next-config-baseline.json'), 'utf8')) as Record<string, { keys: string[]; headers: Rule[]; redirects: Array<{ source: string }> }>
const CONSENT_VARS = ['NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL', 'NEXT_PUBLIC_GA_MEASUREMENT_ID']

test('without an extension file, or with an empty one, the config is the one core shipped before the extension existed', async () => {
  // The fixture is that config's output, captured from the template before this feature (production and development)
  const saved = Object.fromEntries(CONSENT_VARS.map(name => [name, process.env[name]]))
  for (const name of CONSENT_VARS) delete process.env[name]
  try {
    for (const nodeEnv of ['production', 'development']) {
      const expected = BASELINE[nodeEnv]
      for (const extension of [null, 'export default {}\n']) {
        const out = await load(extension, nodeEnv)
        assert.deepEqual(out.keys, [...expected.keys].sort(), `${nodeEnv} keys`)
        assert.deepEqual(out.headers, expected.headers, `${nodeEnv} headers`)
        assert.deepEqual(out.redirects, expected.redirects, `${nodeEnv} redirects`)
        assert.equal(out.rewrites, undefined)
      }
    }
  } finally {
    for (const name of CONSENT_VARS) if (saved[name] !== undefined) process.env[name] = saved[name]
  }
})

const INVALID: Array<[string, string, RegExp]> = [
  ['a csp value that smuggles a second directive', "export default { csp: { 'script-src': 'https://a.com; img-src *' } }", /next\.config\.extend\.mjs: "csp\.script-src" has an invalid source/],
  ['a csp source with a comma', "export default { csp: { 'script-src': ['https://a.com,https://b.com'] } }", /"csp\.script-src" has an invalid source/],
  ['a csp array', "export default { csp: ['https://a.com'] }", /next\.config\.extend\.mjs: "csp" must be an object/],
  ['an upper-case directive', "export default { csp: { 'Script-Src': ['https://a.com'] } }", /"csp\.Script-Src" is not a directive name/],
  ['an empty directive', "export default { csp: { 'worker-src': [] } }", /"csp\.worker-src" must be a source or a non-empty array/],
  ['an empty source', "export default { csp: { 'worker-src': [''] } }", /"csp\.worker-src" has an invalid source/],
  ['headers as an object', "export default { headers: { source: '/', headers: [] } }", /next\.config\.extend\.mjs: "headers" must be an array of rules/],
  ['redirects as a string', "export default { redirects: '/a' }", /"redirects" must be an array of rules/],
  ['a function returning a non-array', "export default { headers: () => ({}) }", /"headers" must be an array of rules/],
  ['rewrites with an unknown phase', "export default { rewrites: { before: [] } }", /"rewrites\.before" must be beforeFiles, afterFiles or fallback/],
  ['an unknown key', "export default { header: [] }", /"header" is not a known key/],
  ['a function as the default export', "export default () => ({})", /"default" must be an object/],
  ['no default export', "export const headers = []", /"headers" is a named export/],
]

for (const [name, extension, message] of INVALID) {
  test(`an extension with ${name} stops the config with an error that names the file and the key`, async () => {
    await assert.rejects(() => load(extension), message)
  })
}

test('rewrites may be the object Next accepts, or a function returning an array', async () => {
  assert.deepEqual((await load("export default { rewrites: async () => [{ source: '/a', destination: '/b' }] }")).rewrites, [{ source: '/a', destination: '/b' }])
  assert.deepEqual((await load("export default { rewrites: { afterFiles: [], fallback: [] } }")).rewrites, { afterFiles: [], fallback: [] })
})

test('redirects and headers of the extension come after core’s; rewrites are added', async () => {
  const ext = `export default {
    redirects: [{ source: '/old', destination: '/new', permanent: true }],
    headers: async () => [{ source: '/embed/:path*', headers: [{ key: 'X-Frame-Options', value: 'ALLOWALL' }] }],
    rewrites: { beforeFiles: [{ source: '/blog/:slug', destination: '/posts/:slug' }] },
  }\n`
  const base = await load(null)
  const out = await load(ext)
  assert.deepEqual(out.redirects.slice(0, base.redirects.length), base.redirects)
  assert.equal(out.redirects.at(-1)!.source, '/old')
  assert.deepEqual(out.headers[0], base.headers[0])
  assert.equal(out.headers.at(-1)!.source, '/embed/:path*')
  assert.deepEqual(out.rewrites, { beforeFiles: [{ source: '/blog/:slug', destination: '/posts/:slug' }] })
})

test('csp additions append to a directive, skip duplicates, and add new directives; nothing core allows is dropped', async () => {
  const base = cspOf((await load(null)).headers)
  const out = cspOf((await load(`export default { csp: {
    'script-src': ['https://cdn.example.com', 'https://js.stripe.com'],
    'connect-src': 'https://api.example.com',
    'worker-src': ["'self'", 'blob:'],
    'object-src': ['https://plugins.example.com'],
  } }\n`)).headers)
  assert.equal(out.get('script-src'), `${base.get('script-src')} https://cdn.example.com`)
  assert.equal(out.get('connect-src'), `${base.get('connect-src')} https://api.example.com`)
  assert.equal(out.get('worker-src'), "worker-src 'self' blob:")
  assert.equal(out.get('object-src'), 'object-src https://plugins.example.com')
  for (const name of ['default-src', 'style-src', 'img-src', 'frame-ancestors', 'base-uri', 'report-uri', 'report-to']) {
    assert.equal(out.get(name), base.get(name), name)
  }
})

test('a project Content-Security-Policy header replaces the policy only because it comes later', async () => {
  const out = await load(`export default { headers: [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'" }] }] }\n`)
  const csp = out.headers.flatMap(r => r.headers).filter(h => h.key === 'Content-Security-Policy')
  assert.equal(csp.length, 2)
  assert.equal(csp.at(-1)!.value, "default-src 'none'")
})

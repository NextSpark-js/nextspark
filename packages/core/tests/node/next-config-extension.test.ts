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

test('an empty extension, or none, leaves the config as core ships it', async () => {
  const none = await load(null)
  const empty = await load('export default {}\n')
  assert.deepEqual(empty, none)
  assert.equal(none.rewrites, undefined)
  assert.ok(!none.keys.includes('rewrites'))
  assert.equal(none.headers.length, 1)
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

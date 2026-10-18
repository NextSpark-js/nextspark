/**
 * The CSP of next.config names an analytics vendor only when its loader is configured (cookie consent, #272):
 * Plausible's script origin (or a self-hosted one) and Google Analytics' script, connect and image origins.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const VARS = ['NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL', 'NEXT_PUBLIC_GA_MEASUREMENT_ID']

async function csp(file: string, env: Record<string, string>): Promise<Map<string, string>> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-next-config-consent-')))
  const saved = Object.fromEntries(VARS.map(name => [name, process.env[name]]))
  try {
    const copy = path.join(root, 'next.config.mjs')
    fs.copyFileSync(path.join(REPO, file), copy)
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
    fs.symlinkSync(fs.realpathSync(path.join(REPO, 'apps/dev/node_modules/next-intl')), path.join(root, 'node_modules', 'next-intl'), 'dir')
    const { default: config } = await import(pathToFileURL(copy).href)
    for (const name of VARS) delete process.env[name]
    Object.assign(process.env, env)
    const rules = await config.headers()
    const header = rules.flatMap((rule: { headers: Array<{ key: string; value: string }> }) => rule.headers).find((h: { key: string }) => h.key === 'Content-Security-Policy')
    return new Map<string, string>(header.value.split('; ').map((d: string) => [d.split(' ')[0], d] as [string, string]))
  } finally {
    for (const name of VARS) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
    fs.rmSync(root, { recursive: true, force: true })
  }
}

for (const file of ['packages/core/templates/next.config.mjs', 'apps/dev/next.config.mjs']) {
  test(`${file}: no analytics origin without a configured loader`, async () => {
    const directives = await csp(file, {})
    const all = [...directives.values()].join(' ')
    assert.doesNotMatch(all, /plausible|google-analytics|googletagmanager|analytics\.google/)
  })

  test(`${file}: Plausible adds its script and connect origin only`, async () => {
    const directives = await csp(file, { NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'example.com' })
    assert.match(directives.get('script-src')!, / https:\/\/plausible\.io(?: |$)/)
    assert.match(directives.get('connect-src')!, / https:\/\/plausible\.io(?: |$)/)
    assert.doesNotMatch([...directives.values()].join(' '), /google-analytics|googletagmanager|analytics\.google/)
  })

  test(`${file}: a self-hosted Plausible adds the origin of its script URL, not plausible.io`, async () => {
    const directives = await csp(file, { NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'example.com', NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL: 'https://stats.example.org/js/plausible.js' })
    assert.match(directives.get('script-src')!, / https:\/\/stats\.example\.org(?: |$)/)
    assert.match(directives.get('connect-src')!, / https:\/\/stats\.example\.org(?: |$)/)
    assert.doesNotMatch([...directives.values()].join(' '), /plausible\.io/)
  })

  test(`${file}: Google Analytics adds its script, connect and image origins`, async () => {
    const directives = await csp(file, { NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123' })
    assert.match(directives.get('script-src')!, / https:\/\/www\.googletagmanager\.com(?: |$)/)
    assert.match(directives.get('connect-src')!, / https:\/\/www\.google-analytics\.com /)
    assert.match(directives.get('connect-src')!, / https:\/\/\*\.analytics\.google\.com /)
    assert.match(directives.get('img-src')!, / https:\/\/www\.google-analytics\.com(?: |$)/)
    assert.doesNotMatch([...directives.values()].join(' '), /plausible/)
  })
}

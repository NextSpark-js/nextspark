import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'

/**
 * #212: `prepare --production`, as the built CLI against the real core, with a billing config that is
 * absent, valid, or exists but cannot load. The last one must stop the build with the file and the cause:
 * an empty billing registry has no plans, and a project without plans skips every feature and quota check.
 */

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let CLI_ENTRY = ''
before(() => { CLI_ENTRY = buildCli() })

const VALID = `export const billingConfig = { provider: 'stripe', currency: 'usd', defaultPlan: 'free', features: {}, limits: {}, plans: [{ slug: 'free', visibility: 'public', features: [], limits: {} }] }\n`

async function prepareWith(billing: string | null) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-billing-load-'))
  try {
    const write = async (path: string, content: string) => {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), content)
    }
    await write('nextspark.config.ts', 'export default { plugins: [] }\n')
    await write('package.json', JSON.stringify({ dependencies: { next: '16.3.8' } }))
    await write('templates/pricing/page.tsx', 'export default function Pricing() { return null }\n')
    if (billing !== null) await write('config/billing.config.ts', billing)
    await mkdir(join(root, 'node_modules/@nextsparkjs'), { recursive: true })
    await symlink(join(PKG_ROOT, '../core'), join(root, 'node_modules/@nextsparkjs/core'))
    await symlink(join(PKG_ROOT, '../../node_modules/next'), join(root, 'node_modules/next'))
    await write('node_modules/.bin/next', '#!/bin/sh\n')
    await chmod(join(root, 'node_modules/.bin/next'), 0o755)
    const result = spawnSync(process.execPath, [CLI_ENTRY, 'prepare', '--production'], {
      cwd: root, timeout: 60_000, killSignal: 'SIGKILL', encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NEXTSPARK_AUTH_RUNTIME_ONLY: 'email,google' },
    })
    return { status: result.status, output: `${result.stdout}${result.stderr}`, registry: existsSync(join(root, '.nextspark/registries/billing-registry.ts')) }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('prepare --production: no billing config, or a valid one, keeps building', async () => {
  for (const billing of [null, VALID]) {
    const { status, output, registry } = await prepareWith(billing)
    assert.equal(status, 0, output)
    assert.ok(registry, 'no billing registry written')
  }
})

test('prepare --production: a billing config that exists but throws fails with its file name and the cause', async () => {
  const { status, output, registry } = await prepareWith(`throw new Error('stripe price id is missing')\n`)
  assert.notEqual(status, 0, output)
  assert.match(output, /config[\\/]billing\.config\.ts: stripe price id is missing/)
  assert.equal(registry, false)
})

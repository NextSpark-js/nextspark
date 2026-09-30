import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readGeneration } from '../generation.mjs'
import { DETERMINISTIC_BUILD_TIME, checkHost, prepareHost, projectHostConfig } from '../prepare.mjs'
import { loadFixtureCoreRoutes } from '../../../../../tests/fixtures/host-conformance/plan.mjs'
import { PAGE, ROUTE, read, snapshot, write } from './host-helpers.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const PREPARE_CLI = join(CORE_ROOT, 'scripts/build/registry/host/prepare-cli.mjs')

function project() {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-host-project-'))
  write(root, 'nextspark.config.ts', 'export default { plugins: [] }\n')
  write(root, 'package.json', JSON.stringify({ name: 'host-project', dependencies: { next: '16.3.5' } }))
  write(root, 'templates/pricing/page.tsx', PAGE('Pricing'))
  write(root, 'api/ping/route.ts', ROUTE)
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

test('a real project: the registry build is staged and published with the host, deterministically, and nothing else lands in src/app', { timeout: 180_000 }, async () => {
  const { root, cleanup } = project()
  try {
    // The installed core ships no route manifest yet (stage 2): the fake core's routes stand in.
    const config = { ...projectHostConfig({ projectRoot: root }), loadCoreRoutes: loadFixtureCoreRoutes }
    const first = await prepareHost(config)
    const app = first.files.filter(file => file.path.startsWith('src/app/')).map(file => file.path)
    assert.deepEqual(app, ['src/app/(shell)/layout.tsx', 'src/app/(shell)/shell/page.tsx', 'src/app/about/page.tsx', 'src/app/api/ping/route.ts', 'src/app/error.tsx', 'src/app/global-error.tsx', 'src/app/layout.tsx', 'src/app/page.tsx', 'src/app/pricing/page.tsx'])
    const registries = first.files.filter(file => file.path.startsWith('.nextspark/registries/'))
    assert.ok(registries.some(file => file.path === '.nextspark/registries/index.ts'), 'the registry build output is published')
    assert.ok(registries.every(file => !/Generated at: (?!1970)/.test(file.content)), `registries carry ${DETERMINISTIC_BUILD_TIME}, not the build time`)

    // The registry build wrote nothing of its own into src/app (no (templates) pages, no globals.css) and left no staging behind
    assert.deepEqual(readdirSync(join(root, 'src/app')).sort(), ['(shell)', 'about', 'api', 'error.tsx', 'global-error.tsx', 'layout.tsx', 'page.tsx', 'pricing'])
    // The portable contracts (#203 stage 7b) live beside the registries, in their own directory
    assert.deepEqual(readdirSync(join(root, '.nextspark')).sort(), ['contracts', 'generation.json', 'registries'])

    const record = readGeneration(root)
    assert.equal(Object.keys(record.files).length, first.files.length)
    assert.ok(record.versions.core && record.versions.next === '16.3.5')
    assert.ok(record.inputs.files['nextspark.config.ts'] && record.inputs.files['templates/pricing/page.tsx'])
    assert.deepEqual(await checkHost(config), { ok: true, problems: [] })

    // The same sources give the same bytes: a second run rewrites nothing
    const before = snapshot(root)
    const second = await prepareHost(config)
    assert.deepEqual(second.written, [])
    assert.equal(second.unchanged, first.files.length)
    const after = snapshot(root)
    delete before['.nextspark/generation.json']
    delete after['.nextspark/generation.json']
    assert.deepEqual(after, before)

    // A config change makes the registries' inputs stale
    write(root, 'nextspark.config.ts', 'export default { plugins: [], features: { billing: false } }\n')
    const stale = await checkHost(config)
    assert.deepEqual(stale.problems.map(p => `${p.state} ${p.path}`), ['stale nextspark.config.ts'])

    // What the registry build reads from tests/ and docs/ is an input; what it never reads is not
    await prepareHost(config)
    write(root, 'tests/cypress/e2e/pricing.cy.ts', "describe('pricing', { tags: ['@feat-pricing'] }, () => {})\n")
    write(root, 'docs/public/01-start/01-intro.md', '# Intro\n')
    write(root, 'emails/welcome.tsx', 'export default function Welcome() { return null }\n')
    write(root, 'tests/cypress/videos/run.mp4', 'video')
    write(root, 'tests/cypress/fixtures/extra.json', '{}')
    write(root, 'docs/internal/notes.md', '# not read by the registry build\n')
    const inputs = await checkHost(config)
    assert.deepEqual(inputs.problems.map(p => `${p.state} ${p.path}`), [
      'stale docs/public/01-start/01-intro.md',
      'stale emails/welcome.tsx',
      'stale tests/cypress/e2e/pricing.cy.ts',
    ])
  } finally {
    cleanup()
  }
})

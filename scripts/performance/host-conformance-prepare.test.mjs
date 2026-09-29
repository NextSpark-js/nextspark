import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The conformance fixture's generated host comes from the production generator
 * (`nextspark prepare`'s pipeline). Fast part: prepare the fixture's source into a fresh host
 * and check it plans exactly the routes of the hand-written reference, and that --check agrees.
 * Full part (HOST_CONFORMANCE_FULL=1, eight production builds, a few minutes): run the whole
 * conformance script, which regenerates the fixture host with that generator, and require exit 0.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE = join(REPO_ROOT, 'packages/core/tests/fixtures/host-conformance')
const { fixtureHostConfig } = await import(join(FIXTURE, 'plan.mjs'))
const { checkHost, prepareHost } = await import(join(REPO_ROOT, 'packages/core/scripts/build/registry/host/prepare.mjs'))

function files(root) {
  return readdirSync(root, { recursive: true })
    .filter(path => statSync(join(root, path)).isFile())
    .map(path => relative(root, join(root, path)).split(sep).join('/'))
    .sort()
}

test('the production generator prepares the fixture source into exactly the routes of the hand-written host', async () => {
  const hostRoot = mkdtempSync(join(tmpdir(), 'nextspark-conformance-host-'))
  try {
    const config = fixtureHostConfig({ hostRoot })
    const result = await prepareHost(config, { mode: 'production' })
    assert.deepEqual(files(join(hostRoot, 'src/app')), files(join(FIXTURE, 'manual/src/app')))
    assert.deepEqual(files(join(hostRoot, '.nextspark/registries')), files(join(FIXTURE, 'manual/registries')))
    assert.equal(result.written.length, result.files.length)
    assert.deepEqual(await checkHost(config), { ok: true, problems: [] })
  } finally {
    rmSync(hostRoot, { recursive: true, force: true })
  }
})

test('the conformance script passes against the production generator', { skip: process.env.HOST_CONFORMANCE_FULL !== '1' && 'set HOST_CONFORMANCE_FULL=1 (eight production builds)', timeout: 3_600_000 }, () => {
  const report = join(mkdtempSync(join(tmpdir(), 'nextspark-conformance-report-')), 'host-conformance.md')
  const run = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/performance/host-conformance.mjs'), '--report', report], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  assert.equal(run.status, 0, `${run.stdout.slice(-4000)}\n${run.stderr.slice(-4000)}\nreport: ${report}`)
  assert.match(run.stderr, / 0 differences, 0 failed builds/)
})

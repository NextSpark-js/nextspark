import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

/**
 * `build` and `registry:build` used to only drain stderr from the registry
 * build they spawn with `stdio: 'pipe'`. A child that writes enough to stdout
 * fills the OS pipe, and since nothing ever reads it, the child's next write
 * waits forever on a `drain` that never comes and the command hangs; these
 * tests run the built CLI as a real subprocess, bounded by `spawnSync`'s own
 * `timeout`, so a hang here fails the test instead of the test run.
 */

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI_ENTRY = join(PKG_ROOT, 'dist/cli.js')

before(() => {
  execFileSync('pnpm', ['run', 'build'], { cwd: PKG_ROOT, stdio: 'ignore' })
})

const CAUSE = '❌ Build failed: could not read contents/themes/acme/templates/shop/page.tsx'

/**
 * A project with a stand-in for core whose registry build writes `megabytes`
 * MB to stdout - respecting backpressure, the way core's own build does by
 * awaiting each write - then reports CAUSE and exits with `code`. A build that
 * ignores backpressure could lose CAUSE to `process.exit()` truncating
 * whatever a pipe hadn't taken yet, which would make this fixture unreliable
 * for either side of the fix; waiting for `drain` avoids that, and is also
 * what makes an undrained pipe on the reader's side hang the writer for real.
 */
async function projectWithBigBuild(megabytes: number, code: number) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-hang-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `import { once } from 'node:events'
async function writeAll(text) {
  if (!process.stdout.write(text)) await once(process.stdout, 'drain')
}
const chunk = 'x'.repeat(200) + '\\n'
let written = 0
while (written < ${megabytes} * 1024 * 1024) {
  await writeAll(chunk)
  written += chunk.length
}
await writeAll(${JSON.stringify(CAUSE)} + '\\n')
process.exitCode = ${code}
`
  )
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * Runs the built CLI for a project, bounded so a hang fails the run instead of
 * blocking it. What it reads is bounded far above the megabytes the stand-in
 * build prints: a run over spawnSync's own 1 MiB is killed as if it hung.
 */
function runCli(root: string, args: string[], timeoutMs = 10_000) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: root,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

test('registry:build finishes on its own with a big registry build, and shows the cause when it prints it only over stdout', { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
  const ok = await projectWithBigBuild(3, 0)
  const failed = await projectWithBigBuild(3, 1)
  try {
    const okRun = runCli(ok.root, ['registry:build'])
    assert.equal(okRun.signal, null, `must finish on its own instead of being killed after a timeout (stdout so far: ${okRun.stdout?.length ?? 0} bytes)`)
    assert.equal(okRun.status, 0)

    const failedRun = runCli(failed.root, ['registry:build'])
    assert.equal(failedRun.signal, null, 'must finish on its own even when the registry build fails')
    assert.notEqual(failedRun.status, 0)
    assert.ok(failedRun.stdout.includes(CAUSE) || failedRun.stderr.includes(CAUSE),
      `the cause core printed over stdout must reach the user:\nstdout:\n${failedRun.stdout}\nstderr:\n${failedRun.stderr}`)
  } finally {
    await ok.cleanup()
    await failed.cleanup()
  }
})

test('build finishes on its own and shows the cause when a big registry build fails over stdout', { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
  const failed = await projectWithBigBuild(3, 1)
  try {
    const run = runCli(failed.root, ['build'])
    assert.equal(run.signal, null, `must finish on its own instead of being killed after a timeout (stdout so far: ${run.stdout?.length ?? 0} bytes)`)
    assert.notEqual(run.status, 0)
    assert.ok(run.stdout.includes(CAUSE) || run.stderr.includes(CAUSE),
      `the cause core printed over stdout must reach the user:\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
  } finally {
    await failed.cleanup()
  }
})

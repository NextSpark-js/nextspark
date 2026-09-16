import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

/**
 * `build` never listened on its registry build child's stdout at all, so once
 * the OS pipe filled, the child's next write waited on a `drain` that could
 * never come and the command hung. `registry:build` did read stdout, so it
 * never hung, but kept it apart from stderr and discarded that buffer on
 * failure, so a cause core printed only to stdout never reached the user.
 * These tests run the built CLI as a real subprocess against a child that
 * writes several MB before it fails, bounded by `spawnSync`'s own `timeout`,
 * so a hang here fails the test instead of the test run.
 */

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI_ENTRY = join(PKG_ROOT, 'dist/cli.js')

before(() => {
  execFileSync('pnpm', ['run', 'build'], { cwd: PKG_ROOT, stdio: 'ignore' })
})

const CAUSE = '❌ Build failed: could not read contents/themes/acme/templates/shop/page.tsx'

/**
 * A project with a stand-in for core whose registry build writes `megabytes`
 * MB to stdout, waiting on `drain` after any write the OS pipe doesn't take
 * immediately, then reports CAUSE and exits with `code`. core itself never
 * checks a write's return value or waits on `drain` - it just calls
 * console.log/console.error - so this is stricter than core, not a copy of
 * it: without waiting, `process.exit()` could race ahead of the OS pipe and
 * truncate whatever it hadn't taken yet, losing CAUSE and making this
 * fixture unreliable for either side of the fix. Waiting for `drain` is also
 * what lets an undrained pipe on the reader's side hang the writer for real.
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

/**
 * Runs the built CLI under a V8 heap capped at `maxOldSpaceMb`, so a command
 * that keeps a child's whole output in memory runs out of heap and aborts
 * instead of finishing - the same failure mode `/usr/bin/time -l` measured as
 * hundreds of MB of RSS for a build the size these tests use.
 */
function runCliBoundedHeap(root: string, args: string[], maxOldSpaceMb: number, timeoutMs = 20_000) {
  return spawnSync(process.execPath, [`--max-old-space-size=${maxOldSpaceMb}`, CLI_ENTRY, ...args], {
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

/**
 * Both commands used to keep a failing registry build's entire output in one
 * growing string, so a heap capped well under what 64 MB of it needs - the
 * same order of magnitude a run with `/usr/bin/time -l` showed hundreds of MB
 * of RSS for - crashed the process with "FATAL ERROR: Reached heap limit"
 * instead of reporting the failure. Both must now finish inside that cap.
 */
test('registry:build and build keep memory bounded with a large failing registry build', { skip: process.platform === 'win32', timeout: 40_000 }, async () => {
  const failed = await projectWithBigBuild(64, 1)
  try {
    const registryRun = runCliBoundedHeap(failed.root, ['registry:build'], 64)
    assert.equal(registryRun.signal, null, `must not be killed (stderr: ${registryRun.stderr})`)
    assert.ok(!/FATAL ERROR/.test(registryRun.stderr), `must not run out of heap:\n${registryRun.stderr}`)
    assert.notEqual(registryRun.status, 0)
    assert.ok(registryRun.stdout.includes(CAUSE) || registryRun.stderr.includes(CAUSE),
      `the cause must still reach the user:\nstdout:\n${registryRun.stdout}\nstderr:\n${registryRun.stderr}`)

    const buildRun = runCliBoundedHeap(failed.root, ['build'], 64)
    assert.equal(buildRun.signal, null, `must not be killed (stderr: ${buildRun.stderr})`)
    assert.ok(!/FATAL ERROR/.test(buildRun.stderr), `must not run out of heap:\n${buildRun.stderr}`)
    assert.notEqual(buildRun.status, 0)
    assert.ok(buildRun.stdout.includes(CAUSE) || buildRun.stderr.includes(CAUSE),
      `the cause must still reach the user:\nstdout:\n${buildRun.stdout}\nstderr:\n${buildRun.stderr}`)
  } finally {
    await failed.cleanup()
  }
})

/**
 * registry:build used to also reprint a successful build's entire output, so
 * this crashed the same way under a capped heap, and, uncapped, would write
 * everything core printed - 64 MB of it here - to the terminal.
 */
test('registry:build keeps memory bounded and does not dump a large successful registry build whole', { skip: process.platform === 'win32', timeout: 40_000 }, async () => {
  const megabytes = 64
  const ok = await projectWithBigBuild(megabytes, 0)
  try {
    const run = runCliBoundedHeap(ok.root, ['registry:build'], 64)
    assert.equal(run.signal, null, `must not be killed (stderr: ${run.stderr})`)
    assert.ok(!/FATAL ERROR/.test(run.stderr), `must not run out of heap:\n${run.stderr}`)
    assert.equal(run.status, 0)
    assert.ok(run.stdout.length < (megabytes * 1024 * 1024) / 4,
      `a successful build must not print everything core wrote (printed ${run.stdout.length} bytes of ${megabytes} MB)`)
  } finally {
    await ok.cleanup()
  }
})

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

/**
 * `build` and `registry:build` both read a registry build child's stdout and
 * stderr as it arrives, so neither hangs waiting on a `drain` the child never
 * gets, and both read the two streams together, in the order they arrive, so
 * a cause core prints only to stdout still reaches the user. These tests run
 * the built CLI as a real subprocess against a child that writes several MB
 * before it fails, bounded by `spawnSync`'s own `timeout`, so a hang here
 * fails the test instead of the test run.
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
 * fixture unreliable. Waiting for `drain` is also what lets an undrained pipe
 * on the reader's side hang the writer for real.
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
 * Both commands cap the memory a registry build's output holds well under
 * what 64 MB of it would need, so a heap capped there - the same order of
 * magnitude a run with `/usr/bin/time -l` showed hundreds of MB of RSS for a
 * build that kept its whole output - finishes instead of crashing with
 * "FATAL ERROR: Reached heap limit".
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
 * A successful build's own progress isn't kept, so registry:build neither
 * runs out of heap holding it nor writes everything core printed - 64 MB of
 * it here - to the terminal.
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

/**
 * A project with a stand-in for core whose registry build writes CAUSE first
 * - over stdout, over stderr, or over both, waiting on `drain` each time -
 * then `megabytes` MB of unrelated filler before it exits with `code`. A
 * buffer that only keeps a tail loses a cause that arrived before the filler
 * that pushes it out; keeping it has to come from capturing it as it
 * arrives, not from where in the output it ends up sitting.
 */
async function projectWithEarlyCause(megabytes: number, code: number, streams: 'stdout' | 'stderr' | 'both') {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-early-cause-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  const causeWrites = [
    ...(streams === 'stdout' || streams === 'both' ? ['await writeAll(process.stdout, CAUSE)'] : []),
    ...(streams === 'stderr' || streams === 'both' ? ['await writeAll(process.stderr, CAUSE)'] : []),
  ]
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `import { once } from 'node:events'
async function writeAll(stream, text) {
  if (!stream.write(text)) await once(stream, 'drain')
}
const CAUSE = ${JSON.stringify(CAUSE)} + '\\n'
${causeWrites.join('\n')}
const chunk = 'x'.repeat(200) + '\\n'
let written = 0
while (written < ${megabytes} * 1024 * 1024) {
  await writeAll(process.stdout, chunk)
  written += chunk.length
}
process.exitCode = ${code}
`
  )
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

for (const streams of ['stdout', 'stderr', 'both'] as const) {
  test(`registry:build shows a cause printed over ${streams} before megabytes of unrelated output follow it`, { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
    const early = await projectWithEarlyCause(3, 1, streams)
    try {
      const run = runCli(early.root, ['registry:build'])
      assert.equal(run.signal, null, `must finish on its own (stdout so far: ${run.stdout?.length ?? 0} bytes)`)
      assert.notEqual(run.status, 0)
      assert.ok(run.stdout.includes(CAUSE) || run.stderr.includes(CAUSE),
        `an early cause must not be pushed out by the megabytes that follow it:\nstdout:\n${run.stdout.slice(0, 1000)}\nstderr:\n${run.stderr.slice(0, 1000)}`)
    } finally {
      await early.cleanup()
    }
  })

  test(`build shows a cause printed over ${streams} before megabytes of unrelated output follow it`, { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
    const early = await projectWithEarlyCause(3, 1, streams)
    try {
      const run = runCli(early.root, ['build'])
      assert.equal(run.signal, null, `must finish on its own (stdout so far: ${run.stdout?.length ?? 0} bytes)`)
      assert.notEqual(run.status, 0)
      assert.ok(run.stdout.includes(CAUSE) || run.stderr.includes(CAUSE),
        `an early cause must not be pushed out by the megabytes that follow it:\nstdout:\n${run.stdout.slice(0, 1000)}\nstderr:\n${run.stderr.slice(0, 1000)}`)
    } finally {
      await early.cleanup()
    }
  })
}

const WARNING = '⚠️ app/(templates): backed up app/(templates)/shop/page.tsx to .nextspark/backups/t0/app/(templates)/shop/page.tsx'

/** A project with a stand-in for core whose registry build writes WARNING, then `megabytes` MB of filler, then exits 0. */
async function projectWithEarlyWarning(megabytes: number) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-early-warning-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `import { once } from 'node:events'
async function writeAll(text) {
  if (!process.stdout.write(text)) await once(process.stdout, 'drain')
}
await writeAll(${JSON.stringify(WARNING)} + '\\n')
const chunk = 'x'.repeat(200) + '\\n'
let written = 0
while (written < ${megabytes} * 1024 * 1024) {
  await writeAll(chunk)
  written += chunk.length
}
process.exitCode = 0
`
  )
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('registry:build keeps an early warning visible after megabytes of a successful build', { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
  const early = await projectWithEarlyWarning(3)
  try {
    const run = runCli(early.root, ['registry:build'])
    assert.equal(run.signal, null, `must finish on its own (stdout so far: ${run.stdout?.length ?? 0} bytes)`)
    assert.equal(run.status, 0)
    assert.ok(run.stdout.includes(WARNING),
      `an early warning must not be pushed out by the progress that follows it:\n${run.stdout.slice(0, 1000)}`)
  } finally {
    await early.cleanup()
  }
})

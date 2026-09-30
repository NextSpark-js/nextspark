import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'

/**
 * `prepare`, `build` and `registry:build` read the host preparation child's stdout and
 * stderr as it arrives, so none of them hangs waiting on a `drain` the child never gets, and
 * all of them read the two streams together, in the order they arrive, so a cause core prints
 * only to stdout still reaches the user, in bounded memory. These tests run the built CLI as a
 * real subprocess against a stand-in for core's host preparation, bounded by `spawnSync`'s own
 * `timeout`, so a hang here fails the test instead of the test run.
 */

/** Core's check of where the preparation writes, which `build` loads from core before its first step. */
const CORE_SOURCE = join(dirname(fileURLToPath(import.meta.url)), '../../core')
const CORE_WRITE_CHECK = [
  'scripts/build/registry/write-places.mjs',
  'scripts/build/registry/project-mode.mjs',
  'scripts/build/registry/post-build/own-gitignores.mjs',
  'scripts/build/safe-fs.mjs',
]

let CLI_ENTRY: string

before(() => {
  CLI_ENTRY = buildCli()
})

const CAUSE = '❌ Build failed: could not read templates/shop/page.tsx'

/**
 * What the stand-in registry build has in scope. core itself never checks a
 * write's return value or waits on `drain` - it just calls
 * console.log/console.error - so `writeAll` is stricter than core, not a copy
 * of it: without waiting, `process.exit()` could race ahead of the OS pipe and
 * truncate whatever it hadn't taken yet, losing the very line a test looks
 * for. Waiting for `drain` is also what lets an undrained pipe on the reader's
 * side hang the writer for real.
 */
const PRELUDE = `import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'
async function writeAll(stream, data) {
  if (!stream.write(data)) await once(stream, 'drain')
}
async function writeRepeated(stream, piece, megabytes) {
  const batch = piece.repeat(Math.max(1, Math.floor(65536 / piece.length)))
  let written = 0
  while (written < megabytes * 1024 * 1024) {
    await writeAll(stream, batch)
    written += batch.length
  }
}
async function writeByteByByte(stream, text) {
  for (const byte of Buffer.from(text, 'utf8')) {
    await writeAll(stream, Buffer.from([byte]))
    await sleep(10)
  }
}
`

/**
 * A project with a stand-in for core (it decides this is a host) whose host preparation runs `script`
 * after PRELUDE, with core's own write check, and a stand-in `next` that exits 0, so `build` finishes
 * without Next.js once the preparation succeeds.
 */
async function projectWithPreparation(script: string) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-output-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build/registry/host'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(join(coreDir, 'scripts/build/registry/host/prepare-cli.mjs'), `${PRELUDE}\n${script}\n`)
  await writeFile(join(coreDir, 'scripts/build/registry/host/mode.mjs'), "export function resolveHostMode() { return { mode: 'host', reason: 'generated' } }\n")
  // A passing auth readiness check: its behavior is covered by auth-readiness-preflight.test.ts
  await writeFile(join(coreDir, 'scripts/build/auth-readiness.mjs'), '')
  for (const file of CORE_WRITE_CHECK) {
    await mkdir(dirname(join(coreDir, file)), { recursive: true })
    await copyFile(join(CORE_SOURCE, file), join(coreDir, file))
  }
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
  await writeFile(join(root, 'node_modules/.bin/next'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/** A stand-in preparation that prints CAUSE first, then `megabytes` MB of 200-character lines, and exits with `code`. */
function bigPreparation(megabytes: number, code: number): string {
  return `await writeAll(process.stdout, ${JSON.stringify(CAUSE)} + '\\n')
await writeRepeated(process.stdout, 'x'.repeat(200) + '\\n', ${megabytes})
process.exitCode = ${code}`
}

/**
 * Runs the built CLI for a project, bounded so a hang fails the run instead of
 * blocking it. What it reads is bounded far above what the CLI prints: a run
 * over spawnSync's own 1 MiB is killed as if it hung. With `maxOldSpaceMb`,
 * the CLI runs under a V8 heap capped there, so a command that keeps what a
 * child prints in memory aborts with "FATAL ERROR: Reached heap limit"
 * instead of finishing.
 */
function runCli(root: string, args: string[], { timeoutMs = 20_000, maxOldSpaceMb }: { timeoutMs?: number; maxOldSpaceMb?: number } = {}) {
  const heap = maxOldSpaceMb === undefined ? [] : [`--max-old-space-size=${maxOldSpaceMb}`]
  return spawnSync(process.execPath, [...heap, CLI_ENTRY, ...args], {
    cwd: root,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

type Run = ReturnType<typeof runCli>

/** A run that finished on its own, within its heap, with the exit status `failed` asks for. */
function assertFinished(run: Run, command: string, failed: boolean): void {
  assert.equal(run.signal, null, `${command} must finish on its own (stdout so far: ${run.stdout?.length ?? 0} bytes, stderr: ${run.stderr?.slice(0, 2000)})`)
  assert.ok(!/FATAL ERROR/.test(run.stderr), `${command} must not run out of heap:\n${run.stderr.slice(0, 2000)}`)
  if (failed) assert.notEqual(run.status, 0, `${command} must fail`)
  else assert.equal(run.status, 0, `${command} must succeed:\n${run.stderr.slice(0, 2000)}`)
}

/** The lines a run printed, stdout's and then stderr's. */
function printedLines(run: Run): string[] {
  return [...run.stdout.split('\n'), ...run.stderr.split('\n')]
}

function excerpt(run: Run): string {
  return `stdout:\n${run.stdout.slice(0, 3000)}\nstderr:\n${run.stderr.slice(0, 3000)}`
}

const COMMANDS = ['prepare', 'registry:build', 'build'] as const

for (const command of COMMANDS) {
  test(`${command} finishes on its own with a big preparation, and shows the cause it printed first`, { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
    const ok = await projectWithPreparation(bigPreparation(3, 0))
    const failed = await projectWithPreparation(bigPreparation(3, 1))
    try {
      assertFinished(runCli(ok.root, [command]), command, false)
      const failedRun = runCli(failed.root, [command])
      assertFinished(failedRun, command, true)
      assert.ok(printedLines(failedRun).includes(CAUSE), `the cause core printed over stdout must reach the user:\n${excerpt(failedRun)}`)
    } finally {
      await ok.cleanup()
      await failed.cleanup()
    }
  })

  /**
   * The runner keeps the first lines a preparation prints and counts the rest, so a heap capped at
   * 64 MB finishes with 64 MB of output instead of crashing with "FATAL ERROR: Reached heap limit",
   * and the terminal gets a bounded part of it.
   */
  test(`${command} keeps memory bounded and prints little with 64 MB of output, failing or not`, { skip: process.platform === 'win32', timeout: 90_000 }, async () => {
    const failed = await projectWithPreparation(bigPreparation(64, 1))
    const ok = await projectWithPreparation(bigPreparation(64, 0))
    try {
      for (const [project, fails] of [[failed, true], [ok, false]] as const) {
        const run = runCli(project.root, [command], { maxOldSpaceMb: 64, timeoutMs: 40_000 })
        assertFinished(run, command, fails)
        assert.ok(run.stdout.length + run.stderr.length < 256 * 1024,
          `${command} must print a bounded part of it (printed ${run.stdout.length + run.stderr.length} bytes of 64 MB)`)
        if (fails) assert.ok(printedLines(run).includes(CAUSE), `${command} must still show the cause:\n${excerpt(run)}`)
      }
    } finally {
      await failed.cleanup()
      await ok.cleanup()
    }
  })

  test(`${command} shows a line whole when the preparation writes é, 😀 and ⚠️ a byte at a time`, { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
    const line = '⚠️ src/app: café 😀'
    const failed = await projectWithPreparation(`await writeByteByByte(process.stderr, ${JSON.stringify(line)} + '\\n')
process.exitCode = 1`)
    try {
      const run = runCli(failed.root, [command])
      assertFinished(run, command, true)
      assert.ok(printedLines(run).includes(line), `${command} must show the line whole:\n${excerpt(run)}`)
    } finally {
      await failed.cleanup()
    }
  })
}

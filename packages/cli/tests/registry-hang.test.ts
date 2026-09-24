import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'

/**
 * `build` and `registry:build` both read a registry build child's stdout and
 * stderr as it arrives, so neither hangs waiting on a `drain` the child never
 * gets, and both read the two streams together, in the order they arrive, so
 * a cause core prints only to stdout still reaches the user. These tests run
 * the built CLI as a real subprocess against a stand-in for core, bounded by
 * `spawnSync`'s own `timeout`, so a hang here fails the test instead of the
 * test run.
 */

/** Core's check of where its registry build writes, which `build` loads from core before its first step. */
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
const WARNING = '⚠️ src/app/(templates): backed up src/app/(templates)/shop/page.tsx to .nextspark/backups/t0/src/app/(templates)/shop/page.tsx'

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
 * A project with a stand-in for core whose registry build runs `script` after
 * PRELUDE, with core's own write check, and a stand-in `next` that exits 0, so `build` finishes without
 * Next.js once the registry build succeeds.
 */
async function projectWithRegistryBuild(script: string) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-output-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(join(coreDir, 'scripts/build/registry.mjs'), `${PRELUDE}\n${script}\n`)
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

/** A stand-in registry build that writes `megabytes` MB of 200-character lines to stdout, then CAUSE, and exits with `code`. */
function bigBuild(megabytes: number, code: number): string {
  return `await writeRepeated(process.stdout, 'x'.repeat(200) + '\\n', ${megabytes})
await writeAll(process.stdout, ${JSON.stringify(CAUSE)} + '\\n')
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

const COMMANDS = ['registry:build', 'build'] as const

test('registry:build finishes on its own with a big registry build, and shows the cause when it prints it only over stdout', { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
  const ok = await projectWithRegistryBuild(bigBuild(3, 0))
  const failed = await projectWithRegistryBuild(bigBuild(3, 1))
  try {
    assertFinished(runCli(ok.root, ['registry:build']), 'registry:build', false)

    const failedRun = runCli(failed.root, ['registry:build'])
    assertFinished(failedRun, 'registry:build', true)
    assert.ok(printedLines(failedRun).includes(CAUSE), `the cause core printed over stdout must reach the user:\n${excerpt(failedRun)}`)
  } finally {
    await ok.cleanup()
    await failed.cleanup()
  }
})

test('build finishes on its own and shows the cause when a big registry build fails over stdout', { skip: process.platform === 'win32', timeout: 30_000 }, async () => {
  const failed = await projectWithRegistryBuild(bigBuild(3, 1))
  try {
    const run = runCli(failed.root, ['build'])
    assertFinished(run, 'build', true)
    assert.ok(printedLines(run).includes(CAUSE), `the cause core printed over stdout must reach the user:\n${excerpt(run)}`)
  } finally {
    await failed.cleanup()
  }
})

/**
 * Both commands cap the memory a registry build's output holds well under
 * what 64 MB of it would need, so a heap capped at 64 MB finishes instead of
 * crashing with "FATAL ERROR: Reached heap limit".
 */
test('registry:build and build keep memory bounded with a large failing registry build', { skip: process.platform === 'win32', timeout: 60_000 }, async () => {
  const failed = await projectWithRegistryBuild(bigBuild(64, 1))
  try {
    for (const command of COMMANDS) {
      const run = runCli(failed.root, [command], { maxOldSpaceMb: 64 })
      assertFinished(run, command, true)
      assert.ok(printedLines(run).includes(CAUSE), `${command} must still show the cause:\n${excerpt(run)}`)
    }
  } finally {
    await failed.cleanup()
  }
})

/**
 * A successful build's own progress isn't kept, so neither command runs out
 * of heap holding it or writes everything core printed - 64 MB of it here -
 * to the terminal.
 */
test('registry:build and build keep memory bounded and do not dump a large successful registry build whole', { skip: process.platform === 'win32', timeout: 60_000 }, async () => {
  const megabytes = 64
  const ok = await projectWithRegistryBuild(bigBuild(megabytes, 0))
  try {
    for (const command of COMMANDS) {
      const run = runCli(ok.root, [command], { maxOldSpaceMb: 64 })
      assertFinished(run, command, false)
      assert.ok(run.stdout.length + run.stderr.length < 64 * 1024,
        `${command} must not print what a successful build wrote (printed ${run.stdout.length + run.stderr.length} bytes of ${megabytes} MB)`)
    }
  } finally {
    await ok.cleanup()
  }
})

test('registry:build and build keep memory bounded, and print little, when every line of a large registry build is an error or a warning', { skip: process.platform === 'win32', timeout: 90_000 }, async () => {
  const pair = `${'❌ Failed to parse block "hero": '.padEnd(200, 'x')}\\n${'⚠️ Coverage: flow checkout has no tests '.padEnd(200, 'x')}\\n`
  const failed = await projectWithRegistryBuild(`await writeRepeated(process.stdout, '${pair}', 64)
process.exitCode = 1`)
  const ok = await projectWithRegistryBuild(`await writeRepeated(process.stdout, '${pair}', 64)
process.exitCode = 0`)
  try {
    for (const command of COMMANDS) {
      for (const [project, fails] of [[failed, true], [ok, false]] as const) {
        const run = runCli(project.root, [command], { maxOldSpaceMb: 64, timeoutMs: 40_000 })
        assertFinished(run, command, fails)
        assert.ok(run.stdout.length + run.stderr.length < 64 * 1024,
          `${command} must print a bounded part of it (printed ${run.stdout.length + run.stderr.length} bytes)`)
      }
    }
  } finally {
    await failed.cleanup()
    await ok.cleanup()
  }
})

type Command = (typeof COMMANDS)[number]

/** Registers `body` as a test of its own for each command, named by the command followed by `name`. */
function testEachCommand(name: string, timeout: number, body: (command: Command) => Promise<void>): void {
  for (const command of COMMANDS) {
    test(`${command} ${name}`, { skip: process.platform === 'win32', timeout }, () => body(command))
  }
}

/**
 * Empty lines are lines like any other to the caps on what is kept, and a
 * line that never ends keeps only its start, so neither fills the heap.
 */
testEachCommand('keeps memory bounded when a registry build prints megabytes of empty lines on both streams', 60_000, async (command) => {
  const failed = await projectWithRegistryBuild(`await Promise.all([writeRepeated(process.stdout, '\\n', 8), writeRepeated(process.stderr, '\\n', 8)])
await writeAll(process.stdout, ${JSON.stringify(CAUSE)} + '\\n')
process.exitCode = 1`)
  try {
    const run = runCli(failed.root, [command], { maxOldSpaceMb: 64, timeoutMs: 40_000 })
    assertFinished(run, command, true)
    assert.ok(printedLines(run).includes(CAUSE), `${command} must still show the cause:\n${excerpt(run)}`)
  } finally {
    await failed.cleanup()
  }
})

testEachCommand('keeps memory bounded when a registry build prints 128 MB with no line break on each stream', 60_000, async (command) => {
  const megabytes = 128
  const failed = await projectWithRegistryBuild(`await Promise.all([writeRepeated(process.stdout, 'y', ${megabytes}), writeRepeated(process.stderr, 'y', ${megabytes})])
process.exitCode = 1`)
  try {
    const run = runCli(failed.root, [command], { maxOldSpaceMb: 64, timeoutMs: 50_000 })
    assertFinished(run, command, true)
    const cut = printedLines(run).filter((line) => line.endsWith(`… (${megabytes * 1024 * 1024 - 4096} more byte(s) on this line)`))
    assert.equal(cut.length, 2, `${command} must show the start of each stream's line, with every byte it left out counted:\n${excerpt(run)}`)
  } finally {
    await failed.cleanup()
  }
})

/**
 * A stand-in registry build that prints CAUSE first - over stdout, over
 * stderr, or over both - then `megabytes` MB of unrelated filler before it
 * exits with `code`. Keeping CAUSE has to come from capturing it as it
 * arrives, not from where in the output it ends up sitting.
 */
function earlyCause(megabytes: number, code: number, streams: 'stdout' | 'stderr' | 'both'): string {
  const causeWrites = [
    ...(streams === 'stdout' || streams === 'both' ? ['await writeAll(process.stdout, CAUSE)'] : []),
    ...(streams === 'stderr' || streams === 'both' ? ['await writeAll(process.stderr, CAUSE)'] : []),
  ]
  return `const CAUSE = ${JSON.stringify(CAUSE)} + '\\n'
${causeWrites.join('\n')}
await writeRepeated(process.stdout, 'x'.repeat(200) + '\\n', ${megabytes})
process.exitCode = ${code}`
}

for (const streams of ['stdout', 'stderr', 'both'] as const) {
  testEachCommand(`shows a cause printed over ${streams} before megabytes of unrelated output follow it`, 30_000, async (command) => {
    const early = await projectWithRegistryBuild(earlyCause(3, 1, streams))
    try {
      const run = runCli(early.root, [command])
      assertFinished(run, command, true)
      assert.ok(printedLines(run).includes(CAUSE), `an early cause must not be pushed out by the megabytes that follow it:\n${excerpt(run)}`)
    } finally {
      await early.cleanup()
    }
  })
}

/** A stand-in registry build that prints 500 lines of progress, enough to fill any first lines kept, then `script`. */
function afterProgress(script: string): string {
  return `for (let index = 0; index < 500; index++) await writeAll(process.stdout, '🔍 Discovered plugin-' + index + '\\n')
${script}`
}

testEachCommand('shows a cause printed after the first lines, however many warnings follow it', 30_000, async (command) => {
  const failed = await projectWithRegistryBuild(afterProgress(`await writeAll(process.stdout, ${JSON.stringify(CAUSE)} + '\\n')
for (let index = 0; index < 2000; index++) await writeAll(process.stdout, ${JSON.stringify(WARNING)} + '\\n')
process.exitCode = 1`))
  try {
    const run = runCli(failed.root, [command])
    assertFinished(run, command, true)
    assert.ok(printedLines(run).includes(CAUSE), `${command} must show the cause that 2000 warnings followed:\n${excerpt(run)}`)
  } finally {
    await failed.cleanup()
  }
})

const HEADING = 'Error: could not read templates/shop/page.tsx'
const FRAMES = Array.from({ length: 5 }, (_, index) => `    at step${index} (file:///core/scripts/build/registry.mjs:${index + 10}:5)`)

testEachCommand('shows an error heading with the stack lines under it, printed before megabytes of output', 30_000, async (command) => {
  const failed = await projectWithRegistryBuild(afterProgress(`for (const line of ${JSON.stringify([HEADING, ...FRAMES])}) await writeAll(process.stderr, line + '\\n')
await writeRepeated(process.stdout, 'x'.repeat(200) + '\\n', 3)
process.exitCode = 1`))
  try {
    const run = runCli(failed.root, [command])
    assertFinished(run, command, true)
    const lines = printedLines(run)
    const at = lines.indexOf(HEADING)
    assert.notEqual(at, -1, `${command} must show the error heading:\n${excerpt(run)}`)
    assert.deepEqual(lines.slice(at + 1, at + 1 + FRAMES.length), FRAMES, `${command} must show the stack under it:\n${excerpt(run)}`)
  } finally {
    await failed.cleanup()
  }
})

testEachCommand('shows a warning printed before megabytes of a successful build', 30_000, async (command) => {
  const early = await projectWithRegistryBuild(`await writeAll(process.stdout, ${JSON.stringify(WARNING)} + '\\n')
await writeRepeated(process.stdout, 'x'.repeat(200) + '\\n', 3)
process.exitCode = 0`)
  try {
    const run = runCli(early.root, [command])
    assertFinished(run, command, false)
    assert.ok(printedLines(run).includes(WARNING), `${command} must show the warning:\n${excerpt(run)}`)
  } finally {
    await early.cleanup()
  }
})

testEachCommand('shows a warning whole when the registry build writes é, 😀 and ⚠️ a byte at a time', 30_000, async (command) => {
  const warning = '⚠️ src/app/(templates): backed up café 😀'
  const ok = await projectWithRegistryBuild(`await writeByteByByte(process.stdout, ${JSON.stringify(warning)} + '\\n')
process.exitCode = 0`)
  try {
    const run = runCli(ok.root, [command])
    assertFinished(run, command, false)
    assert.ok(printedLines(run).includes(warning), `${command} must show the warning whole:\n${excerpt(run)}`)
  } finally {
    await ok.cleanup()
  }
})

testEachCommand('shows an error whole when the registry build writes é and 😀 a byte at a time', 30_000, async (command) => {
  const error = 'Error: café 😀'
  const failed = await projectWithRegistryBuild(`await writeByteByByte(process.stderr, ${JSON.stringify(error)} + '\\n')
process.exitCode = 1`)
  try {
    const run = runCli(failed.root, [command])
    assertFinished(run, command, true)
    assert.ok(printedLines(run).includes(error), `${command} must show the error whole:\n${excerpt(run)}`)
  } finally {
    await failed.cleanup()
  }
})

testEachCommand('shows the first few of the thousands of warnings a successful build prints, and none of its 🏗️ progress', 30_000, async (command) => {
  const backups = Array.from({ length: 2000 }, (_, index) => `⚠️ src/app/(templates): backed up src/app/(templates)/p${index}/page.tsx to .nextspark/backups/t0/src/app/(templates)/p${index}/page.tsx`)
  const ok = await projectWithRegistryBuild(`for (let index = 0; index < 200; index++) await writeAll(process.stdout, '🏗️  Generating registry ' + index + '...\\n')
for (const line of ${JSON.stringify(backups)}) await writeAll(process.stdout, line + '\\n')
process.exitCode = 0`)
  try {
    const run = runCli(ok.root, [command])
    assertFinished(run, command, false)
    const lines = printedLines(run)
    assert.deepEqual(lines.filter((line) => line.includes('backed up')), backups.slice(0, 5), `${command} must show the first warnings only:\n${excerpt(run)}`)
    const restBytes = backups.slice(5).reduce((sum, line) => sum + Buffer.byteLength(line, 'utf8'), 0)
    assert.ok(lines.includes(`... and 1995 more warning line(s), ${restBytes} byte(s)`), `${command} must count the warnings it left out:\n${excerpt(run)}`)
    assert.ok(!lines.some((line) => line.includes('Generating registry')), `${command} must not show progress:\n${excerpt(run)}`)
  } finally {
    await ok.cleanup()
  }
})

testEachCommand('accounts for every line and byte a failed registry build printed, shown or counted as omitted', 30_000, async (command) => {
  const lines = [
    ...Array.from({ length: 40 }, (_, index) => `L${index} ${'z'.repeat(100)}`),
    `L-long ${'y'.repeat(9993)}`,
    ...Array.from({ length: 40 }, (_, index) => `L${index + 40} ${'z'.repeat(100)}`),
    `L-last ${'w'.repeat(9993)}`,
  ]
  const printedBytes = lines.reduce((sum, line) => sum + Buffer.byteLength(line, 'utf8'), 0)
  const failed = await projectWithRegistryBuild(`for (const line of ${JSON.stringify(lines)}) await writeAll(process.stdout, line + '\\n')
process.exitCode = 1`)
  try {
    const run = runCli(failed.root, [command])
    assertFinished(run, command, true)

    let shownLines = 0
    let shownBytes = 0
    for (const line of printedLines(run)) {
      const omitted = /^\.\.\. (\d+) line\(s\), (\d+) byte\(s\) omitted$/.exec(line)
      const cut = /^(L.*)… \((\d+) more byte\(s\) on this line\)$/.exec(line)
      if (omitted) {
        shownLines += Number(omitted[1])
        shownBytes += Number(omitted[2])
      } else if (cut) {
        shownLines++
        shownBytes += Buffer.byteLength(cut[1], 'utf8') + Number(cut[2])
      } else if (line.startsWith('L')) {
        shownLines++
        shownBytes += Buffer.byteLength(line, 'utf8')
      }
    }
    assert.deepEqual({ lines: shownLines, bytes: shownBytes }, { lines: lines.length, bytes: printedBytes },
      `${command} must account for every line and byte the build printed:\n${excerpt(run)}`)
  } finally {
    await failed.cleanup()
  }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildFailureLines, captureOutput, registryBuildBlocker, runRegistryBuild, templatesTreeLines, type CapturedOutput } from '../src/utils/registry-build.js'

/** A project root and a fake core whose registry build prints its arguments and exits with `exitCode`. */
async function projectWithCore(exitCode: number) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-build-'))
  const coreDir = join(root, 'core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `console.log('building ' + process.env.NEXTSPARK_PROJECT_ROOT)\n` +
      `console.log('✅ app/(templates): 1 new, 0 updated, 0 removed')\n` +
      `console.error('something on stderr')\n` +
      `process.exit(${exitCode})\n`
  )
  const projectRoot = join(root, 'project')
  await mkdir(projectRoot)
  return { coreDir, projectRoot, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('the active theme can come from .env or from the environment', async () => {
  const { projectRoot, cleanup } = await projectWithCore(0)
  try {
    assert.match(registryBuildBlocker(projectRoot, {}) ?? '', /no \.env file/)
    assert.equal(registryBuildBlocker(projectRoot, { NEXT_PUBLIC_ACTIVE_THEME: 'default' }), null)

    await writeFile(join(projectRoot, '.env'), 'DATABASE_URL=postgres://x\n')
    assert.match(registryBuildBlocker(projectRoot, {}) ?? '', /not set in \.env/)

    await writeFile(join(projectRoot, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME="default"\n')
    assert.equal(registryBuildBlocker(projectRoot, {}), null)
  } finally {
    await cleanup()
  }
})

test('without an active theme the build is skipped, not run', async () => {
  const { coreDir, projectRoot, cleanup } = await projectWithCore(0)
  try {
    const result = await runRegistryBuild(coreDir, projectRoot, {})
    assert.equal(result.status, 'skipped')
    assert.match(result.reason ?? '', /NEXT_PUBLIC_ACTIVE_THEME/)
    assert.equal(result.output, '')
  } finally {
    await cleanup()
  }
})

test('the build runs for the project, and its exit code decides built or failed', async () => {
  const built = await projectWithCore(0)
  const failed = await projectWithCore(1)
  try {
    const env = { ...process.env, NEXT_PUBLIC_ACTIVE_THEME: 'default' }

    const ok = await runRegistryBuild(built.coreDir, built.projectRoot, env)
    assert.equal(ok.status, 'built')
    assert.match(ok.output, new RegExp(`building ${built.projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.match(ok.output, /something on stderr/)

    assert.equal((await runRegistryBuild(failed.coreDir, failed.projectRoot, env)).status, 'failed')
  } finally {
    await built.cleanup()
    await failed.cleanup()
  }
})

test('only the lines about app/(templates) are picked out of the output', () => {
  const output = '🔍 Discovering templates...\n✅ app/(templates): 1 new, 1 updated, 0 removed\n⚠️  app/(templates): backed up app/(templates)/x/layout.tsx to .nextspark/backups/t/app/(templates)/x/layout.tsx\n📊 Stats:\n'
  assert.deepEqual(templatesTreeLines(output), [
    '✅ app/(templates): 1 new, 1 updated, 0 removed',
    '⚠️  app/(templates): backed up app/(templates)/x/layout.tsx to .nextspark/backups/t/app/(templates)/x/layout.tsx',
  ])
})

test('the cause of a failure comes along when the files it touched push it out of the tail', () => {
  const cause = 'Error: contents/themes/acme/templates/shop/page.tsx has no default export'
  const touched = Array.from({ length: 15 }, (_, index) => `  affected: app/(templates)/page-${index}.tsx`)
  const lines = buildFailureLines(['Discovering template overrides...', cause, ...touched].join('\n'), 12)

  assert.deepEqual(lines, [
    '... 1 earlier line(s)',
    cause,
    ...touched.slice(0, 5),
    '... 4 line(s) in between',
    ...touched.slice(-6),
  ])
  assert.deepEqual(
    buildFailureLines(['Discovering template overrides...', cause, ...touched].join('\n'), 1),
    ['... 1 earlier line(s)', cause, '... 15 line(s) in between'],
    'a limit with no room for an end keeps only the cause'
  )
})

/** Lines the way core's registry build prints a Feature/Flow tag validation failure before it exits. */
function tagValidationFailure(flows: string[]): string[] {
  return [
    '❌ Feature/Flow tag validation errors:',
    ...flows.flatMap((flow) => [
      `   ❌ Tag @flow-${flow} found in tests but no matching flow in flows.config.ts`,
      ...[1, 2, 3].map((n) => `      → contents/themes/acme/tests/cypress/e2e/${flow}/step-${n}.cy.ts`),
    ]),
  ]
}

test('what sits under a header that reads as the cause is not dropped for the files listed after it', () => {
  const discovery = Array.from({ length: 20 }, (_, index) => `🔍 Discovered plugin-${index}`)
  const flows = ['checkout', 'refunds', 'invoices', 'coupons', 'returns']
  const output = [...discovery, '✅ testing-registry.ts', ...tagValidationFailure(flows)].join('\n')

  const lines = buildFailureLines(output)
  for (const flow of flows) {
    assert.ok(lines.includes(`   ❌ Tag @flow-${flow} found in tests but no matching flow in flows.config.ts`), `@flow-${flow} is shown:\n${lines.join('\n')}`)
  }
  assert.ok(!lines.some((line) => line.includes('plugin-')), 'what ran before the failure is left out')

  const short = buildFailureLines(output, 8)
  assert.deepEqual(short.slice(0, 3), [
    '... 21 earlier line(s)',
    '❌ Feature/Flow tag validation errors:',
    '   ❌ Tag @flow-checkout found in tests but no matching flow in flows.config.ts',
  ])
})

test('an error printed and recovered from earlier does not stand in for the one that stopped the build', () => {
  const cause = '❌ Build failed: contents/themes/acme/templates/shop/page.tsx has no default export'
  const stack = Array.from({ length: 30 }, (_, index) => `    at step${index} (file:///core/scripts/build/registry/errors.mjs:${index + 1}:5)`)
  const output = [
    '⚠️ Plugin analytics failed to load, skipping it',
    ...Array.from({ length: 20 }, (_, index) => `🔍 Discovered template-${index}`),
    cause,
    ...stack,
  ].join('\n')

  const lines = buildFailureLines(output)
  assert.equal(lines[1], cause, `the build's own failure leads what is shown:\n${lines.join('\n')}`)
  assert.ok(!lines.some((line) => line.includes('Plugin analytics')), 'the recovered error is left out')
  assert.equal(lines.at(-1), stack.at(-1))
})

test('output that fits under the limit is repeated whole, with nothing marking a gap', () => {
  const output = 'Discovering template overrides...\nError: no default export\n'

  assert.deepEqual(buildFailureLines(output), ['Discovering template overrides...', 'Error: no default export'])
})

/** Feed `text` to `output` over `stream`, a byte per chunk, so every character of more than one byte arrives split. */
function writeByteByByte(output: CapturedOutput, stream: 'stdout' | 'stderr', text: string): void {
  for (const byte of Buffer.from(text, 'utf8')) output.write(stream, Buffer.from([byte]))
}

/** Feed each of `lines` to `output` over `stream`, each with its line break, as a chunk of its own. */
function writeLines(output: CapturedOutput, stream: 'stdout' | 'stderr', lines: string[]): void {
  for (const line of lines) output.write(stream, Buffer.from(`${line}\n`, 'utf8'))
}

const bytesOf = (text: string) => Buffer.byteLength(text, 'utf8')

test('a cause printed once the head is full stays ahead of the thousands of warnings that follow it', () => {
  const cause = '❌ Build failed: contents/themes/acme/templates/shop/page.tsx has no default export'
  const warning = '⚠️ app/(templates): backed up app/(templates)/shop/page.tsx to .nextspark/backups/t0/app/(templates)/shop/page.tsx'

  const output = captureOutput({ head: { lines: 2, bytes: 1024 }, tail: { lines: 2, bytes: 1024 } })
  writeLines(output, 'stdout', ['progress 0', 'progress 1', 'progress 2', cause])
  writeLines(output, 'stdout', Array.from({ length: 2000 }, () => warning))
  writeLines(output, 'stdout', ['done'])

  assert.deepEqual(output.failureLines, [
    'progress 0',
    'progress 1',
    '... 1 line(s), 10 byte(s) omitted',
    cause,
    `... 1999 line(s), ${1999 * bytesOf(warning)} byte(s) omitted`,
    warning,
    'done',
  ])
})

test('the first error lines are the ones kept, and the ones after them are counted', () => {
  const errors = Array.from({ length: 5 }, (_, index) => `❌ Failed to parse block "block-${index}"`)

  const output = captureOutput({ head: { lines: 0, bytes: 0 }, tail: { lines: 1, bytes: 1024 }, errors: { lines: 3, bytes: 1024 } })
  writeLines(output, 'stdout', [...errors, 'done'])

  assert.deepEqual(output.failureLines, [
    ...errors.slice(0, 3),
    `... 2 line(s), ${bytesOf(errors[3]) + bytesOf(errors[4])} byte(s) omitted`,
    'done',
    `... and 2 more error line(s), ${bytesOf(errors[3]) + bytesOf(errors[4])} byte(s), after the first 3`,
  ])
})

test('an error heading keeps the stack lines under it on its stream, up to the cap for each error', () => {
  const frames = Array.from({ length: 12 }, (_, index) => `    at step${index} (file:///core/scripts/build/registry.mjs:${index + 10}:5)`)

  const output = captureOutput({ head: { lines: 0, bytes: 0 }, tail: { lines: 1, bytes: 1024 } })
  writeLines(output, 'stderr', ['Error: boom'])
  writeLines(output, 'stdout', ['progress'])
  writeLines(output, 'stderr', frames)
  writeLines(output, 'stderr', ['not a frame', '    at later (file:///core/x.mjs:1:1)'])
  writeLines(output, 'stdout', ['done'])

  const later = bytesOf('not a frame') + bytesOf('    at later (file:///core/x.mjs:1:1)')
  assert.deepEqual(output.failureLines, [
    'Error: boom',
    '... 1 line(s), 8 byte(s) omitted',
    ...frames.slice(0, 10),
    `... 4 line(s), ${bytesOf(frames[10]) + bytesOf(frames[11]) + later} byte(s) omitted`,
    'done',
  ])
})

test('every error the errors pool keeps keeps all of its stack lines, however many frames the errors before it printed', () => {
  const framesOf = (name: string, count: number) =>
    Array.from({ length: count }, (_, index) => `    at ${name}${index} (file:///core/scripts/build/registry.mjs:${index + 1}:5)`)

  const output = captureOutput({ head: { lines: 0, bytes: 0 }, tail: { lines: 1, bytes: 1024 } })
  for (let error = 0; error < 6; error++) {
    writeLines(output, 'stderr', [`Error: E${error}`, ...framesOf(`e${error}f`, 10)])
  }
  writeLines(output, 'stdout', ['done'])

  const lines = output.failureLines
  for (let error = 0; error < 6; error++) {
    const at = lines.indexOf(`Error: E${error}`)
    assert.ok(at !== -1, `E${error} is kept`)
    assert.deepEqual(lines.slice(at + 1, at + 11), framesOf(`e${error}f`, 10), `E${error} keeps all 10 of its stack lines, not just the first`)
  }
})

/** A stack line padded with filler after its call site so it lands at exactly `totalBytes`. */
function frameOfLength(totalBytes: number): string {
  const prefix = '    at f (file:///x.mjs:1:1) '
  const filler = 'x'.repeat(totalBytes - bytesOf(prefix))
  return `${prefix}${filler}`
}

test('a single kept error keeps as many frames as the stack pool has room for, not a fixed share of it computed from how many errors it could hold', () => {
  const frame = frameOfLength(183)
  const frames = Array.from({ length: 10 }, () => frame)

  const output = captureOutput({ head: { lines: 0, bytes: 0 }, tail: { lines: 0, bytes: 0 } })
  writeLines(output, 'stderr', ['Error: boom', ...frames])

  const lines = output.failureLines
  assert.deepEqual(
    lines.filter((line) => line.startsWith('    at ')),
    frames,
    `all 10 frames are kept: the default 16384-byte stack pool holds them, even though an even 1/10 share of it (1638 bytes) would only fit 8:\n${lines.join('\n')}`
  )
})

test('a single frame heavier than an even share of the stack pool is still kept when the pool itself has room for it', () => {
  const frame = frameOfLength(1731)
  const output = captureOutput({ head: { lines: 0, bytes: 0 }, tail: { lines: 0, bytes: 0 } })
  writeLines(output, 'stderr', ['Error: boom', frame])

  assert.ok(output.failureLines.includes(frame), `the 1731-byte frame is kept: it only overruns a computed 1638-byte-per-error share, not the 16384-byte pool:\n${output.failureLines.join('\n')}`)
})

test('the stack pool is shared out evenly among the errors the errors pool can keep', () => {
  const frame = (name: string, index: number) => `    at ${name}${index} (file:///x.mjs:${index + 1}:1)`
  const output = captureOutput({
    head: { lines: 0, bytes: 0 },
    tail: { lines: 1, bytes: 1024 },
    errors: { lines: 3, bytes: 1024 },
    stack: { perError: 10, lines: 6, bytes: 1024 },
  })
  for (const name of ['a', 'b', 'c']) {
    writeLines(output, 'stderr', [`Error: ${name}`, ...Array.from({ length: 5 }, (_, index) => frame(name, index))])
  }
  writeLines(output, 'stdout', ['done'])

  const lines = output.failureLines
  const at = lines.indexOf('Error: c')
  assert.deepEqual(lines.slice(at + 1, at + 3), [frame('c', 0), frame('c', 1)])
})

test('when the stack pool runs out mid-round, the errors still waiting for a frame split what is left evenly, and the total never crosses either cap', () => {
  const frame = (name: string, index: number) => `    at ${name}${index} (file:///x.mjs:${index + 1}:1)`
  const output = captureOutput({
    head: { lines: 0, bytes: 0 },
    tail: { lines: 0, bytes: 0 },
    errors: { lines: 4, bytes: 4096 },
    stack: { perError: 5, lines: 10, bytes: 1024 * 1024 },
  })
  for (const name of ['a', 'b', 'c', 'd']) {
    writeLines(output, 'stderr', [`Error: ${name}`, ...Array.from({ length: 5 }, (_, index) => frame(name, index))])
  }

  const lines = output.failureLines
  const framesOf = (name: string) => lines.filter((line) => line.startsWith(`    at ${name}`))
  assert.deepEqual(framesOf('a'), [frame('a', 0), frame('a', 1), frame('a', 2)], 'a is among the first two errors of the round that filled the pool, so it keeps one more frame than c or d')
  assert.deepEqual(framesOf('b'), [frame('b', 0), frame('b', 1), frame('b', 2)])
  assert.deepEqual(framesOf('c'), [frame('c', 0), frame('c', 1)])
  assert.deepEqual(framesOf('d'), [frame('d', 0), frame('d', 1)])
  assert.equal(lines.filter((line) => line.startsWith('    at ')).length, 10, 'the stack.lines cap of 10 is never crossed')
})

test('a warning behind an OSC hyperlink sequence is still a warning, ended by BEL or by ST', () => {
  const byBel = '\x1b]8;;https://example.com/docs\x07⚠️ linked warning\x1b]8;;\x07'
  const bySt = '\x1b]8;;https://example.com/docs\x1b\\⚠️ another linked warning'
  const output = captureOutput()
  writeLines(output, 'stdout', ['progress', byBel, bySt])
  assert.deepEqual(output.successLines, [byBel, bySt])
})

test('a character split across chunks arrives whole, with the bytes of both streams interleaved', () => {
  const warning = '⚠️ café 😀'
  const error = 'Error: café 😀'

  const output = captureOutput()
  const stdout = Buffer.from(`${warning}\n`, 'utf8')
  const stderr = Buffer.from(`${error}\n`, 'utf8')
  for (let index = 0; index < Math.max(stdout.length, stderr.length); index++) {
    if (index < stdout.length) output.write('stdout', stdout.subarray(index, index + 1))
    if (index < stderr.length) output.write('stderr', stderr.subarray(index, index + 1))
  }

  assert.deepEqual(output.successLines, [warning, error])
  assert.deepEqual(output.failureLines, [warning, error])
})

test('é, 😀 and ⚠️ written a byte at a time on one stream arrive whole', () => {
  const output = captureOutput()
  writeByteByByte(output, 'stdout', '⚠️ café 😀\nError: café 😀\n')

  assert.deepEqual(output.successLines, ['⚠️ café 😀', 'Error: café 😀'])
})

test('a line with no line break keeps only its start, and counts every byte it printed', () => {
  const output = captureOutput({ line: 8 })
  for (let index = 0; index < 100; index++) output.write('stdout', Buffer.from('é'.repeat(1000), 'utf8'))

  assert.deepEqual(output.failureLines, ['éééé… (199992 more byte(s) on this line)'])
})

test('a line cut at a character of several bytes keeps whole characters, and counts the rest in bytes', () => {
  const output = captureOutput({ line: 6 })
  writeByteByByte(output, 'stdout', 'ab😀cd\n')

  assert.deepEqual(output.failureLines, ['ab😀… (2 more byte(s) on this line)'])
})

test('empty lines count against the line caps, so thousands of them leave only what the caps hold', () => {
  const output = captureOutput({ head: { lines: 2, bytes: 1024 }, tail: { lines: 3, bytes: 1024 } })
  output.write('stdout', Buffer.from('\n'.repeat(100_000)))

  assert.deepEqual(output.failureLines, ['', '', '... 99995 line(s), 0 byte(s) omitted', '', '', ''])
})

test('omitted and cut counts are of the bytes printed, never of the text kept or shown', () => {
  const output = captureOutput({ line: 4, head: { lines: 1, bytes: 1024 }, tail: { lines: 1, bytes: 1024 } })
  writeLines(output, 'stdout', ['abc', 'abcdef', 'ééé', 'wxyz12'])

  assert.deepEqual(output.failureLines, ['abc', '... 2 line(s), 12 byte(s) omitted', 'wxyz… (2 more byte(s) on this line)'])
})

test('only the marker a line starts with flags it: 🏗️ progress is not a warning, and a quoted or colored marker is', () => {
  const notFlagged = [
    '🏗️  Building Unified Registry System',
    '✅ testing-registry.ts',
    '📝 Processed 3 files ⚠️ none skipped',
    'Blocks: 0 ❌',
    'ErrorBoundary: registered',
    'Build failed without a marker',
  ]
  const flagged = [
    '\u26A0 app/(templates): a warning with no variation selector',
    '   ⚠️  Coverage: flow checkout has no tests',
    '\x1b[33m⚠️ a colored warning\x1b[39m',
    '"❌ Build failed: app/(templates)/a\\u000ab/page.tsx"',
    'TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string',
  ]

  const output = captureOutput()
  writeLines(output, 'stdout', [...notFlagged, ...flagged])

  assert.deepEqual(output.successLines, flagged)
})

test('warnings keep the first ones under either cap, and count the rest with their bytes', () => {
  const warnings = Array.from({ length: 5 }, (_, index) => `⚠️ w${index}`)
  const rest = bytesOf(warnings[2]) * 3

  const byLines = captureOutput({ warnings: { lines: 2, bytes: 1024 } })
  writeLines(byLines, 'stdout', warnings)
  assert.deepEqual(byLines.successLines, [warnings[0], warnings[1], `... and 3 more warning line(s), ${rest} byte(s)`])

  const byBytes = captureOutput({ warnings: { lines: 100, bytes: bytesOf(warnings[0]) * 2 } })
  writeLines(byBytes, 'stdout', warnings)
  assert.deepEqual(byBytes.successLines, [warnings[0], warnings[1], `... and 3 more warning line(s), ${rest} byte(s)`])
})

test('bytes that are not UTF-8 count as the bytes printed, and show as U+FFFD', () => {
  const gap = captureOutput({ head: { lines: 1, bytes: 1024 }, tail: { lines: 1, bytes: 1024 } })
  gap.write('stdout', Buffer.from('first\n', 'utf8'))
  gap.write('stdout', Buffer.from([0xe2, 0x0a]))
  gap.write('stdout', Buffer.from('last\n', 'utf8'))
  assert.deepEqual(gap.failureLines, ['first', '... 1 line(s), 1 byte(s) omitted', 'last'])

  const shown = captureOutput()
  shown.write('stdout', Buffer.from([0x61, 0xff, 0x62, 0x0a]))
  assert.deepEqual(shown.failureLines, ['a\ufffdb'])

  const cut = captureOutput({ line: 4 })
  cut.write('stdout', Buffer.from([0x61, 0x61, 0x61, 0xf0, 0x9f, 0x62, 0x63, 0x64, 0x0a]))
  assert.deepEqual(cut.failureLines, ['aaa… (5 more byte(s) on this line)'])
})

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * A line is split out of the chunk it arrived in, so its text has to be a
 * string of its own: a slice of a decoded chunk keeps the whole chunk in
 * memory. Chunks of 12 MB, each starting with an error line that is kept,
 * would run a 64 MB heap out if each kept line held on to its chunk.
 */
test('a kept line does not hold on to the chunk it arrived in', { skip: process.platform === 'win32', timeout: 60_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-capture-memory-'))
  try {
    const script = join(root, 'capture.mts')
    await writeFile(script, `import { captureOutput } from ${JSON.stringify(pathToFileURL(join(PKG_ROOT, 'src/utils/registry-build.ts')).href)}
const output = captureOutput()
for (let index = 0; index < 8; index++) {
  const chunk = Buffer.alloc(12 * 1024 * 1024, 0x78)
  Buffer.from('❌ Failed to parse block ' + String(index).padEnd(4000, 'e') + '\\n').copy(chunk, 0)
  chunk[chunk.length - 1] = 0x0a
  output.write('stdout', chunk)
}
console.log(output.successLines.length)
`)
    const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--import', 'tsx', script], { cwd: PKG_ROOT, encoding: 'utf-8', timeout: 50_000, killSignal: 'SIGKILL' })
    assert.equal(run.signal, null, `must finish on its own:\n${run.stderr.slice(0, 2000)}`)
    assert.ok(!/FATAL ERROR/.test(run.stderr), `must not run out of heap:\n${run.stderr.slice(0, 2000)}`)
    assert.equal(run.status, 0, run.stderr.slice(0, 2000))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

/**
 * Every kept error's candidate stack frames are gathered as the output streams
 * in, up to `stack.perError` of them, before which ones are shown is decided.
 * 2,000 errors with 200 frames of about 4 KB each - what `build` and
 * `registry:build` feed through the same `captureChildOutput` this uses - would
 * run a 64 MB heap out if that gathering held more than the errors pool can
 * ever keep, or more than `perError` frames of any one of them.
 */
test(
  '2,000 errors with 200 stack frames of about 4 KB each never run a 64 MB heap out',
  { skip: process.platform === 'win32', timeout: 60_000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'nextspark-capture-memory-stack-'))
    try {
      const script = join(root, 'capture.mts')
      await writeFile(script, `import { captureOutput } from ${JSON.stringify(pathToFileURL(join(PKG_ROOT, 'src/utils/registry-build.ts')).href)}
const output = captureOutput()
const frame = '    at f' + 'r'.repeat(4000) + ' (file:///x.mjs:1:1)\\n'
for (let error = 0; error < 2000; error++) {
  const block = '❌ Failed to parse block ' + error + '\\n' + frame.repeat(200)
  output.write('stdout', Buffer.from(block, 'utf8'))
}
console.log(output.failureLines.length)
`)
      const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--import', 'tsx', script], { cwd: PKG_ROOT, encoding: 'utf-8', timeout: 50_000, killSignal: 'SIGKILL' })
      assert.equal(run.signal, null, `must finish on its own:\n${run.stderr.slice(0, 2000)}`)
      assert.ok(!/FATAL ERROR/.test(run.stderr), `must not run out of heap:\n${run.stderr.slice(0, 2000)}`)
      assert.equal(run.status, 0, run.stderr.slice(0, 2000))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
)

test('the last lines hold no more than either of their caps', () => {
  const noLines = captureOutput({ head: { lines: 0, bytes: 0 }, tail: { lines: 0, bytes: 1024 } })
  writeLines(noLines, 'stdout', ['ab'])
  assert.deepEqual(noLines.failureLines, ['... 1 line(s), 2 byte(s) omitted'])

  const fewBytes = captureOutput({ head: { lines: 0, bytes: 0 }, tail: { lines: 10, bytes: 3 } })
  writeLines(fewBytes, 'stdout', ['ab', 'cd'])
  assert.deepEqual(fewBytes.failureLines, ['... 1 line(s), 2 byte(s) omitted', 'cd'])
})

test('a quoted line is read past its quote only when it holds an escape, as core\'s console guard writes one', () => {
  const output = captureOutput()
  writeLines(output, 'stdout', ['"❌ a JSON string"', '"⚠️ another JSON string"', '"⚠️ backed up a\\u2028b.tsx"'])

  assert.deepEqual(output.successLines, ['"⚠️ backed up a\\u2028b.tsx"'])
})

test('lines are ordered by when they end, so a line one stream is partway through comes after one the other stream ends meanwhile', () => {
  const output = captureOutput()
  output.write('stdout', Buffer.from('first-start', 'utf8'))
  output.write('stderr', Buffer.from('second-whole\n', 'utf8'))
  output.write('stdout', Buffer.from('-first-end\n', 'utf8'))

  assert.deepEqual(output.failureLines, ['second-whole', 'first-start-first-end'])
})

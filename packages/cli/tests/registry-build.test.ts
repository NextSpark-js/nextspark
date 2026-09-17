import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildFailureLines, captureOutput, registryBuildBlocker, runRegistryBuild, templatesTreeLines } from '../src/utils/registry-build.js'

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

test('a cause captureOutput keeps in its head survives megabytes of unrelated filler, with an exact omitted count', () => {
  const causeLine = '❌ cause line'
  const fillerLine = 'x'.repeat(10)
  const causeBytes = Buffer.byteLength(causeLine, 'utf8')
  const fillerBytes = Buffer.byteLength(fillerLine, 'utf8')
  const fillerCount = 50

  const out = captureOutput({ head: causeBytes, tail: fillerBytes * 2, marked: 1024 })
  out.append(`${causeLine}\n`)
  for (let index = 0; index < fillerCount; index++) out.append(`${fillerLine}\n`)

  const lines = out.value.split('\n')
  assert.equal(lines[0], causeLine, `the cause must lead what is shown:\n${out.value}`)
  assert.equal(lines[1], `... ${fillerCount - 2} line(s), ${(fillerCount - 2) * fillerBytes} byte(s) omitted`)
  assert.deepEqual(lines.slice(2), [fillerLine, fillerLine])
})

test('a cause captureOutput only ever sees in the middle of the output still survives, via the marked pool rather than the head', () => {
  const fillerLine = 'x'.repeat(10)
  const causeLine = '⚠️ Plugin analytics failed to load, skipping it'
  const fillerBytes = Buffer.byteLength(fillerLine, 'utf8')

  const out = captureOutput({ head: fillerBytes * 2, tail: fillerBytes * 2, marked: 1024 })
  for (let index = 0; index < 20; index++) out.append(`${fillerLine}\n`)
  out.append(`${causeLine}\n`)
  for (let index = 0; index < 20; index++) out.append(`${fillerLine}\n`)

  assert.ok(out.value.includes(causeLine), `a cause buried in the middle must survive:\n${out.value}`)
  assert.deepEqual(out.markedLines, [causeLine])
})

test('warnings past the marked pool\'s own cap are dropped oldest-first, with an exact count', () => {
  const line = (index: number) => `⚠️ w${index}`
  const lineBytes = Buffer.byteLength(line(0), 'utf8')

  const out = captureOutput({ marked: lineBytes * 2 })
  for (let index = 0; index < 5; index++) out.append(`${line(index)}\n`)

  assert.deepEqual(out.markedLines, [line(3), line(4)])
  assert.equal(out.droppedMarkedLines, 3)
  assert.equal(out.droppedMarkedBytes, lineBytes * 3)
})

test('captureOutput counts real UTF-8 bytes, not UTF-16 units, and never splits a code point', () => {
  const out = captureOutput({ line: 6 })
  out.append('ab\u{1F600}cd\n')

  assert.equal(Buffer.byteLength('ab\u{1F600}cd', 'utf8'), 8, 'the fixture is 8 UTF-8 bytes, not 6 UTF-16 units')
  assert.equal(out.value, 'ab\u{1F600}… (2 more byte(s) on this line)')
})

test('captureOutput never splits a surrogate pair, even one a chunk boundary falls inside', () => {
  const out = captureOutput()
  out.append('a\uD83D')
  out.append('\uDE00b\n')

  assert.equal(out.value, 'a\u{1F600}b')
  assert.doesNotMatch(out.value, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
})

test('captureOutput truncates a line that is all multi-byte characters by whole code points, with an exact drop count', () => {
  const nine = 'é'.repeat(9)
  const out = captureOutput({ line: 4 })
  out.append(`${nine}\n`)

  assert.equal(Buffer.byteLength(nine, 'utf8'), 18)
  assert.equal(out.value, 'éé… (14 more byte(s) on this line)')
})

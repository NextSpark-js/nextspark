import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildCommand } from '../src/commands/build.js'
import { buildRegistries } from '../src/commands/dev.js'
import { registryBuildCommand } from '../src/commands/registry.js'
import { guardConsole } from '../src/utils/shown-path.js'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Names that, printed raw, erase a line, set the terminal's title, return the
 * carriage, separate lines or reverse what follows, each with the way a line
 * naming it shows it. A newline can't be told apart from the end of a line once
 * the build has printed it, so core's guarded console escapes that one as it
 * prints the line.
 */
const NAMES: [string, string][] = [
  ['erase\u001b[2Kline.tsx', 'erase\\u001b[2Kline.tsx'],
  ['title\u001b]0;owned\u0007.tsx', 'title\\u001b]0;owned\\u0007.tsx'],
  ['carriage\rreturn.tsx', 'carriage\\rreturn.tsx'],
  ['line\u2028separator.tsx', 'line\\u2028separator.tsx'],
  ['next\u0085line.tsx', 'next\\u0085line.tsx'],
  ['reversed\u202etxt.tsx', 'reversed\\u202etxt.tsx'],
]

const RAW_CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/

/** A project with a stand-in for core whose registry build names each of NAMES on stdout and on stderr, and exits with `code`. */
async function projectWithBuild(code: number) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-commands-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `for (const name of ${JSON.stringify(NAMES.map(([name]) => name))}) {
  console.log('⚠️ src/app/(templates): backed up src/app/(templates)/' + name + ' to .nextspark/backups/x')
  console.error('Build failed: could not read src/app/(templates)/' + name)
}
process.exit(${code})
`
  )
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  return { root, coreDir, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * Run a command from the project root, returning what it printed through the
 * console without colors. process.exit is recorded rather than run; with
 * `exits`, the command is done once it calls it.
 */
async function runCommand(root: string, command: () => Promise<void>, exits: boolean) {
  const printed: string[] = []
  const original = { log: console.log, warn: console.warn, error: console.error, exit: process.exit }
  const capture = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
  let exited: (code: number) => void = () => {}
  const exit = new Promise<number>((resolve) => { exited = resolve })
  const previousCwd = process.cwd()

  console.log = capture
  console.warn = capture
  console.error = capture
  // As the CLI guards the console before any command runs
  guardConsole()
  process.exit = ((code?: number) => { exited(Number(code ?? 0)) }) as typeof process.exit
  process.chdir(root)
  try {
    await command()
    if (exits) await exit
  } finally {
    process.exit = original.exit
    process.chdir(previousCwd)
    Object.assign(console, { log: original.log, warn: original.warn, error: original.error })
  }
  return printed.join('\n').replace(/\x1b\[[0-9;]*m/g, '')
}

/** What is wrong with what a command printed: a line holding a raw control, or one of `names` no line ends with `line` for. */
function wrongOutput(label: string, printed: string, line: (shown: string) => string, names = NAMES): string[] {
  const lines = printed.split('\n')
  return [
    ...lines.filter((printedLine) => RAW_CONTROL.test(printedLine)).map((printedLine) => `${label}: ${JSON.stringify(printedLine)} holds a raw control`),
    ...names.filter(([, shown]) => !lines.some((printedLine) => printedLine.trimEnd().endsWith(line(shown)))).map(([, shown]) => `${label}: no line ends with ${shown} shown escaped`),
  ]
}

const backedUpLine = (shown: string, prefix = '') => `"${prefix}⚠️ src/app/(templates): backed up src/app/(templates)/${shown} to .nextspark/backups/x"`
const failedLine = (shown: string) => `"Build failed: could not read src/app/(templates)/${shown}"`

/**
 * A successful build shows the first five warnings it printed and counts the
 * rest, so the success run names the first five of NAMES; the failed run
 * names all of them.
 */
test('registry:build shows each line of what the registry build printed escaped, whether the build succeeds or fails', { skip: process.platform === 'win32' }, async () => {
  const wrong: string[] = []
  for (const [code, label, line, names] of [[0, 'built', backedUpLine, NAMES.slice(0, 5)], [1, 'failed', failedLine, NAMES]] as const) {
    const { root, cleanup } = await projectWithBuild(code)
    try {
      const printed = await runCommand(root, registryBuildCommand, true)
      wrong.push(...wrongOutput(label, printed, line, names))
      if (code === 0 && !printed.split('\n').some((printedLine) => printedLine.startsWith('... and 1 more warning line(s), '))) {
        wrong.push(`${label}: the warning past the first five is not counted`)
      }
    } finally {
      await cleanup()
    }
  }
  assert.deepEqual(wrong, [])
})

test('build shows each line of what a failed registry build printed escaped', { skip: process.platform === 'win32' }, async () => {
  const { root, cleanup } = await projectWithBuild(1)
  try {
    const printed = await runCommand(root, () => buildCommand({ registry: true }), false)
    assert.deepEqual(wrongOutput('build', printed, failedLine), [])
  } finally {
    await cleanup()
  }
})

test('dev shows each line it repeats from the registry build escaped, whether the build succeeds or fails', { skip: process.platform === 'win32' }, async () => {
  const wrong: string[] = []
  for (const [code, label] of [[0, 'built'], [1, 'failed']] as const) {
    const { root, coreDir, cleanup } = await projectWithBuild(code)
    try {
      const printed = await runCommand(root, () => buildRegistries(coreDir, root), false)
      wrong.push(...wrongOutput(label, printed, (shown) => backedUpLine(shown, '[Registry] ')))
      if (code === 1 && !printed.split('\n').includes(failedLine(NAMES[NAMES.length - 1][1]))) {
        wrong.push(`${label}: the cause does not appear`)
      }
    } finally {
      await cleanup()
    }
  }
  assert.deepEqual(wrong, [])
})

/**
 * `captureChildOutput`'s errors pool keeps the first error lines regardless
 * of what streams after them, so `dev` still shows a build's cause after a
 * flood of stdout that follows it on the other stream.
 */
test('dev still shows the cause once a flood of stdout follows it', { skip: process.platform === 'win32' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-commands-flood-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `console.error('❌ Build failed: templates/shop/page.tsx has no default export')
for (let i = 0; i < 5000; i++) console.log('progress ' + i)
process.exit(1)
`
  )
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  try {
    const printed = await runCommand(root, () => buildRegistries(coreDir, root), false)
    assert.ok(
      printed.includes('Build failed: templates/shop/page.tsx has no default export'),
      `the cause survives 5000 lines of stdout printed after it:\n${printed.slice(0, 500)}`
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('dev shows a long src/app/(templates) line cut at the cap with the same omitted-bytes marker as everything else it prints', { skip: process.platform === 'win32' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-commands-longline-'))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  const longSuffix = 'x'.repeat(14000)
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `console.log('src/app/(templates)/' + ${JSON.stringify(longSuffix)} + '.tsx created')\n`
  )
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  try {
    const printed = await runCommand(root, () => buildRegistries(coreDir, root), false)
    const fullLine = `src/app/(templates)/${longSuffix}.tsx created`
    const kept = Buffer.from(fullLine, 'utf8').subarray(0, 4096).toString('utf8')
    const omitted = Buffer.byteLength(fullLine, 'utf8') - Buffer.byteLength(kept, 'utf8')
    assert.ok(
      printed.includes(`[Registry] ${kept}… (${omitted} more byte(s) on this line)`),
      `the line is shown cut at the cap with its omitted-bytes marker:\n${printed.slice(0, 300)}`
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

/**
 * A build that prints hundreds of MB - as a real project with a lot of
 * routes would, one src/app/(templates) line per file - runs `dev` in bounded
 * memory.
 */
test('dev does not run a 64 MB heap out on a build that prints hundreds of MB', { skip: process.platform === 'win32', timeout: 60_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-commands-memory-'))
  try {
    const coreDir = join(root, 'core')
    await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
    await writeFile(
      join(coreDir, 'scripts/build/registry.mjs'),
      // No process.exit: it would cut the writes still queued on the pipe short of the parent
      `const line = '⚠️  src/app/(templates): backed up src/app/(templates)/page-' + 'x'.repeat(8000) + '.tsx\\n'
for (let i = 0; i < 30000; i++) process.stdout.write(line)
`
    )
    const projectRoot = join(root, 'project')
    await mkdir(projectRoot)
    await writeFile(join(projectRoot, 'nextspark.config.ts'), 'export default { plugins: [] }\n')

    const script = join(root, 'run.mts')
    await writeFile(script, `import { buildRegistries } from ${JSON.stringify(pathToFileURL(join(PKG_ROOT, 'src/commands/dev.ts')).href)}
await buildRegistries(${JSON.stringify(coreDir)}, ${JSON.stringify(projectRoot)})
`)
    const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--import', 'tsx', script], { cwd: PKG_ROOT, encoding: 'utf-8', timeout: 50_000, killSignal: 'SIGKILL' })
    assert.equal(run.signal, null, `must finish on its own:\n${run.stderr.slice(0, 2000)}`)
    assert.ok(!/FATAL ERROR/.test(run.stderr), `must not run out of heap:\n${run.stderr.slice(0, 2000)}`)
    assert.equal(run.status, 0, run.stderr.slice(0, 2000))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

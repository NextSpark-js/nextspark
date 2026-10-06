import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildCommand } from '../src/commands/build.js'
import { prepareHost } from '../src/commands/dev.js'
import { prepareCommand } from '../src/commands/prepare.js'
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

/** What a stand-in host preparation prints: each of NAMES on stdout and on stderr, then exits with `code`. */
const PRINTS_NAMES = (code: number) => `for (const name of ${JSON.stringify(NAMES.map(([name]) => name))}) {
  console.log('Generated src/app/' + name)
  console.error('[NS_HOST_ROUTE_COLLISION] src/app/' + name + ': two project files provide this route')
}
process.exit(${code})
`

/** A project with a stand-in for core (it decides this is a host) whose host preparation runs `script`. */
async function projectWithPreparation(script: string, name = 'nextspark-registry-commands-') {
  const root = await mkdtemp(join(tmpdir(), name))
  const coreDir = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(coreDir, 'scripts/build/registry/host'), { recursive: true })
  await writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(join(coreDir, 'scripts/build/registry/host/prepare-cli.mjs'), script)
  await writeFile(join(coreDir, 'scripts/build/registry/host/mode.mjs'), "export function resolveHostMode() { return { mode: 'host', reason: 'generated' } }\n")
  // A passing auth readiness check: its behavior is covered by auth-readiness-preflight.test.ts
  await writeFile(join(coreDir, 'scripts/build/auth-readiness.mjs'), '')
  // build checks that Next is installed before it prepares anything
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
  await writeFile(join(root, 'node_modules/.bin/next'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  return { root, coreDir, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/** What is wrong with what a command printed: a line holding a raw control, or a name no line shows escaped. */
function wrongOutput(label: string, printed: string, line: (shown: string) => string): string[] {
  const lines = printed.split('\n')
  return [
    ...lines.filter((printedLine) => RAW_CONTROL.test(printedLine)).map((printedLine) => `${label}: ${JSON.stringify(printedLine)} holds a raw control`),
    ...NAMES.filter(([, shown]) => !lines.some((printedLine) => printedLine.includes(line(shown)))).map(([, shown]) => `${label}: no line shows ${shown} escaped`),
  ]
}

const collisionLine = (shown: string) => `src/app/${shown}: two project files provide this route`

test('prepare, registry:build and build show each line of what a failed preparation printed escaped', { skip: process.platform === 'win32' }, async () => {
  const wrong: string[] = []
  for (const [label, command] of [
    ['prepare', () => prepareCommand({})],
    ['registry:build', registryBuildCommand],
    ['build', () => buildCommand({ registry: true })],
  ] as const) {
    const { root, cleanup } = await projectWithPreparation(PRINTS_NAMES(1))
    try {
      wrong.push(...wrongOutput(label, await runCommand(root, command, true), collisionLine))
    } finally {
      await cleanup()
    }
  }
  assert.deepEqual(wrong, [])
})

test('dev shows each line it repeats from the preparation escaped, whether it succeeds or fails', { skip: process.platform === 'win32' }, async () => {
  const wrong: string[] = []
  for (const [code, label, line] of [
    [0, 'prepared', (shown: string) => `[Prepare] Generated src/app/${shown}`],
    [1, 'failed', collisionLine],
  ] as const) {
    const { root, coreDir, cleanup } = await projectWithPreparation(PRINTS_NAMES(code))
    try {
      wrong.push(...wrongOutput(label, await runCommand(root, () => prepareHost(coreDir, root), false), line))
    } finally {
      await cleanup()
    }
  }
  assert.deepEqual(wrong, [])
})

/**
 * The host runner keeps the first lines of a preparation's output and counts the rest, so `dev`
 * still shows the cause a preparation printed first, after a flood that follows it.
 */
test('dev still shows the cause once a flood of output follows it', { skip: process.platform === 'win32' }, async () => {
  const { root, coreDir, cleanup } = await projectWithPreparation(`console.error('[NS_HOST_ROUTE_COLLISION] templates/shop/page.tsx has no default export')
for (let i = 0; i < 5000; i++) console.log('progress ' + i)
process.exitCode = 1
`, 'nextspark-registry-commands-flood-')
  try {
    const printed = await runCommand(root, () => prepareHost(coreDir, root), false)
    assert.ok(printed.includes('templates/shop/page.tsx has no default export'), `the cause survives 5000 lines printed after it:\n${printed.slice(0, 500)}`)
    assert.match(printed, /\.\.\. and \d+ more line\(s\)/, 'the rest is counted, not printed')
  } finally {
    await cleanup()
  }
})

/**
 * A preparation that prints hundreds of MB - as one that reports a line per file would on a project
 * with a lot of routes - runs `dev` in bounded memory.
 */
test('dev does not run a 64 MB heap out on a preparation that prints hundreds of MB', { skip: process.platform === 'win32', timeout: 60_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-commands-memory-'))
  try {
    const coreDir = join(root, 'core')
    await mkdir(join(coreDir, 'scripts/build/registry/host'), { recursive: true })
    await writeFile(
      join(coreDir, 'scripts/build/registry/host/prepare-cli.mjs'),
      // No process.exit: it would cut the writes still queued on the pipe short of the parent
      `const line = 'Generated src/app/page-' + 'x'.repeat(8000) + '.tsx\\n'
for (let i = 0; i < 30000; i++) process.stdout.write(line)
`
    )
    const projectRoot = join(root, 'project')
    await mkdir(projectRoot)
    await writeFile(join(projectRoot, 'nextspark.config.ts'), 'export default { plugins: [] }\n')

    const script = join(root, 'run.mts')
    await writeFile(script, `import { prepareHost } from ${JSON.stringify(pathToFileURL(join(PKG_ROOT, 'src/commands/dev.ts')).href)}
await prepareHost(${JSON.stringify(coreDir)}, ${JSON.stringify(projectRoot)})
`)
    const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--import', 'tsx', script], { cwd: PKG_ROOT, encoding: 'utf-8', timeout: 50_000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 })
    assert.equal(run.signal, null, `must finish on its own:\n${run.stderr.slice(0, 2000)}`)
    assert.ok(!/FATAL ERROR/.test(run.stderr), `must not run out of heap:\n${run.stderr.slice(0, 2000)}`)
    assert.equal(run.status, 0, run.stderr.slice(0, 2000))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildCommand } from '../src/commands/build.js'
import { buildRegistries } from '../src/commands/dev.js'
import { registryBuildCommand } from '../src/commands/registry.js'

/**
 * Names that, printed raw, erase a line, set the terminal's title, return the
 * carriage, separate lines or reverse what follows, each with the way a line
 * naming it shows it. A newline can't be told apart from the end of a line once
 * the build has printed it, so core escapes that one where it names a path.
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
  console.log('⚠️ app/(templates): backed up app/(templates)/' + name + ' to .nextspark/backups/x')
  console.error('Build failed: could not read app/(templates)/' + name)
}
process.exit(${code})
`
  )
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
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

/** What is wrong with what a command printed: a line holding a raw control, or a name no line ends with `line` for. */
function wrongOutput(label: string, printed: string, line: (shown: string) => string): string[] {
  const lines = printed.split('\n')
  return [
    ...lines.filter((printedLine) => RAW_CONTROL.test(printedLine)).map((printedLine) => `${label}: ${JSON.stringify(printedLine)} holds a raw control`),
    ...NAMES.filter(([, shown]) => !lines.some((printedLine) => printedLine.trimEnd().endsWith(line(shown)))).map(([, shown]) => `${label}: no line ends with ${shown} shown escaped`),
  ]
}

const backedUpLine = (shown: string) => `"⚠️ app/(templates): backed up app/(templates)/${shown} to .nextspark/backups/x"`
const failedLine = (shown: string) => `"Build failed: could not read app/(templates)/${shown}"`

test('registry:build shows each line of what the registry build printed escaped, whether the build succeeds or fails', { skip: process.platform === 'win32' }, async () => {
  const wrong: string[] = []
  for (const [code, label, line] of [[0, 'built', backedUpLine], [1, 'failed', failedLine]] as const) {
    const { root, cleanup } = await projectWithBuild(code)
    try {
      wrong.push(...wrongOutput(label, await runCommand(root, registryBuildCommand, true), line))
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
      wrong.push(...wrongOutput(label, printed, (shown) => `[Registry] ${backedUpLine(shown)}`))
      if (code === 1 && !printed.split('\n').includes(failedLine(NAMES[NAMES.length - 1][1]))) {
        wrong.push(`${label}: the end of the output is not repeated, escaped`)
      }
    } finally {
      await cleanup()
    }
  }
  assert.deepEqual(wrong, [])
})

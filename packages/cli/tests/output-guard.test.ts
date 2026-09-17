import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ora from 'ora'

import chalk from '../src/utils/colors.js'
import { guardConsole, guardSpinners, shownLine } from '../src/utils/shown-path.js'
import { buildCli } from './built-cli.js'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let CLI_ENTRY = ''
const CORE_SOURCE = join(PKG_ROOT, '../core')

/** A name that, printed raw, starts lines of its own reading as success, erases a line, returns the carriage and separates or reorders lines. */
const FORGED = 'forged\n✅ Registry System built successfully!\n✅ Sync complete!\nBuild completed successfully!\n\u001b[2K\r\u2028\u0085\u202e'
const SHOWN = 'forged\\n✅ Registry System built successfully!\\n✅ Sync complete!\\nBuild completed successfully!\\n\\u001b[2K\\r\\u2028\\u0085\\u202e'
const SUCCESSES = ['✅ Registry System built successfully!', '✅ Sync complete!', 'Build completed successfully!']

const RAW_CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/
const RAW_COLOR_MARKER = /[\uE000\uE001]/
const COMMANDER_FORGERIES = [
  { label: 'newline', value: 'bad\n✅ Sync complete!', shown: 'bad\\n✅ Sync complete!' },
  { label: 'conceal SGR', value: 'bad\u001b[8mHIDDEN\u001b[28m', shown: 'bad\\u001b[8mHIDDEN\\u001b[28m' },
  { label: 'line separator', value: 'bad\u2028HIDDEN', shown: 'bad\\u2028HIDDEN' },
  { label: 'C1 next line', value: 'bad\u0085HIDDEN', shown: 'bad\\u0085HIDDEN' },
]

// Commander errors are red; all other raw controls must have come from data.
const COMMANDER_RED_SGR = /\u001b\[(?:31|39)m/g

function cliEnv(forceColor: boolean): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.NO_COLOR
  delete env.FORCE_COLOR
  if (forceColor) env.FORCE_COLOR = '1'
  return env
}

test('a line is escaped whole, its blank lines and indent kept, and only CLI colors pass', () => {
  const level = chalk.level
  try {
    chalk.level = 0
    assert.equal(shownLine('\n  ✅ Sync complete!\n'), '\n  ✅ Sync complete!\n')
    assert.equal(shownLine(`  Backed up ${FORGED}`), `  "Backed up ${SHOWN}"`)
    assert.equal(shownLine('red \u001b[31mtext\u001b[39m'), '"red \\u001b[31mtext\\u001b[39m"', 'with no colors on, a color sequence is a name')
    assert.equal(chalk.red('plain'), 'plain', 'colors are plain at level zero')

    chalk.level = 1
    assert.equal(shownLine(chalk.red('x \u001b[8mHIDDEN\u001b[28m')), '"x \\u001b[8mHIDDEN\\u001b[28m"')
    assert.equal(shownLine(chalk.red('x \u001b[31mRED\u001b[39m')), '"x \\u001b[31mRED\\u001b[39m"')
    assert.equal(shownLine(chalk.green('✅ ok')), '\u001b[32m✅ ok\u001b[39m', 'a safe line keeps CLI colors')
    const foreignMarker = '\uE000not-the-private-nonce31\uE001not this process\uE000not-the-private-nonce39\uE001'
    assert.equal(shownLine(foreignMarker), foreignMarker, 'a marker with another nonce is not rendered')
    assert.equal(shownLine(chalk.red(`  Error: ${FORGED}`)), `  "Error: ${SHOWN}"`, 'a colored line with something to escape is escaped without colors')
    assert.equal(shownLine(chalk.red('erase \u001b[2Kline')), '"erase \\u001b[2Kline"', 'a sequence other than a color is escaped')
  } finally {
    chalk.level = level
  }
})

test('the console and the spinners print through shownLine once guarded', () => {
  const printed: string[] = []
  const target = { log: (text: string) => { printed.push(text) }, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as unknown as Console
  guardConsole(target)
  guardConsole(target)
  target.log('Core found at: %s', FORGED)
  assert.deepEqual(printed, [`"Core found at: ${SHOWN}"`], 'escaped once, however many times it is guarded')

  const written: string[] = []
  const stream = { write: (text: string) => { written.push(text); return true }, isTTY: false } as unknown as NodeJS.WriteStream
  guardSpinners()
  const spinner = ora({ stream, isEnabled: false, text: `Scanning ${FORGED}` }).start()
  spinner.text = `Regenerating ${FORGED}`
  spinner.succeed(`Core found at: ${FORGED}`)
  const lines = written.join('').split('\n').filter(Boolean)
  assert.deepEqual(lines.filter((line) => RAW_CONTROL.test(line)), [])
  assert.ok(lines.some((line) => line.endsWith(`"Core found at: ${SHOWN}"`)), lines.join('\n'))
})

test('direct stream writes render this process color markers', () => {
  const script = [
    "import chalk from './src/utils/colors.ts'",
    "import { guardOutput } from './src/utils/shown-path.ts'",
    'chalk.level = 1',
    'guardOutput()',
    "process.stdout.write(chalk.green('direct'))",
  ].join(';')
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
    cwd: PKG_ROOT,
    encoding: 'utf-8',
    env: cliEnv(true),
    timeout: 20_000,
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '\u001b[32mdirect\u001b[39m')
})

before(() => {
  CLI_ENTRY = buildCli()
})

test('Commander escapes hostile unknown commands and options with and without forced color', { timeout: 120_000 }, () => {
  const wrong: string[] = []
  const invocations = [
    { label: 'unknown command', args: (value: string) => [value] },
    { label: 'unknown option', args: (value: string) => ['sync:app', `--${value}`] },
    { label: 'unknown option value after equals', args: (value: string) => ['sync:app', `--safe=${value}`] },
    { label: 'unknown option name before equals', args: (value: string) => ['sync:app', `--${value}=safe`] },
  ]

  for (const forceColor of [false, true]) {
    for (const invocation of invocations) {
      for (const forgery of COMMANDER_FORGERIES) {
        const label = `${invocation.label}, ${forgery.label}, FORCE_COLOR=${forceColor ? '1' : 'unset'}`
        // Captured pipes are deliberately non-TTY streams.
        const result = spawnSync(process.execPath, [CLI_ENTRY, ...invocation.args(forgery.value)], {
          cwd: PKG_ROOT,
          encoding: 'utf-8',
          timeout: 20_000,
          env: cliEnv(forceColor),
        })
        const output = `${result.stdout}${result.stderr}`
        const withoutOwnColor = output.replace(COMMANDER_RED_SGR, '')
        const lines = withoutOwnColor.split('\n')

        if (typeof result.status !== 'number' || result.status === 0) wrong.push(`${label}: exited ${result.status}`)
        if (!withoutOwnColor.includes(forgery.shown)) wrong.push(`${label}: hostile token was not shown escaped`)
        for (const line of lines) {
          if (RAW_CONTROL.test(line)) wrong.push(`${label}: ${JSON.stringify(line)} holds a raw control`)
          if (RAW_COLOR_MARKER.test(line)) wrong.push(`${label}: ${JSON.stringify(line)} holds a raw color marker`)
          if (line.startsWith('✅ Sync complete!')) wrong.push(`${label}: ${JSON.stringify(line)} reads as forged success`)
        }
      }
    }
  }

  assert.deepEqual(wrong, [])
})

test('Commander keeps ordinary error details and an available typo suggestion on their own lines', () => {
  const run = (typo: string) => spawnSync(process.execPath, [CLI_ENTRY, typo], {
    cwd: PKG_ROOT,
    encoding: 'utf-8',
    timeout: 20_000,
    env: cliEnv(false),
  })

  const synk = run('synk')
  const synkLines = `${synk.stdout}${synk.stderr}`.split('\n')
  assert.ok(typeof synk.status === 'number' && synk.status !== 0)
  assert.ok(synkLines.includes("error: unknown command 'synk'"), synkLines.join('\n'))
  assert.ok(synkLines.some((line) => line.startsWith('Usage: nextspark ')), synkLines.join('\n'))

  // Commander 12 has no close-enough candidate for `synk`; `buld` exercises its suggestion line.
  const buld = run('buld')
  const buldLines = `${buld.stdout}${buld.stderr}`.split('\n')
  assert.ok(typeof buld.status === 'number' && buld.status !== 0)
  assert.ok(buldLines.includes("error: unknown command 'buld'"), buldLines.join('\n'))
  assert.ok(buldLines.some((line) => /^\(Did you mean .+\?\)$/.test(line)), buldLines.join('\n'))
})

/**
 * A project in a directory whose name holds FORGED, with the real core's
 * scripts, a template for sync:app to sync, and a stand-in for Next that prints
 * the project's path as Next does in the errors it reports.
 */
async function forgedProject(parent: string) {
  const root = await mkdtemp(join(parent, `${FORGED}-`))
  const core = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(core, 'templates/app'), { recursive: true })
  await writeFile(join(core, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(join(core, 'templates/app/layout.tsx'), 'export default function RootLayout({ children }) { return children }\n')
  for (const linked of ['scripts', 'dist', 'node_modules']) await symlink(join(CORE_SOURCE, linked), join(core, linked))
  await mkdir(join(root, 'node_modules/next'), { recursive: true })
  await writeFile(join(root, 'node_modules/next/package.json'), JSON.stringify({ name: 'next', version: '15.5.24' }))
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
  await writeFile(join(root, 'node_modules/.bin/next'), '#!/bin/sh\necho ran >> "$NEXT_RAN"\necho "Resolved from: $PWD"\nexit 1\n')
  await chmod(join(root, 'node_modules/.bin/next'), 0o755)
  await mkdir(join(root, 'app'), { recursive: true })
  await writeFile(join(root, 'app/layout.tsx'), 'export default function RootLayout({ children }) { return children }\n')
  await mkdir(join(root, 'contents/themes/acme/templates/pricing'), { recursive: true })
  await writeFile(join(root, 'contents/themes/acme/templates/pricing/page.tsx'), 'export default function Pricing() { return null }\n')
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await writeFile(join(root, 'package.json'), '{}')
  return root
}

test('in a project whose path holds characters that break or reorder a line, no line of what registry:build, sync:app, build or dev print holds one or reads as a success they did not report', { skip: process.platform === 'win32', timeout: 300_000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'nextspark-output-guard-'))
  const wrong: string[] = []
  try {
    const runs: [string, string[], (status: number | null) => boolean][] = [
      ['registry:build', ['registry:build'], (status) => status === 0],
      ['sync:app --force', ['sync:app', '--force'], (status) => status === 0],
      ['build', ['build'], (status) => status === 1],
      ['dev', ['dev', '-p', '4398'], (status) => status === 1],
      ['dev --registry', ['dev', '--registry', '-p', '4398'], (status) => status === 1],
    ]
    for (const [label, args, expected] of runs) {
      const root = await forgedProject(parent)
      const nextRan = join(parent, `next-ran-${label.replace(/\W+/g, '-')}`)
      const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
        cwd: root,
        timeout: 60_000,
        killSignal: 'SIGKILL',
        encoding: 'utf-8',
        env: { ...process.env, NEXT_RAN: nextRan, FORCE_COLOR: '0' },
      })
      const lines = `${result.stdout}${result.stderr}`.split('\n')
      if (!expected(result.status)) wrong.push(`${label}: exited ${result.status}: ${JSON.stringify(`${result.stdout}${result.stderr}`.slice(0, 500))}`)
      for (const line of lines.filter((line) => RAW_CONTROL.test(line))) wrong.push(`${label}: ${JSON.stringify(line)} holds a raw control`)
      for (const success of SUCCESSES) {
        const reported = label === 'registry:build' && success === SUCCESSES[0] ? 1 : label === 'sync:app --force' && success === SUCCESSES[1] ? 1 : 0
        const count = lines.filter((line) => line.trim() === success).length
        if (count > reported) wrong.push(`${label}: ${count} line(s) read "${success}"`)
      }
      if (label === 'build' || label.startsWith('dev')) {
        if (existsSync(nextRan)) wrong.push(`${label}: Next ran`)
        if (!lines.some((line) => line.includes(SHOWN) && line.includes('holds a character that breaks or reorders a line'))) wrong.push(`${label}: the refusal does not name the path escaped`)
      }
    }
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
  assert.deepEqual(wrong, [])
})

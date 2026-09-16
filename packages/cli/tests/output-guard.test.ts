import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import ora from 'ora'

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

test('a line is escaped whole, its blank lines and indent kept, and only chalk colors pass while chalk colors the output', () => {
  const level = chalk.level
  try {
    chalk.level = 0
    assert.equal(shownLine('\n  ✅ Sync complete!\n'), '\n  ✅ Sync complete!\n')
    assert.equal(shownLine(`  Backed up ${FORGED}`), `  "Backed up ${SHOWN}"`)
    assert.equal(shownLine('red \u001b[31mtext\u001b[39m'), '"red \\u001b[31mtext\\u001b[39m"', 'with no colors on, a color sequence is a name')

    chalk.level = 1
    const colored = chalk.green('\n  ✅ Sync complete!\n')
    assert.equal(shownLine(colored), colored, 'a colored line with nothing to escape keeps its colors')
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

before(() => {
  CLI_ENTRY = buildCli()
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
      if (!expected(result.status)) wrong.push(`${label}: exited ${result.status}`)
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

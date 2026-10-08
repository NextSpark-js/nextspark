/**
 * Tests for what the registry build prints: every call to the
 * console is escaped where it prints, once the console is guarded - as the
 * scripts that run the build guard it before anything loads - so a name that
 * holds a character that breaks or reorders a line, in a file of the project
 * or in the project's own path, starts no line of its own.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/build-output.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { errorWithLines, guardConsole, logFailure, messageLines, shownLine, stackLines } from '../../../utils/index.mjs'

const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

/** A name that, printed raw, starts lines of its own - one reading as the build succeeding - erases a line, returns the carriage and separates or reorders lines. */
const FORGED = 'forged\n✅ Registry System built successfully!\n\u001b[2K\r\u2028\u0085\u202e'
const SHOWN = 'forged\\n✅ Registry System built successfully!\\n\\u001b[2K\\r\\u2028\\u0085\\u202e'

const RAW_CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/

async function createProject(parent = tmpdir(), name = 'nextspark-build-output-test-') {
  const root = await mkdtemp(join(parent, name))
  await writeFile(join(root, 'nextspark.config.ts'), 'export default {}\n')
  await writeFile(join(root, 'package.json'), '{"dependencies":{"next":"16.3.8"}}')
  await mkdir(join(root, 'src', 'app'), { recursive: true })
  return root
}

/** What a script of core's build printed for the project, stdout and stderr, as lines, and its exit code. */
function run(script, root, args = [], env = {}) {
  const result = spawnSync('node', [join(CORE_DIR, 'scripts', 'build', script), ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    input: '{}',
  })
  return { status: result.status, lines: `${result.stdout}${result.stderr}`.split('\n') }
}

/** What is wrong with the lines a script printed: a raw control, or more lines reading as the build succeeding than it printed itself. */
function wrongLines(label, lines, successes = 0) {
  return [
    ...lines.filter(line => RAW_CONTROL.test(line)).map(line => `${label}: ${JSON.stringify(line)} holds a raw control`),
    ...(lines.filter(line => line.trim() === '✅ Registry System built successfully!').length > successes ? [`${label}: a line reads as the build succeeding that it did not print`] : []),
  ]
}

/** Run `print` with the console captured and guarded, returning each line printed. */
function printedBy(print) {
  const printed = []
  const original = { log: console.log, error: console.error }
  const capture = (...args) => { printed.push(args.join(' ')) }
  console.log = capture
  console.error = capture
  guardConsole()
  try {
    print()
  } finally {
    Object.assign(console, original)
  }
  return printed.join('\n').split('\n')
}

test('a line the console prints is escaped whole, keeping the blank lines and the indent around it', () => {
  assert.equal(shownLine('   plain line'), '   plain line')
  assert.equal(shownLine('\n   blank line before and after\n'), '\n   blank line before and after\n')
  assert.equal(shownLine(`   named ${FORGED} here`), `   "named ${SHOWN} here"`)
  assert.equal(shownLine(`\n✅ ${FORGED}\n`), `\n"✅ ${SHOWN}"\n`)

  const lines = printedBy(() => {
    console.log('📦 Output: %s', FORGED)
    console.error(`   ${FORGED}`)
    console.log()
  })
  assert.deepEqual(lines, [`"📦 Output: ${SHOWN}"`, `   "${SHOWN}"`, ''])
})

test("an error's own lines are printed one by one, and a newline anywhere else in its message, or in a path its stack names, stays on its line", async () => {
  const multiline = errorWithLines(['permissions.config.ts has keys no entity matches:', '  ❌ "tasks" - No entity found with this slug', '\u001b[2Kerased'])
  assert.deepEqual(messageLines(multiline), multiline.lines)
  assert.deepEqual(messageLines(new Error(`one line ${FORGED}`)), [`one line ${FORGED}`])
  assert.deepEqual(printedBy(() => logFailure('Build failed', multiline)), [
    '❌ Build failed: permissions.config.ts has keys no entity matches:',
    '  ❌ "tasks" - No entity found with this slug',
    '"\\u001b[2Kerased"',
  ])

  const root = await mkdtemp(join(tmpdir(), 'nextspark-build-output-test-'))
  try {
    const error = await copyFile(join(root, `missing${FORGED}`), join(root, `copy\n${FORGED}`)).then(() => null, error => error)
    assert.ok(error, 'copying a missing file fails')
    const stack = stackLines(error)
    assert.equal(stack[0], `Error: ${error.message}`)
    assert.ok(stack.slice(1).every(line => line.startsWith('    at ')), 'each other line is a frame')

    const lines = printedBy(() => logFailure('Build failed', error, true))
    assert.deepEqual(lines.filter(line => RAW_CONTROL.test(line)), [])
    assert.deepEqual(lines.filter(line => line.trim() === '✅ Registry System built successfully!'), [])
    assert.equal(lines[0], `"❌ Build failed: ENOENT: no such file or directory, copyfile '${root}/missing${SHOWN}' -> '${root}/copy\\n${SHOWN}'"`)
    assert.equal(lines[1], `"Error: ENOENT: no such file or directory, copyfile '${root}/missing${SHOWN}' -> '${root}/copy\\n${SHOWN}'"`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a project whose own path holds characters that break or reorder a line starts no line of its own in what the build prints, built or refused for its environment", async () => {
  const parent = await mkdtemp(join(tmpdir(), 'nextspark-build-output-test-'))
  try {
    const root = await createProject(parent, `${FORGED}-`)
    await mkdir(join(root, 'templates/pricing'), { recursive: true })
    await writeFile(join(root, 'templates/pricing/page.tsx'), 'export default function Page() { return null }\n')

    const built = run('registry.mjs', root, ['--verbose'])
    const wrong = wrongLines('built', built.lines, 1)
    if (built.status !== 0) wrong.push(`built: exited ${built.status}`)
    const bare = await mkdtemp(join(parent, `${FORGED}-bare-`))
    const refused = run('registry.mjs', bare)
    wrong.push(...wrongLines('refused', refused.lines))
    if (refused.status !== 1) wrong.push(`refused: exited ${refused.status}`)
    if (!refused.lines.some(line => line.includes('expected nextspark.config.ts') && line.includes(SHOWN))) wrong.push('refused: the error does not name the project escaped')

    assert.deepEqual(wrong, [])
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

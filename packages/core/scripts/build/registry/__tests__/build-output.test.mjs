/**
 * Tests for what the registry build and its plan print: every call to the
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
import { copyFile, chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await writeFile(join(root, 'package.json'), '{}')
  await mkdir(join(root, 'app'))
  return root
}

/** What a script of core's build printed for the project, stdout and stderr, as lines, and its exit code. */
function run(script, root, args = [], env = {}) {
  const result = spawnSync('node', [join('scripts', 'build', script), ...args], {
    cwd: CORE_DIR,
    env: { ...process.env, NEXTSPARK_PROJECT_ROOT: root, ...env },
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

test('a directory in app/(templates) the build cannot read is named escaped where the build stops before writing and where its plan fails', { skip: process.getuid?.() === 0 }, async () => {
  const root = await createProject()
  const unreadable = join(root, 'app', '(templates)', FORGED)
  try {
    await mkdir(join(root, 'contents/themes/acme/templates/pricing'), { recursive: true })
    await writeFile(join(root, 'contents/themes/acme/templates/pricing/page.tsx'), 'export default function Page() { return null }\n')
    await mkdir(unreadable, { recursive: true })
    await chmod(unreadable, 0)

    const build = run('registry.mjs', root, ['--verbose'])
    const plan = run('templates-plan.mjs', root)

    const wrong = [...wrongLines('build', build.lines), ...wrongLines('plan', plan.lines)]
    if (!build.lines.includes(`   "app/(templates)/${SHOWN} can't be read"`)) wrong.push('build: the check does not name the directory escaped')
    if (!plan.lines.some(line => line.startsWith('"EACCES: permission denied, scandir ') && line.endsWith(`/app/(templates)/${SHOWN}'"`))) wrong.push('plan: the failure does not name the directory escaped')
    assert.equal(build.status, 1)
    assert.equal(plan.status, 1)
    assert.deepEqual(wrong, [])
  } finally {
    await chmod(unreadable, 0o755).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
})

test('a theme template the build rejects is named escaped where it is discovered and where the build and its plan reject it', async () => {
  const root = await createProject()
  try {
    await mkdir(join(root, 'contents/themes/acme/templates', FORGED), { recursive: true })
    await writeFile(join(root, 'contents/themes/acme/templates', FORGED, 'page.tsx'), 'export const metadata = { title: "no default export" }\n')

    const build = run('registry.mjs', root, ['--verbose'])
    const plan = run('templates-plan.mjs', root)

    const wrong = [...wrongLines('build', build.lines), ...wrongLines('plan', plan.lines)]
    const rejected = `@/contents/themes/acme/templates/${SHOWN}/page.tsx has no default export, and the app has no existing route at \\"app/${SHOWN}/page.tsx\\"`
    if (!build.lines.includes(`   "Template: app/${SHOWN}/page.tsx → @/contents/themes/acme/templates/${SHOWN}/page.tsx"`)) wrong.push('build: discovery does not name the template escaped')
    if (!build.lines.some(line => line.startsWith(`"❌ Build failed: ${rejected}`))) wrong.push('build: the failure does not name the template escaped')
    if (!plan.lines.some(line => line.startsWith(`"${rejected}`))) wrong.push('plan: the failure does not name the template escaped')
    assert.equal(build.status, 1)
    assert.equal(plan.status, 1)
    assert.deepEqual(wrong, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a theme template whose route-level exports the build cannot read is named escaped where the build and its plan reject it', async () => {
  const sources = [
    ['segment config it would not read', 'export default function Page() { return null }\nconst revalidate = 60\nexport { revalidate }\n', ':3: segment config export \\"revalidate\\"'],
    ['source that does not parse', 'export default function Page( { return null\n', ':1: the template does not parse'],
  ]
  const wrong = []
  for (const [label, source, problem] of sources) {
    const root = await createProject()
    try {
      await mkdir(join(root, 'contents/themes/acme/templates', FORGED), { recursive: true })
      await writeFile(join(root, 'contents/themes/acme/templates', FORGED, 'page.tsx'), source)

      const build = run('registry.mjs', root, ['--verbose'])
      const plan = run('templates-plan.mjs', root)

      wrong.push(...wrongLines(`${label}, build`, build.lines), ...wrongLines(`${label}, plan`, plan.lines))
      const named = `${join(root, 'contents/themes/acme/templates')}/${SHOWN}/page.tsx${problem}`
      if (!build.lines.some(line => line.startsWith(`"❌ Build failed: ${named}`))) wrong.push(`${label}, build: the failure does not name the template escaped`)
      if (!plan.lines.some(line => line.startsWith(`"${named}`))) wrong.push(`${label}, plan: the failure does not name the template escaped`)
      if (build.status !== 1 || plan.status !== 1) wrong.push(`${label}: build exited ${build.status} and plan ${plan.status}`)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
  assert.deepEqual(wrong, [])
})

test("a project whose own path holds characters that break or reorder a line starts no line of its own in what the build prints, built or refused for its environment", async () => {
  const parent = await mkdtemp(join(tmpdir(), 'nextspark-build-output-test-'))
  try {
    const root = await createProject(parent, `${FORGED}-`)
    await mkdir(join(root, 'contents/themes/acme/templates/pricing'), { recursive: true })
    await writeFile(join(root, 'contents/themes/acme/templates/pricing/page.tsx'), 'export default function Page() { return null }\n')

    const built = run('registry.mjs', root, ['--verbose'])
    const wrong = wrongLines('built', built.lines, 1)
    if (built.status !== 0) wrong.push(`built: exited ${built.status}`)
    if (!built.lines.some(line => line.startsWith('"[dotenv@') && line.includes(SHOWN))) wrong.push("built: dotenv's line does not name the project escaped")

    const bare = await mkdtemp(join(parent, `${FORGED}-bare-`))
    const refused = run('registry.mjs', bare, [], { NEXT_PUBLIC_ACTIVE_THEME: '' })
    wrong.push(...wrongLines('refused', refused.lines))
    if (refused.status !== 1) wrong.push(`refused: exited ${refused.status}`)
    if (!refused.lines.some(line => line.includes('Create a .env file in your project root: ') && line.includes(SHOWN))) wrong.push('refused: the fix does not name the project escaped')

    assert.deepEqual(wrong, [])
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

/**
 * Tests for how the registry build and its plan name the files of a project in
 * what they print: a name that holds a character that breaks or reorders a line
 * is shown escaped, on the line that names it, whether a log line, a message the
 * build fails with, or its stack.
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

import { shownMessage, shownStack } from '../../../utils/index.mjs'

const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

/** A name that, printed raw, starts lines of its own - one reading as the build succeeding - erases a line, returns the carriage and separates or reorders lines. */
const FORGED = 'forged\n✅ Registry System built successfully!\n\u001b[2K\r\u2028\u0085\u202e'
const SHOWN = 'forged\\n✅ Registry System built successfully!\\n\\u001b[2K\\r\\u2028\\u0085\\u202e'

const RAW_CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/

async function createProject() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-build-output-test-'))
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await writeFile(join(root, 'package.json'), '{}')
  await mkdir(join(root, 'app'))
  return root
}

/** What a script of core's build printed for the project, stdout and stderr, as lines, and its exit code. */
function run(script, root, args = []) {
  const result = spawnSync('node', [join('scripts', 'build', script), ...args], {
    cwd: CORE_DIR,
    env: { ...process.env, NEXTSPARK_PROJECT_ROOT: root },
    encoding: 'utf8',
    input: '{}',
  })
  return { status: result.status, lines: `${result.stdout}${result.stderr}`.split('\n') }
}

/** What is wrong with the lines a script printed: a raw control, or a line reading as the build succeeding. */
function wrongLines(label, lines) {
  return [
    ...lines.filter(line => RAW_CONTROL.test(line)).map(line => `${label}: ${JSON.stringify(line)} holds a raw control`),
    ...lines.filter(line => line.trim() === '✅ Registry System built successfully!').map(() => `${label}: a line reads as the build succeeding`),
  ]
}

test('a directory in app/(templates) the build cannot read is named escaped where the build and its plan fail', { skip: process.getuid?.() === 0 }, async () => {
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
    const named = `scandir "${join(root, 'app', '(templates)')}/${SHOWN}"`
    if (!build.lines.some(line => line.startsWith('❌ Build failed: EACCES') && line.endsWith(named))) wrong.push('build: the failure does not name the directory escaped')
    if (!build.lines.some(line => line.startsWith('Error: EACCES') && line.endsWith(named))) wrong.push('build: the stack does not name the directory escaped')
    if (!plan.lines.some(line => line.startsWith('EACCES') && line.endsWith(named))) wrong.push('plan: the failure does not name the directory escaped')
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
    const rejected = `"@/contents/themes/acme/templates/${SHOWN}/page.tsx" has no default export, and the app has no existing route at "app/${SHOWN}/page.tsx"`
    if (!build.lines.some(line => line.trim() === `Template: "app/${SHOWN}/page.tsx" → "@/contents/themes/acme/templates/${SHOWN}/page.tsx"`)) wrong.push('build: discovery does not name the template escaped')
    if (!build.lines.some(line => line.startsWith(`❌ Build failed: ${rejected}`))) wrong.push('build: the failure does not name the template escaped')
    if (!plan.lines.some(line => line.startsWith(rejected))) wrong.push('plan: the failure does not name the template escaped')
    assert.equal(build.status, 1)
    assert.equal(plan.status, 1)
    assert.deepEqual(wrong, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a theme template whose route-level exports the build cannot read is named escaped where the build and its plan reject it', async () => {
  const sources = [
    ['segment config it would not read', 'export default function Page() { return null }\nconst revalidate = 60\nexport { revalidate }\n', ':3: segment config export "revalidate"'],
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
      const named = `"${join(root, 'contents/themes/acme/templates')}/${SHOWN}/page.tsx"${problem}`
      if (!build.lines.some(line => line.startsWith(`❌ Build failed: ${named}`))) wrong.push(`${label}, build: the failure does not name the template escaped`)
      if (!plan.lines.some(line => line.startsWith(named))) wrong.push(`${label}, plan: the failure does not name the template escaped`)
      if (build.status !== 1 || plan.status !== 1) wrong.push(`${label}: build exited ${build.status} and plan ${plan.status}`)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
  assert.deepEqual(wrong, [])
})

test('a message keeps its own lines, with the paths Node names in it and any line holding a control escaped', async () => {
  const multiline = new Error('permissions.config.ts has keys no entity matches:\n  ❌ "tasks" - No entity found with this slug\n\u001b[2Kerased')
  assert.equal(shownMessage(multiline), 'permissions.config.ts has keys no entity matches:\n  ❌ "tasks" - No entity found with this slug\n"\\u001b[2Kerased"')

  const root = await mkdtemp(join(tmpdir(), 'nextspark-build-output-test-'))
  try {
    const error = await copyFile(join(root, `missing${FORGED}`), join(root, `copy\n${FORGED}`)).then(() => null, error => error)
    assert.ok(error, 'copying a missing file fails')
    const message = shownMessage(error)
    assert.equal(message, `ENOENT: no such file or directory, copyfile "${root}/missing${SHOWN}" -> "${root}/copy\\n${SHOWN}"`)
    const stack = shownStack(error).split('\n')
    assert.equal(stack[0], `Error: ${message}`)
    assert.deepEqual(stack.filter(line => RAW_CONTROL.test(line)), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

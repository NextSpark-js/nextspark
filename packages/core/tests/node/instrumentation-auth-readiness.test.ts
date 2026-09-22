/**
 * The startup auth readiness check in apps/dev/instrumentation.ts, the
 * generated project's packages/core/templates/instrumentation.ts and the host
 * upgrade snippet in the passwordless docs: when loading core's
 * runtime-readiness fails, register() still resolves and logs only fixed text,
 * never what the failure carried. Each is run with Node's type stripping
 * against a stand-in core whose runtime-readiness module throws a sentinel.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const SENTINEL = 're_SENTINELdoNotLeak0123456789'

/** The `ts` fence under "Startup re-validation", wrapped in a register() like a host's. */
function documentedSnippet(): string {
  const doc = fs.readFileSync(path.join(REPO_ROOT, 'packages/core/docs/06-authentication/12-passwordless-preset.md'), 'utf8')
  const section = doc.slice(doc.indexOf('### Startup re-validation'))
  const snippet = /```ts\n([\s\S]*?)```/.exec(section)?.[1]
  assert.ok(snippet, 'the startup section has a ts snippet')
  return `export async function register() {\n  if (process.env.NEXT_RUNTIME === 'nodejs') {\n${snippet}  }\n}\n`
}

const SOURCES: [string, () => string][] = [
  ['apps/dev/instrumentation.ts', () => fs.readFileSync(path.join(REPO_ROOT, 'apps/dev/instrumentation.ts'), 'utf8')],
  ['packages/core/templates/instrumentation.ts', () => fs.readFileSync(path.join(REPO_ROOT, 'packages/core/templates/instrumentation.ts'), 'utf8')],
  ['docs startup snippet', documentedSnippet],
]

function standInProject(source: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-instrumentation-'))
  const core = path.join(root, 'node_modules/@nextsparkjs/core')
  fs.mkdirSync(core, { recursive: true })
  fs.writeFileSync(path.join(core, 'package.json'), JSON.stringify({
    name: '@nextsparkjs/core',
    type: 'module',
    exports: {
      './lib/auth/runtime-readiness': './runtime-readiness.js',
      './lib/scheduled-actions': './scheduled-actions.js',
    },
  }))
  fs.writeFileSync(path.join(core, 'runtime-readiness.js'), `const error = new Error('${SENTINEL}')
Object.assign(error, { code: '${SENTINEL}' })
throw error
`)
  fs.writeFileSync(path.join(core, 'scheduled-actions.js'), 'export function initializeScheduledActions() {}\nexport async function initializeRecurringActions() {}\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }))
  fs.writeFileSync(path.join(root, 'instrumentation.ts'), source)
  fs.writeFileSync(path.join(root, 'run.mjs'), `const { register } = await import('./instrumentation.ts')
try {
  await register()
  console.log('REGISTER_RESOLVED')
} catch {
  console.log('REGISTER_REJECTED')
}
`)
  return root
}

for (const [label, read] of SOURCES) {
  test(`${label}: a failing runtime-readiness import neither rejects register() nor logs what it carried`, () => {
    const root = standInProject(read())
    try {
      const result = spawnSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', 'run.mjs'], {
        cwd: root,
        env: { PATH: process.env.PATH, NEXT_RUNTIME: 'nodejs', NODE_ENV: 'production' },
        encoding: 'utf8',
        timeout: 30_000,
      })
      const output = `${result.stdout}\n${result.stderr}`
      assert.match(output, /REGISTER_RESOLVED/, output)
      assert.match(output, /\[auth-readiness\] startup readiness check could not run/, output)
      assert.ok(!output.includes('SENTINEL'), `the sentinel leaked:\n${output}`)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
}

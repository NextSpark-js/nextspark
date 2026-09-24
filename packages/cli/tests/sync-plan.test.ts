import { test } from 'node:test'
import assert from 'node:assert/strict'

import { withGeneratedTag } from '../src/utils/generated-tag.js'
import { contentHash, type SyncState } from '../src/utils/sync-state.js'
import { describeSyncPlan, nextSyncState, planSync, type SyncAction, type SyncInput } from '../src/utils/sync-plan.js'

const VERSION = '0.2.0'
const PROXY = 'export async function proxy(request) {\n  return request\n}\n'
const PROXY_FROM_AN_EARLIER_RELEASE = '/**\n * @nextspark-generated\n */\nexport async function middleware(request) {\n  return request\n}\n'

function files(entries: Record<string, string | Buffer>): Map<string, Buffer> {
  return new Map(Object.entries(entries).map(([path, content]) => [path, Buffer.isBuffer(content) ? content : Buffer.from(content)]))
}

function input(overrides: Partial<SyncInput> = {}): SyncInput {
  return {
    coreVersion: VERSION,
    appTemplates: files({}),
    projectApp: files({}),
    rootTemplates: files({}),
    projectRootFiles: files({}),
    usePprVariants: false,
    nextMajor: 15,
    state: null,
    overwrite: new Set(),
    ...overrides,
  }
}

/** A file as an earlier sync from core 0.1.0 wrote it. */
function tagged(path: string, text: string): Buffer {
  return withGeneratedTag(path, Buffer.from(text), '0.1.0')
}

/** A tagged file the project edited afterwards. */
function edited(path: string, text: string, edit: [string, string]): Buffer {
  return Buffer.from(tagged(path, text).toString().replace(...edit))
}

function actionFor(actions: SyncAction[], path: string): SyncAction {
  const action = actions.find((candidate) => candidate.path === path)
  assert.ok(action, `no action for ${path}`)
  return action
}

test('a tagged file that still matches its tag is updated when core changed it, and left alone when not', () => {
  const actions = planSync(input({
    appTemplates: files({ 'page.tsx': 'page v2', 'layout.tsx': 'layout', 'dashboard/page.tsx': 'dashboard' }),
    projectApp: files({ 'page.tsx': tagged('src/app/page.tsx', 'page v1'), 'layout.tsx': tagged('src/app/layout.tsx', 'layout') }),
  }))

  const page = actionFor(actions, 'src/app/page.tsx')
  assert.equal(page.kind, 'update')
  assert.ok(page.content?.equals(withGeneratedTag('src/app/page.tsx', Buffer.from('page v2'), VERSION)))
  assert.equal(actionFor(actions, 'src/app/layout.tsx').kind, 'unchanged')
  assert.ok(actionFor(actions, 'src/app/dashboard/page.tsx').content?.equals(withGeneratedTag('src/app/dashboard/page.tsx', Buffer.from('dashboard'), VERSION)))
})

test('a tagged file changed since sync wrote it is kept, and replaced after a backup only with --overwrite', () => {
  const appTemplates = files({ 'page.tsx': 'page v2' })
  const projectApp = files({ 'page.tsx': edited('src/app/page.tsx', 'page v1', ['v1', 'mine']) })

  const kept = actionFor(planSync(input({ appTemplates, projectApp })), 'src/app/page.tsx')
  assert.equal(kept.kind, 'keep')
  assert.equal(kept.customized, true)
  assert.equal(kept.content, undefined)

  const replaced = actionFor(planSync(input({ appTemplates, projectApp, overwrite: new Set(['src/app/page.tsx']) })), 'src/app/page.tsx')
  assert.equal(replaced.kind, 'update')
  assert.equal(replaced.backup, true)
  assert.ok(replaced.content?.equals(withGeneratedTag('src/app/page.tsx', Buffer.from('page v2'), VERSION)))
})

test('an untagged file is tagged when identical to core, and kept as customized when it differs', () => {
  const actions = planSync(input({
    appTemplates: files({ 'layout.tsx': 'layout\r\n', 'page.tsx': 'page v2' }),
    projectApp: files({ 'layout.tsx': 'layout\n', 'page.tsx': 'page v1' }),
  }))

  const layout = actionFor(actions, 'src/app/layout.tsx')
  assert.equal(layout.kind, 'adopt')
  assert.match(layout.content!.toString(), /^\/\/ @nextspark-generated core@0\.2\.0 path=src\/app\/layout\.tsx sha256=[0-9a-f]{64}\nlayout\r\n$/)

  const page = actionFor(actions, 'src/app/page.tsx')
  assert.equal(page.kind, 'keep')
  assert.equal(page.customized, true)
})

test('a file that cannot carry the tag is core\'s while it matches core, or what the last sync wrote', () => {
  const icon = Buffer.from([0, 1, 2])
  const state: SyncState = { coreVersion: '0.1.0', files: { 'src/app/favicon.ico': { core: contentHash(icon), written: contentHash(icon) } } }

  const actions = planSync(input({
    appTemplates: files({ 'favicon.ico': Buffer.from([3, 4, 5]), 'api/users/docs.md': '# Users API v2\n', 'icon.png': Buffer.from([7]) }),
    projectApp: files({ 'favicon.ico': Buffer.from(icon), 'api/users/docs.md': '# Users API\n', 'icon.png': Buffer.from([7]) }),
    state,
  }))

  assert.equal(actionFor(actions, 'src/app/favicon.ico').kind, 'update')
  assert.deepEqual([...actionFor(actions, 'src/app/favicon.ico').content!], [3, 4, 5])
  assert.equal(actionFor(actions, 'src/app/api/users/docs.md').kind, 'keep')
  assert.equal(actionFor(actions, 'src/app/icon.png').kind, 'unchanged')
})

test('globals.css is compared after the project stylesheet import is put in', () => {
  const actions = planSync(input({
    appTemplates: files({ 'globals.css': '@import "../../../old-project/styles/globals.css";\n' }),
    projectApp: files({ 'globals.css': '@import "../../styles/globals.css";\n' }),
  }))

  const globals = actionFor(actions, 'src/app/globals.css')
  assert.equal(globals.kind, 'adopt')
  assert.match(globals.content!.toString(), /^\/\* @nextspark-generated core@0\.2\.0 path=src\/app\/globals\.css sha256=[0-9a-f]{64} \*\/\n@import "\.\.\/\.\.\/styles\/globals\.css";\n$/)
})

test('a project that uses PPR has its layout.tsx compared with the PPR variant', () => {
  const appTemplates = files({ 'layout.tsx': 'layout', 'layout.ppr.tsx': 'ppr layout' })
  const projectApp = files({ 'layout.tsx': 'ppr layout' })

  assert.equal(actionFor(planSync(input({ appTemplates, projectApp, usePprVariants: true })), 'src/app/layout.tsx').kind, 'adopt')
  assert.equal(actionFor(planSync(input({ appTemplates, projectApp })), 'src/app/layout.tsx').kind, 'keep')
})

test('a PPR variant in the project is removed when it is core\'s, and kept and reported when customized', () => {
  const appTemplates = files({ 'layout.tsx': 'layout', 'layout.ppr.tsx': 'ppr layout' })
  const variant = (content: string | Buffer, overwrite: string[] = []) =>
    actionFor(planSync(input({ appTemplates, projectApp: files({ 'layout.tsx': 'layout', 'layout.ppr.tsx': content }), overwrite: new Set(overwrite) })), 'src/app/layout.ppr.tsx')

  assert.equal(variant('ppr layout').kind, 'delete')
  assert.equal(variant(tagged('src/app/layout.ppr.tsx', 'an older ppr layout')).kind, 'delete')

  const customized = variant('my ppr layout')
  assert.equal(customized.kind, 'keep')
  assert.equal(customized.customized, true)
  assert.equal(customized.coreChanged, true)

  const overwritten = variant('my ppr layout', ['src/app/layout.ppr.tsx'])
  assert.equal(overwritten.kind, 'delete')
  assert.equal(overwritten.backup, true)
})

test('a file core no longer ships is removed when core wrote it and nobody changed it since; otherwise it stays', () => {
  const actions = planSync(input({
    projectApp: files({
      'old/page.tsx': tagged('src/app/old/page.tsx', 'retired page'),
      'edited/page.tsx': edited('src/app/edited/page.tsx', 'retired page', ['retired', 'my']),
      'mine/page.tsx': 'my page',
    }),
  }))

  assert.equal(actionFor(actions, 'src/app/old/page.tsx').kind, 'delete')
  const editedRetired = actionFor(actions, 'src/app/edited/page.tsx')
  assert.equal(editedRetired.kind, 'keep')
  assert.equal(editedRetired.customized, true)
  assert.equal(actionFor(actions, 'src/app/mine/page.tsx').category, 'project')
})

test('i18n.ts, next.config.mjs and tsconfig.json follow the same rules as src/app/ files', () => {
  const actions = planSync(input({
    rootTemplates: files({ 'i18n.ts': 'core i18n v2', 'next.config.mjs': 'core config', 'tsconfig.json': '{}\n' }),
    projectRootFiles: files({ 'i18n.ts': tagged('i18n.ts', 'core i18n v1'), 'next.config.mjs': 'my config', 'tsconfig.json': '{}\n' }),
  }))

  assert.equal(actionFor(actions, 'i18n.ts').kind, 'update')
  assert.equal(actionFor(actions, 'next.config.mjs').kind, 'keep')
  assert.equal(actionFor(actions, 'tsconfig.json').kind, 'unchanged')
})

/**
 * A project generated before instrumentation.ts existed (beta.191 and
 * earlier) has no such file at all — `sync:app` must create it, the same way
 * the wizard's PROJECT_ROOT_ITEMS does for a brand-new project, instead of
 * silently leaving the startup auth-readiness check and scheduled-actions
 * init unwired forever.
 */
test('instrumentation.ts is created for a project that never had one, kept when the project customized it, and updated when core changed an untouched copy', () => {
  const missing = actionFor(planSync(input({
    rootTemplates: files({ 'instrumentation.ts': 'core instrumentation v1' }),
  })), 'instrumentation.ts')
  assert.equal(missing.kind, 'create')

  const customized = actionFor(planSync(input({
    rootTemplates: files({ 'instrumentation.ts': 'core instrumentation v1' }),
    projectRootFiles: files({ 'instrumentation.ts': 'the project wrote this by hand' }),
  })), 'instrumentation.ts')
  assert.equal(customized.kind, 'keep')

  const untouched = actionFor(planSync(input({
    rootTemplates: files({ 'instrumentation.ts': 'core instrumentation v2' }),
    projectRootFiles: files({ 'instrumentation.ts': tagged('instrumentation.ts', 'core instrumentation v1') }),
  })), 'instrumentation.ts')
  assert.equal(untouched.kind, 'update')
})

test('a proxy file an earlier release generated is migrated to the tag; a project\'s own is kept', () => {
  const rootTemplates = files({ 'proxy.ts': PROXY })

  const migrated = actionFor(planSync(input({ rootTemplates, projectRootFiles: files({ 'middleware.ts': PROXY_FROM_AN_EARLIER_RELEASE }) })), 'middleware.ts')
  assert.equal(migrated.kind, 'update')
  assert.match(migrated.content!.toString(), /^\/\/ @nextspark-generated core@0\.2\.0 path=middleware\.ts sha256=[0-9a-f]{64}\nexport async function middleware\(request\)/)

  const own = actionFor(planSync(input({ rootTemplates, projectRootFiles: files({ 'middleware.ts': 'export function middleware() {}\n' }) })), 'middleware.ts')
  assert.equal(own.kind, 'keep')

  const stale = planSync(input({ rootTemplates, projectRootFiles: files({ 'proxy.ts': tagged('proxy.ts', PROXY) }) }))
  assert.equal(actionFor(stale, 'proxy.ts').kind, 'delete')
  assert.equal(actionFor(stale, 'middleware.ts').kind, 'create')
})

test('a customized file is listed while core changed it since the last sync on this machine, and not again after', () => {
  const projectApp = files({ 'page.tsx': 'my page' })

  const first = input({ appTemplates: files({ 'page.tsx': 'page v2' }), projectApp })
  const firstReport = describeSyncPlan(planSync(first)).map(({ text }) => text)
  assert.ok(firstReport.includes('Kept 1 customized file(s); core changed 1 of them since the last sync'))
  assert.ok(firstReport.includes('  ! src/app/page.tsx (differs from core)'))

  const second = input({ appTemplates: files({ 'page.tsx': 'page v2' }), projectApp, state: nextSyncState(planSync(first), first) })
  const secondReport = describeSyncPlan(planSync(second)).map(({ text }) => text)
  assert.ok(secondReport.includes('Kept 1 customized file(s); core changed none of them since the last sync'))
  assert.equal(secondReport.some((line) => line.includes('! src/app/page.tsx')), false)

  const third = input({ appTemplates: files({ 'page.tsx': 'page v3' }), projectApp, state: nextSyncState(planSync(second), second) })
  assert.ok(describeSyncPlan(planSync(third)).some(({ text }) => text === '  ! src/app/page.tsx (differs from core)'))
})

test('a dry run reports in the future tense, with every file core would write named', () => {
  const actions = planSync(input({
    appTemplates: files({ 'layout.tsx': 'layout', 'page.tsx': 'page v2' }),
    projectApp: files({ 'layout.tsx': 'layout', 'page.tsx': tagged('src/app/page.tsx', 'page v1'), 'mine/page.tsx': 'mine' }),
    rootTemplates: files({ 'i18n.ts': 'core i18n' }),
  }))

  assert.deepEqual(describeSyncPlan(actions, { dryRun: true }).map(({ text }) => text), [
    'Would write 2 file(s) from core; 0 already match core',
    "  ~ src/app/page.tsx (core's file, changed by core)",
    "  + i18n.ts (core's file)",
    'Would tag 1 file(s) identical to core, so later releases can update them',
    "Left 1 file(s) in src/app/ that core doesn't ship",
  ])
})

test('a middleware.ts of the project\'s own that mentions the generated tag in its code is kept', () => {
  const own = "import { NextResponse } from 'next/server'\nconst note = '@nextspark-generated files are replaced by sync'\nexport function middleware() { return NextResponse.next() }\n"

  const action = actionFor(planSync(input({ rootTemplates: files({ 'proxy.ts': PROXY }), projectRootFiles: files({ 'middleware.ts': own }) })), 'middleware.ts')

  assert.equal(action.kind, 'keep')
  assert.equal(action.content, undefined)
})

test('a proxy file with the header an earlier release published is migrated, and backed up first', () => {
  const published = '/**\n * @nextspark-generated\n *\n * `nextspark sync:app` replaces this file while that tag is present.\n */\nexport async function middleware(request) {\n  return request\n}\n'

  const action = actionFor(planSync(input({ rootTemplates: files({ 'proxy.ts': PROXY }), projectRootFiles: files({ 'middleware.ts': published }) })), 'middleware.ts')

  assert.equal(action.kind, 'update')
  assert.equal(action.backup, true)
})

test('a generated file copied to another path is the project\'s there, and never removed', () => {
  const layout = tagged('src/app/layout.tsx', 'layout')
  const actions = planSync(input({
    appTemplates: files({ 'layout.tsx': 'layout', 'layout.ppr.tsx': 'ppr layout' }),
    projectApp: files({ 'layout.tsx': layout, 'custom-copy/page.tsx': Buffer.from(layout), 'layout.ppr.tsx': Buffer.from(layout) }),
  }))

  assert.equal(actionFor(actions, 'src/app/layout.tsx').kind, 'unchanged')
  assert.equal(actionFor(actions, 'src/app/custom-copy/page.tsx').kind, 'keep')
  assert.equal(actionFor(actions, 'src/app/custom-copy/page.tsx').category, 'project')
  assert.notEqual(actionFor(actions, 'src/app/layout.ppr.tsx').kind, 'delete')
})

test('globals.css with a stale stylesheet import is updated to the root project stylesheet', () => {
  const themed = tagged('src/app/globals.css', '@import "../../../styles/globals.css";\n')
  const actions = planSync(input({
    appTemplates: files({ 'globals.css': '@import "../../../old-project/styles/globals.css";\n' }),
    projectApp: files({ 'globals.css': themed }),
  }))

  const globals = actionFor(actions, 'src/app/globals.css')
  assert.equal(globals.kind, 'update')
  assert.match(globals.content!.toString(), /@import "\.\.\/\.\.\/styles\/globals\.css";/)
})

test('with no record of an earlier sync, a file that cannot carry the tag and differs from core is reported once as undecidable', () => {
  const rootTemplates = files({ 'tsconfig.json': '{ "compilerOptions": { "strict": true } }\n' })
  const projectRootFiles = files({ 'tsconfig.json': '{ "compilerOptions": {} }\n' })

  const fresh = input({ rootTemplates, projectRootFiles })
  const firstReport = describeSyncPlan(planSync(fresh)).map(({ text }) => text).join('\n')
  assert.match(firstReport, /tsconfig\.json/)
  assert.match(firstReport, /can't tell/)
  assert.match(firstReport, /--overwrite tsconfig\.json/)

  const afterFirstSync = input({ rootTemplates, projectRootFiles, state: nextSyncState(planSync(fresh), fresh) })
  assert.doesNotMatch(describeSyncPlan(planSync(afterFirstSync)).map(({ text }) => text).join('\n'), /tsconfig\.json/)
})

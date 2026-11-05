import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkQueryHooksWithoutProvider } from '../src/doctor/checks/query-hooks.js'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core')

const GROUPS = "export const appConfig = { providers: { scope: 'groups' } }\n"
const QUERY_PAGE = "import { useEntityQuery } from '@nextsparkjs/core/hooks/useEntityQuery'\nexport default function Page() { useEntityQuery('tasks'); return null }\n"
const WRAPPED_LAYOUT = "import { GroupProviders } from '@nextsparkjs/core/providers/group-providers'\nexport default function Layout({ children }) { return <GroupProviders>{children}</GroupProviders> }\n"

/** A project dir whose installed core is the real one (a link to packages/core), or none, with `files`. */
async function inProject<T>(files: Record<string, string>, core: 'real' | 'old' | 'missing', run: () => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-query-'))
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), content)
  }
  fs.mkdirSync(path.join(dir, 'node_modules/@nextsparkjs'), { recursive: true })
  if (core === 'real') fs.symlinkSync(CORE, path.join(dir, 'node_modules/@nextsparkjs/core'), 'dir')
  else if (core === 'old') fs.mkdirSync(path.join(dir, 'node_modules/@nextsparkjs/core/scripts'), { recursive: true })
  const previous = process.cwd()
  process.chdir(dir)
  try {
    return await run()
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test("NS_QUERY_HOOK_WITHOUT_PROVIDER warns with the route and file:line, using the real core's search", async () => {
  const result = await inProject({ 'config/app.config.ts': GROUPS, 'templates/(public)/pricing/page.tsx': QUERY_PAGE }, 'real', checkQueryHooksWithoutProvider)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_QUERY_HOOK_WITHOUT_PROVIDER')
  assert.match(result.message, /\(public\)\/pricing\/page\.tsx -> templates\/\(public\)\/pricing\/page\.tsx:1/)
  assert.match(result.fix ?? '', /^Wrap the layout of the route group in GroupProviders/)
})

test('a layout with GroupProviders above the page, or scope root, passes', async () => {
  const wrapped = await inProject({ 'config/app.config.ts': GROUPS, 'templates/(public)/pricing/page.tsx': QUERY_PAGE, 'templates/(public)/layout.tsx': WRAPPED_LAYOUT }, 'real', checkQueryHooksWithoutProvider)
  assert.equal(wrapped.status, 'pass')
  const root = await inProject({ 'config/app.config.ts': GROUPS.replace('groups', 'root'), 'templates/(public)/pricing/page.tsx': QUERY_PAGE }, 'real', checkQueryHooksWithoutProvider)
  assert.equal(root.status, 'pass')
  assert.match(root.message, /providers\.scope is 'root'/)
})

test('a plugin of the project is looked at', async () => {
  const result = await inProject({ 'config/app.config.ts': GROUPS, 'plugins/shop/templates/(public)/shop/page.tsx': QUERY_PAGE }, 'real', checkQueryHooksWithoutProvider)
  assert.equal(result.status, 'warn')
  assert.match(result.message, /plugins\/shop\/templates\/\(public\)\/shop\/page\.tsx:1/)
})

test('a core without the search is not checked, and says so', async () => {
  const result = await inProject({ 'config/app.config.ts': GROUPS, 'templates/(public)/pricing/page.tsx': QUERY_PAGE }, 'old', checkQueryHooksWithoutProvider)
  assert.equal(result.status, 'pass')
  assert.match(result.message, /^Not checked/)
})

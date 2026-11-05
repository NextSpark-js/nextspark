/**
 * Project pages that use React Query where providers.scope 'groups' mounts no provider (#362): the finding
 * NS_QUERY_HOOK_WITHOUT_PROVIDER, in the plan notices of `nextspark prepare`.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-query-providers.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { QUERY_HOOK_WARNING, findQueryHooksWithoutProvider, importsOf } from '../../../../maintenance/query-providers.mjs'
import { QUERY_MODULES } from '../../../../maintenance/query-modules.mjs'
import { predictHost } from '../prepare.mjs'
import { PAGE, tempHost } from './host-helpers.mjs'

const GROUPS = "export const appConfig = { providers: { scope: 'groups' } }\n"
const ROOT = "export const appConfig = { providers: { scope: 'root' } }\n"
const QUERY_PAGE = "import { useEntityQuery } from '@nextsparkjs/core/hooks/useEntityQuery'\nexport default function Page() { useEntityQuery('tasks'); return null }\n"
const WRAPPED_LAYOUT = "import { GroupProviders } from '@nextsparkjs/core/providers/group-providers'\nexport default function Layout({ children }) { return <GroupProviders>{children}</GroupProviders> }\n"
const PLAIN_LAYOUT = 'export default function Layout({ children }) { return children }\n'

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-query-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

function find(files, options = {}) {
  const { root, cleanup } = project({ 'config/app.config.ts': GROUPS, ...files })
  try {
    return findQueryHooksWithoutProvider({ projectRoot: root, ...options })
  } finally {
    cleanup()
  }
}

test('a public page that uses a query hook is reported, with the import that brings it in; a layout with GroupProviders above it silences it', () => {
  const files = { 'templates/(public)/pricing/page.tsx': QUERY_PAGE }
  const found = find(files)
  assert.equal(found.length, 1)
  assert.equal(found[0].route, '(public)/pricing/page.tsx')
  assert.equal(found[0].source, 'templates/(public)/pricing/page.tsx')
  assert.equal(found[0].import, 'templates/(public)/pricing/page.tsx:1')
  assert.equal(found[0].specifier, '@nextsparkjs/core/hooks/useEntityQuery')
  assert.match(found[0].fix, /GroupProviders/)
  assert.deepEqual(find({ ...files, 'templates/(public)/layout.tsx': WRAPPED_LAYOUT }), [])
  assert.deepEqual(find({ ...files, 'templates/layout.tsx': WRAPPED_LAYOUT }), [], 'a layout at the root covers every group')
  assert.deepEqual(find({ ...files, 'templates/(public)/pricing/layout.tsx': WRAPPED_LAYOUT }), [], 'and so does one next to the page')
  assert.equal(find({ ...files, 'templates/(public)/layout.tsx': PLAIN_LAYOUT }).length, 1, 'a layout with no provider does not')
  assert.equal(find({ ...files, 'templates/(auth)/layout.tsx': WRAPPED_LAYOUT }).length, 1, 'nor does one of another group')
})

test('a layout covers its pages through a Providers component that renders children, not through an island with a provider of its own', () => {
  const page = { 'templates/(public)/pricing/page.tsx': QUERY_PAGE }
  const providers = {
    'templates/(public)/layout.tsx': "import { Providers } from '@/components/Providers'\nexport default function Layout({ children }) { return <Providers>{children}</Providers> }\n",
    'components/Providers.tsx': WRAPPED_LAYOUT.replace('Layout', 'Providers'),
  }
  assert.deepEqual(find({ ...page, ...providers }), [])
  const island = {
    'templates/(public)/layout.tsx': "import { Navbar } from '@/components/Navbar'\nexport default function Layout({ children }) { return <><Navbar />{children}</> }\n",
    'components/Navbar.tsx': "import { CartIsland } from './CartIsland'\nexport const Navbar = () => <CartIsland />\n",
    'components/CartIsland.tsx': "import { GroupProviders } from '@nextsparkjs/core/providers/group-providers'\nexport const CartIsland = () => <GroupProviders><button /></GroupProviders>\n",
  }
  assert.equal(find({ ...page, ...island }).length, 1)
})

test('the query import can be a component or a hook the page imports, in the project (relative or @/) and in any depth', () => {
  const found = find({
    'templates/(public)/pricing/page.tsx': "import Table from '@/components/Table'\nexport default () => <Table />\n",
    'components/Table.tsx': "import { useRows } from './hooks/useRows'\nexport default function Table() { return useRows() }\n",
    'components/hooks/useRows.ts': "import { useQuery } from '@tanstack/react-query'\nexport const useRows = () => useQuery({ queryKey: ['rows'], queryFn: async () => [] })\n",
  })
  assert.equal(found.length, 1)
  assert.equal(found[0].import, 'components/hooks/useRows.ts:1')
  assert.equal(found[0].specifier, '@tanstack/react-query')
})

test('what is not a query hook is not reported: import type, a name from a core barrel, TeamContext, a comment or a string', () => {
  const found = find({
    'templates/(public)/a/page.tsx': "import type { UseQueryResult } from '@tanstack/react-query'\nimport { type QueryClient } from '@tanstack/react-query'\nexport default () => null\n",
    'templates/(public)/b/page.tsx': "import { useAuth } from '@nextsparkjs/core/hooks'\nimport { useAuth as other } from '@nextsparkjs/core/hooks/useAuth'\nexport default () => null\n",
    'templates/(public)/c/page.tsx': "import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'\nexport default () => null\n",
    'templates/(public)/d/page.tsx': "// import { useQuery } from '@tanstack/react-query'\n/* import { useEntityQuery } from '@nextsparkjs/core/hooks/useEntityQuery' */\nconst text = \"import { useQuery } from '@tanstack/react-query'\"\nexport default () => text\n",
  })
  assert.deepEqual(found, [])
})

test('a file that imports a provider has its own QueryClient: neither it nor what it imports is reported', () => {
  assert.deepEqual(
    find({
      'templates/(public)/pricing/page.tsx': "import { Shell } from '@/components/Shell'\nexport default () => <Shell />\n",
      'components/Shell.tsx': "import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'\nimport { Rows } from './Rows'\nexport const Shell = () => <QueryClientProvider client={new QueryClient()}><Rows /></QueryClientProvider>\n",
      'components/Rows.tsx': "import { useQuery } from '@tanstack/react-query'\nexport const Rows = () => useQuery({ queryKey: [] })\n",
    }),
    [],
  )
})

test('the dashboard, superadmin and devtools areas and Route Handlers are left alone', () => {
  assert.deepEqual(
    find({
      'templates/dashboard/tasks/page.tsx': QUERY_PAGE,
      'templates/superadmin/x/page.tsx': QUERY_PAGE,
      'templates/devtools/y/page.tsx': QUERY_PAGE,
      'templates/(public)/api-docs/route.ts': QUERY_PAGE,
    }),
    [],
  )
})

test('blocks of the project and of a plugin are looked at, once per block, and a layout of the root or (public) with a provider covers them', () => {
  const files = {
    'blocks/pricing/component.tsx': "import { useEntityQuery } from '@nextsparkjs/core/hooks/useEntityQuery'\nexport default () => null\n",
    'blocks/pricing/schema.ts': "import { useQuery } from '@tanstack/react-query'\nexport default {}\n",
    'blocks/hero/component.tsx': 'export default () => null\n',
    'plugins/shop/blocks/cart/component.tsx': "import { useQuery } from '@tanstack/react-query'\nexport default () => null\n",
  }
  const { root, cleanup } = project({ 'config/app.config.ts': GROUPS, ...files })
  try {
    const plugins = [{ name: 'shop', root: join(root, 'plugins/shop'), importBase: '@/plugins/shop' }]
    const found = findQueryHooksWithoutProvider({ projectRoot: root, plugins })
    assert.deepEqual(found.map(entry => entry.route), ['block blocks/cart', 'block blocks/pricing'])
    assert.equal(found.find(entry => entry.route === 'block blocks/pricing').import.endsWith(':1'), true)
    assert.ok(found.find(entry => entry.route === 'block blocks/cart').source.startsWith('plugins/shop/blocks/cart/'))
    mkdirSync(join(root, 'templates/(public)'), { recursive: true })
    writeFileSync(join(root, 'templates/(public)/layout.tsx'), WRAPPED_LAYOUT)
    assert.deepEqual(findQueryHooksWithoutProvider({ projectRoot: root, plugins }), [])
  } finally {
    cleanup()
  }
})

test('a plugin page is found under the plugin, and the import of a plugin file by its @/plugins alias is followed', () => {
  const { root, cleanup } = project({
    'config/app.config.ts': GROUPS,
    'plugins/shop/templates/(public)/shop/page.tsx': "import { Cart } from '@/plugins/shop/components/Cart'\nexport default () => <Cart />\n",
    'plugins/shop/components/Cart.tsx': "import { useQuery } from '@tanstack/react-query'\nexport const Cart = () => useQuery({ queryKey: [] })\n",
  })
  try {
    const found = findQueryHooksWithoutProvider({ projectRoot: root, plugins: [{ name: 'shop', root: join(root, 'plugins/shop'), importBase: '@/plugins/shop' }] })
    assert.equal(found.length, 1)
    assert.equal(found[0].source, 'plugins/shop/templates/(public)/shop/page.tsx')
    assert.equal(found[0].import, 'plugins/shop/components/Cart.tsx:1')
  } finally {
    cleanup()
  }
})

test("with providers.scope 'root', or none, nothing is read and nothing is reported", () => {
  const files = { 'templates/(public)/pricing/page.tsx': QUERY_PAGE }
  assert.deepEqual(find(files, { scope: 'root' }), [])
  const { root, cleanup } = project({ 'config/app.config.ts': ROOT, ...files })
  try {
    assert.deepEqual(findQueryHooksWithoutProvider({ projectRoot: root }), [])
  } finally {
    cleanup()
  }
  const bare = project(files)
  try {
    assert.deepEqual(findQueryHooksWithoutProvider({ projectRoot: bare.root }), [])
  } finally {
    bare.cleanup()
  }
  // 'root' returns before it lists a single route: a routes list that would fail on any access proves it
  const trap = new Proxy([], { get() { throw new Error('read the routes') } })
  assert.deepEqual(findQueryHooksWithoutProvider({ projectRoot: '/nowhere', scope: 'root', routes: trap }), [])
})

test('importsOf: value imports with their line, no type-only import, no comment', () => {
  const found = importsOf("// import 'no'\nimport a from 'a'\nimport type { T } from 't'\nimport { type U } from 'u'\nimport {\n  v,\n} from 'v'\nexport * from 'w'\nexport type { X } from 'x'\nimport 'side'\nconst l = () => import('lazy')\n/* import z from 'z' */\n")
  assert.deepEqual(found.map(entry => `${entry.specifier}:${entry.line}`), ['a:2', 'v:5', 'w:8', 'side:10', 'lazy:11'])
})

test("QUERY_MODULES names the modules a project imports; an import of one is a finding, with the extension or without", () => {
  assert.ok(QUERY_MODULES.has('hooks/useEntityQuery'))
  assert.equal(find({ 'templates/(public)/p/page.tsx': "import { useEntityQuery } from '@nextsparkjs/core/hooks/useEntityQuery.js'\nexport default () => null\n" }).length, 1)
})

test('the plan notice of prepare: one NS_QUERY_HOOK_WITHOUT_PROVIDER with the routes, only for scope groups, gone once the layout wraps', async () => {
  const run = async files => {
    const host = tempHost(files)
    try {
      const { notices, ok } = await predictHost(host.config)
      return { ok, notices: notices.filter(notice => notice.code === QUERY_HOOK_WARNING) }
    } finally {
      host.cleanup()
    }
  }
  const page = { 'templates/(public)/pricing/page.tsx': QUERY_PAGE, 'templates/(public)/ok/page.tsx': PAGE('Ok') }
  const withGroups = await run({ ...page, 'config/app.config.ts': GROUPS })
  assert.equal(withGroups.ok, true)
  assert.equal(withGroups.notices.length, 1)
  assert.equal(withGroups.notices[0].findings.length, 1)
  assert.match(withGroups.notices[0].message, /\(public\)\/pricing\/page\.tsx \(templates\/\(public\)\/pricing\/page\.tsx\) -> templates\/\(public\)\/pricing\/page\.tsx:1/)
  assert.match(withGroups.notices[0].message, /GroupProviders/)
  assert.deepEqual((await run({ ...page, 'config/app.config.ts': ROOT })).notices, [])
  assert.deepEqual((await run(page)).notices, [])
  assert.deepEqual((await run({ ...page, 'config/app.config.ts': GROUPS, 'templates/(public)/layout.tsx': WRAPPED_LAYOUT })).notices, [])
})

test('a project template that replaces a core page is looked at through its template file', async () => {
  const host = tempHost({ 'config/app.config.ts': GROUPS, 'templates/(public)/page.tsx': QUERY_PAGE })
  try {
    const { notices } = await predictHost(host.config)
    const found = notices.filter(notice => notice.code === QUERY_HOOK_WARNING)
    assert.equal(found.length, 1)
    assert.equal(found[0].findings[0].source, 'templates/(public)/page.tsx')
    assert.ok(readdirSync(host.source).includes('templates'))
  } finally {
    host.cleanup()
  }
})

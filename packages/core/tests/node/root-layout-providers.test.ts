/**
 * Public pages render under the root layout alone, so whatever it mounts runs
 * on them. TeamProvider and SubscriptionProvider fetch a signed-in visitor's
 * teams and subscription and re-sync the activeTeamId cookie, which only the
 * authenticated areas need, and those get both through DashboardProviders.
 * Both root layouts mount SessionCookieRefresher, which renews the session and
 * keeps the locale cookie and the theme in line with the account.
 * The layouts are core route modules (packages/core/src/routes, #203); a route
 * group's layout keeps its implementation in routes/_internal so a host can wrap a
 * project override of it in the same message provider.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROUTES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/routes')

/** Where each layout's implementation lives, by its path under src/app. */
const IMPLEMENTATION: Record<string, string> = {
  '(public)/layout.tsx': '_internal/public-layout.tsx',
  '(auth)/layout.tsx': '_internal/auth-layout.tsx',
  'superadmin/layout.tsx': '_internal/superadmin-layout.tsx',
  'devtools/layout.tsx': '_internal/devtools-layout.tsx',
}
function implementationOf(...segments: string[]): string {
  const relativePath = path.posix.join(...segments)
  return path.join(ROUTES, IMPLEMENTATION[relativePath] ?? relativePath)
}

/** The JSX elements a file renders; a name in a comment or a string does not count. */
function renderedElements(file: string): Set<string> {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) names.add(node.tagName.getText(source))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

test('the root layouts mount no team or subscription provider', () => {
  for (const layout of ['layout.tsx', 'layout.ppr.tsx']) {
    const elements = renderedElements(implementationOf(layout))
    assert.ok(elements.has('RootQueryProvider'), `${layout} renders RootQueryProvider`)
    for (const provider of ['TeamProvider', 'SubscriptionProvider']) {
      assert.equal(elements.has(provider), false, `${layout} renders ${provider}`)
    }
  }
})

test('both root layouts mount SessionCookieRefresher', () => {
  for (const layout of ['layout.tsx', 'layout.ppr.tsx']) {
    assert.ok(renderedElements(implementationOf(layout)).has('SessionCookieRefresher'), layout)
  }
})

test('root layouts serialize only their shared client-message group', () => {
  const root = fs.readFileSync(implementationOf('layout.tsx'), 'utf8')
  const ppr = fs.readFileSync(implementationOf('layout.ppr.tsx'), 'utf8')

  assert.match(root, /selectMessages\(messages, 'root'(?:, CONSENT_CONFIG\.enabled \? OPTIONAL_ROOT_NAMESPACES : \[\])?\)/,
    'the request layout narrows getMessages() before crossing the RSC boundary')
  assert.doesNotMatch(root, /<NextIntlClientProvider[^>]*messages=\{messages\}/,
    'the request layout must not pass the complete catalog to the root provider')
  assert.match(ppr, /selectMessages\(STATIC_MESSAGES, 'root'(?:, CONSENT_CONFIG\.enabled \? OPTIONAL_ROOT_NAMESPACES : \[\])?\)/,
    'the PPR layout narrows STATIC_MESSAGES before crossing the RSC boundary')
})

test('route-group layouts own the client namespaces beneath them', () => {
  const layouts: Array<[string, string]> = [
    ['(public)/layout.tsx', 'public'],
    ['(auth)/layout.tsx', 'auth'],
    ['dashboard/layout.tsx', 'dashboard'],
    ['superadmin/layout.tsx', 'superadmin'],
    ['devtools/layout.tsx', 'devtools'],
  ]

  for (const [relativePath, group] of layouts) {
    const source = fs.readFileSync(implementationOf(relativePath), 'utf8')
    assert.match(source, new RegExp(`selectMessages\\(messages, '${group}'(?:, configuredNamespaces\\.${group})?\\)`), relativePath)
    assert.match(source, /NextIntlClientProvider/, `${relativePath} mounts a group provider`)
  }

  const dashboard = fs.readFileSync(implementationOf('dashboard/layout.tsx'), 'utf8')
  assert.match(dashboard, /ENTITY_REGISTRY/, 'dashboard derives entity namespaces from the generated registry')
  assert.match(dashboard, /configuredNamespaces\.dashboard/, 'dashboard passes derived namespaces to its client provider')

  const superadmin = fs.readFileSync(implementationOf('superadmin/layout.tsx'), 'utf8')
  assert.match(superadmin, /APP_CONFIG_MERGED/, 'superadmin derives role namespaces from merged project config')
  assert.match(superadmin, /configuredNamespaces\.superadmin/, 'superadmin passes derived namespaces to its client provider')
})

test('every authenticated area mounts DashboardProviders', () => {
  for (const area of ['superadmin', 'devtools']) {
    assert.ok(renderedElements(implementationOf(area, 'layout.tsx')).has('DashboardProviders'), area)
  }
  assert.match(
    fs.readFileSync(implementationOf('dashboard', 'layout.tsx'), 'utf8'),
    /AuthenticatedDashboardLayout/,
    'dashboard delegates its client shell (and DashboardProviders) to core',
  )
})

/** Every core source module reachable from `file` through relative and @nextsparkjs/core imports; the generated registries are not followed. */
function importClosure(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen
  seen.add(file)
  const SRC = path.resolve(ROUTES, '..')
  for (const [, specifier] of fs.readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    const base = specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier)
      : specifier.startsWith('@nextsparkjs/core/') ? path.join(SRC, specifier.slice('@nextsparkjs/core/'.length))
      : null
    const target = base && ['.tsx', '.ts', '/index.tsx', '/index.ts'].map(extension => base + extension).find(candidate => fs.existsSync(candidate))
    if (target) importClosure(target, seen)
    else seen.add(specifier)
  }
  return seen
}

test('with providers.scope "groups" the root layouts, the public pages and the sign-in forms reach neither React Query nor the toaster', () => {
  const SRC = path.resolve(ROUTES, '..')
  const entries = [
    ...['layout.tsx', 'layout.ppr.tsx'].map(layout => implementationOf(layout)),
    path.join(SRC, 'hooks/useAuth.ts'),
    path.join(SRC, 'components/app/layouts/PublicNavbar.tsx'),
    path.join(SRC, 'components/app/layouts/PublicFooter.tsx'),
    path.join(SRC, 'components/auth/forms/LoginForm.tsx'),
    path.join(SRC, 'components/auth/forms/SignupForm.tsx'),
    path.join(ROUTES, '_internal/default-public-layout.tsx'),
    path.join(ROUTES, '_internal/auth-layout.tsx'),
    path.join(ROUTES, '_internal/auth-layout.cc.tsx'),
  ]
  const offenders: string[] = []
  for (const entry of entries) {
    for (const module of importClosure(entry)) {
      if (/@tanstack\/react-query|providers\/(query-provider|group-providers)/.test(module)) offenders.push(`${path.relative(SRC, entry)} -> ${module}`)
      // the toaster component belongs to the auth group (GroupToaster) and to the root providers registry, not to the root layouts or public pages
      const auth = /auth-layout|LoginForm|SignupForm/.test(entry)
      if (!auth && /components\/ui\/sonner/.test(module)) offenders.push(`${path.relative(SRC, entry)} -> ${module}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('with providers.scope "groups" the (auth) layouts mount GroupToaster, and no other group layout module imports it or GroupProviders', () => {
  // The root layouts take the providers from the generated root-providers registry: null with the groups scope
  for (const layout of ['layout.tsx', 'layout.ppr.tsx']) {
    const source = fs.readFileSync(implementationOf(layout), 'utf8')
    assert.match(source, /RootQueryProvider \? <RootQueryProvider>\{content\}<\/RootQueryProvider> : content/, layout)
    assert.match(source, /\{RootToaster && <Suspense><RootToaster /, `${layout} mounts the toaster only with the root providers`)
    assert.match(source, /from "@nextsparkjs\/registries\/root-providers"/, layout)
  }
  // Both modes' auth wrappers put the auth layout in GroupToaster (an override of the layout included)
  assert.ok(renderedElements(path.join(ROUTES, '_internal/auth-layout.tsx')).has('GroupToaster'))
  assert.ok(renderedElements(path.join(ROUTES, '_internal/auth-layout.cc.tsx')).has('GroupToaster'))
  // The public group imports these modules: none of them may reach the query provider
  for (const file of ['_internal/group-layouts.cc.tsx', '_internal/public-layout.tsx', '_internal/public-layout.cc.tsx', '_internal/default-public-layout.tsx']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROUTES, file), 'utf8'), /group-providers|query-provider/, file)
  }
})

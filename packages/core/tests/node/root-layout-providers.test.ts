/**
 * Public pages render under the root layout alone, so whatever it mounts runs
 * on them. TeamProvider and SubscriptionProvider fetch a signed-in visitor's
 * teams and subscription and re-sync the activeTeamId cookie, which only the
 * authenticated areas need, and those get both through DashboardProviders.
 * Both root layouts mount SessionCookieRefresher, which renews the session and
 * keeps the locale cookie and the theme in line with the account.
 * apps/dev/src/app is the source packages/core/templates/app is synced from.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../apps/dev/src/app')

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
    const elements = renderedElements(path.join(APP, layout))
    assert.ok(elements.has('QueryProvider'), `${layout} renders QueryProvider`)
    for (const provider of ['TeamProvider', 'SubscriptionProvider']) {
      assert.equal(elements.has(provider), false, `${layout} renders ${provider}`)
    }
  }
})

test('both root layouts mount SessionCookieRefresher', () => {
  for (const layout of ['layout.tsx', 'layout.ppr.tsx']) {
    assert.ok(renderedElements(path.join(APP, layout)).has('SessionCookieRefresher'), layout)
  }
})

test('root layouts serialize only their shared client-message group', () => {
  const root = fs.readFileSync(path.join(APP, 'layout.tsx'), 'utf8')
  const ppr = fs.readFileSync(path.join(APP, 'layout.ppr.tsx'), 'utf8')

  assert.match(root, /selectMessages\(messages, 'root'\)/,
    'the request layout narrows getMessages() before crossing the RSC boundary')
  assert.doesNotMatch(root, /<NextIntlClientProvider[^>]*messages=\{messages\}/,
    'the request layout must not pass the complete catalog to the root provider')
  assert.match(ppr, /selectMessages\(STATIC_MESSAGES, 'root'\)/,
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
    const source = fs.readFileSync(path.join(APP, relativePath), 'utf8')
    assert.match(source, new RegExp(`selectMessages\\(messages, '${group}'(?:, configuredNamespaces\\.${group})?\\)`), relativePath)
    assert.match(source, /NextIntlClientProvider/, `${relativePath} mounts a group provider`)
  }

  const dashboard = fs.readFileSync(path.join(APP, 'dashboard/layout.tsx'), 'utf8')
  assert.match(dashboard, /ENTITY_REGISTRY/, 'dashboard derives entity namespaces from the generated registry')
  assert.match(dashboard, /configuredNamespaces\.dashboard/, 'dashboard passes derived namespaces to its client provider')

  const superadmin = fs.readFileSync(path.join(APP, 'superadmin/layout.tsx'), 'utf8')
  assert.match(superadmin, /APP_CONFIG_MERGED/, 'superadmin derives role namespaces from merged project config')
  assert.match(superadmin, /configuredNamespaces\.superadmin/, 'superadmin passes derived namespaces to its client provider')
})

test('every authenticated area mounts DashboardProviders', () => {
  for (const area of ['superadmin', 'devtools']) {
    assert.ok(renderedElements(path.join(APP, area, 'layout.tsx')).has('DashboardProviders'), area)
  }
  assert.match(
    fs.readFileSync(path.join(APP, 'dashboard', 'layout.tsx'), 'utf8'),
    /AuthenticatedDashboardLayout/,
    'dashboard delegates its client shell (and DashboardProviders) to core',
  )
})

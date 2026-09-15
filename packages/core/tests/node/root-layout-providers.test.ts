/**
 * Public pages render under the root layout alone, so whatever it mounts runs
 * on them. TeamProvider and SubscriptionProvider fetch a signed-in visitor's
 * teams and subscription and re-sync the activeTeamId cookie, which only the
 * authenticated areas need, and those get both through DashboardProviders.
 * apps/dev/app is the source packages/core/templates/app is synced from.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../apps/dev/app')

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

test('every authenticated area mounts DashboardProviders', () => {
  for (const area of ['dashboard', 'superadmin', 'devtools']) {
    assert.ok(renderedElements(path.join(APP, area, 'layout.tsx')).has('DashboardProviders'), area)
  }
})

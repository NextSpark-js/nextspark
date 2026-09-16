/**
 * A relative `.md` link to a doc page that does not exist is left untouched
 * by remark-doc-links.ts (there is no route to point at) and, unrewritten,
 * still resolves in the browser to a section/page pair the docs registry
 * never scans. Next.js's default `dynamicParams: true` renders that pair
 * on demand and caches the notFound() UI with a 200 status - a broken link
 * that looks like a working page. `dynamicParams = false` makes any
 * section/page outside generateStaticParams's exhaustive list a real 404
 * instead, since every public doc page is already enumerated there.
 * apps/dev/app is the source packages/core/templates/app is synced from.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const DOCS_PAGE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/dev/app/(public)/docs/[section]/[page]/page.tsx'
)

test('the public docs page opts out of on-demand rendering for unknown params', () => {
  const source = ts.createSourceFile(DOCS_PAGE, fs.readFileSync(DOCS_PAGE, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  let found: ts.Expression | undefined
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
      node.declarationList.declarations.some(d => d.name.getText(source) === 'dynamicParams')
    ) {
      found = node.declarationList.declarations.find(d => d.name.getText(source) === 'dynamicParams')?.initializer
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  assert.ok(found, 'page.tsx exports `dynamicParams`')
  assert.equal(found!.kind, ts.SyntaxKind.FalseKeyword, '`dynamicParams` must be `false`, not the `true` default')
})

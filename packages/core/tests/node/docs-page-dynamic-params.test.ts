/**
 * A docs page route asked for a section/page pair the docs registry never
 * scanned - a broken relative `.md` link, a typo, a removed page - calls
 * notFound(), but only after a Suspense boundary in its layouts has already
 * sent the response head with a 200: the not-found UI arrives with the wrong
 * status. Both docs pages therefore export `dynamicParams = false` beside a
 * generateStaticParams that lists every page, which makes `next dev` answer
 * 404 for anything else before rendering. A production build renders these
 * routes on demand (the root layout reads the request), so that check has no
 * prerendered list there; the generated proxy answers 404 for those requests
 * instead (tests/jest/templates/proxy.test.ts).
 * apps/dev/app is the source packages/core/templates/app is synced from.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../apps/dev/app')

const DOCS_PAGES = [
  ['public', path.join(APP_DIR, '(public)/docs/[section]/[page]/page.tsx'), 'DOCS_REGISTRY.public'],
  ['superadmin', path.join(APP_DIR, 'superadmin/docs/[section]/[page]/page.tsx'), 'DOCS_REGISTRY.superadmin'],
] as const

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword)
}

for (const [label, file, registry] of DOCS_PAGES) {
  test(`the ${label} docs page opts out of on-demand rendering for unknown params`, () => {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

    let dynamicParams: ts.Expression | undefined
    let generateStaticParams: ts.FunctionDeclaration | undefined
    const visit = (node: ts.Node): void => {
      if (ts.isVariableStatement(node) && isExported(node)) {
        const declaration = node.declarationList.declarations.find(d => d.name.getText(source) === 'dynamicParams')
        if (declaration) dynamicParams = declaration.initializer
      }
      if (ts.isFunctionDeclaration(node) && isExported(node) && node.name?.text === 'generateStaticParams') {
        generateStaticParams = node
      }
      ts.forEachChild(node, visit)
    }
    visit(source)

    assert.ok(dynamicParams, `${label} page.tsx exports \`dynamicParams\``)
    assert.equal(dynamicParams!.kind, ts.SyntaxKind.FalseKeyword, '`dynamicParams` must be `false`, not the `true` default')
    assert.ok(generateStaticParams, `${label} page.tsx exports generateStaticParams`)
    assert.match(generateStaticParams!.getText(source), new RegExp(registry.replace('.', '\\.')), `generateStaticParams lists the pages of ${registry}`)
  })
}

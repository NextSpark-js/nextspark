/**
 * apps/dev is the integration app the root scripts build and run, and the
 * source packages/core/templates/app is synced from, so it runs the proxy a
 * generated project gets: packages/core/templates/proxy.ts. Next.js takes the
 * proxy function from the module at run time but reads `config` from the proxy
 * file's own source, so apps/dev/src/proxy.ts re-exports the function and
 * repeats the matcher, which has to stay what the template exports.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const APPS_DEV_PROXY = path.join(REPO_ROOT, 'apps/dev/src/proxy.ts')
const TEMPLATE_PROXY = path.join(REPO_ROOT, 'packages/core/templates/proxy.ts')

const require = createRequire(import.meta.url)
const { getMiddlewareMatchers } = require('next/dist/build/analysis/get-page-static-info') as {
  getMiddlewareMatchers: (matcher: string[], config: { basePath: string }) => unknown[]
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
}

/** The string literals of the `matcher` in the `config` a proxy file exports. */
function exportedMatcher(source: ts.SourceFile): string[] {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    if (!(ts.getModifiers(statement) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== 'config' || !declaration.initializer) continue
      assert.ok(ts.isObjectLiteralExpression(declaration.initializer), `${source.fileName} exports config as an object literal`)
      const matcher = declaration.initializer.properties.find(
        (property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(source) === 'matcher'
      )
      assert.ok(matcher, `${source.fileName} exports config.matcher`)
      const items = ts.isArrayLiteralExpression(matcher.initializer) ? [...matcher.initializer.elements] : [matcher.initializer]
      return items.map(item => {
        assert.ok(ts.isStringLiteralLike(item), `${source.fileName} writes each matcher as a string literal`)
        return item.text
      })
    }
  }
  assert.fail(`${source.fileName} does not export config`)
}

test('apps/dev has its proxy beside src/app, where Next discovers it', () => {
  assert.ok(fs.existsSync(APPS_DEV_PROXY), 'apps/dev/src/proxy.ts is missing, so apps/dev serves requests no generated project would')
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'apps/dev/proxy.ts')), false, 'a root proxy is ignored when the app lives under src/app')
})

test("apps/dev's proxy is the template's proxy function", () => {
  const source = parse(APPS_DEV_PROXY)
  const reexports = source.statements.filter(
    (statement): statement is ts.ExportDeclaration =>
      ts.isExportDeclaration(statement) &&
      !!statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      !!statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some(element => element.name.text === 'proxy')
  )
  assert.equal(reexports.length, 1, 'apps/dev/src/proxy.ts re-exports `proxy`')

  const [reexport] = reexports
  const element = (reexport.exportClause as ts.NamedExports).elements.find(e => e.name.text === 'proxy')!
  assert.equal((element.propertyName ?? element.name).text, 'proxy', 'the re-exported function is the template\'s `proxy`')

  const specifier = (reexport.moduleSpecifier as ts.StringLiteral).text
  const resolved = path.resolve(path.dirname(APPS_DEV_PROXY), specifier)
  assert.equal(`${resolved}.ts`, TEMPLATE_PROXY, `apps/dev/src/proxy.ts re-exports from ${specifier}, not the template`)
})

test("apps/dev's proxy matcher is the template's", () => {
  const appsDev = exportedMatcher(parse(APPS_DEV_PROXY))
  const template = exportedMatcher(parse(TEMPLATE_PROXY))
  assert.deepEqual(appsDev, template)
  assert.deepEqual(
    getMiddlewareMatchers(appsDev, { basePath: '' }),
    getMiddlewareMatchers(template, { basePath: '' }),
    'Next compiles both matchers to the same routes'
  )
})

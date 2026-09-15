/**
 * The proxy's matcher decides which requests the proxy sees at all. A request
 * it skips gets neither the session check nor the identity-header strip, so a
 * path under a protected area must run through it whatever its last segment
 * ends in. The matchers are compiled by Next's own compiler, the one the build
 * uses, from the literal the proxy template exports.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const PROXY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates/proxy.ts')
const require = createRequire(import.meta.url)
const { getMiddlewareMatchers } = require('next/dist/build/analysis/get-page-static-info') as {
  getMiddlewareMatchers: (matcher: string[], config: { basePath: string }) => Array<{ regexp: string }>
}

/** The string literals of the `matcher` the proxy template exports in `config`. */
function matcherSources(): string[] {
  const source = ts.createSourceFile(PROXY, fs.readFileSync(PROXY, 'utf8'), ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'matcher') {
      const items = ts.isArrayLiteralExpression(node.initializer) ? [...node.initializer.elements] : [node.initializer]
      for (const item of items) if (ts.isStringLiteralLike(item)) found.push(item.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function runsProxy(pathname: string): boolean {
  return getMiddlewareMatchers(matcherSources(), { basePath: '' }).some(matcher => new RegExp(matcher.regexp).test(pathname))
}

test('the proxy template exports a matcher', () => {
  assert.ok(matcherSources().length > 0)
})

test('protected areas run through the proxy whatever their last segment ends in', () => {
  for (const pathname of ['/dashboard/tasks/abc.svg', '/superadmin/users/alice.png', '/devtools/api/GET/api/v1/image.png', '/settings/avatar.jpg', '/devtools/config']) {
    assert.equal(runsProxy(pathname), true, pathname)
  }
})

test('paths that only start like Next output run through the proxy', () => {
  for (const pathname of ['/favicon.icoevil', '/favicon.ico/action', '/faviconXico', '/favicon-ico', '/_next/staticity/action', '/_next/image-proxy', '/_next/image/x']) {
    assert.equal(runsProxy(pathname), true, pathname)
  }
})

test("only the exact paths of Next's output stay out of the proxy", () => {
  for (const pathname of ['/_next/static/chunks/main.js', '/_next/image', '/favicon.ico']) {
    assert.equal(runsProxy(pathname), false, pathname)
  }
})

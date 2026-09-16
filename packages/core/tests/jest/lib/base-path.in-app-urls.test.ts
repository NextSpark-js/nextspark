/**
 * No in-app URL is written without the base path (#198).
 *
 * Next.js adds the base path to `<Link>`, `router.push` and `redirect()`, and
 * to nothing else. A `fetch('/api/...')`, a `new URL('/api/...', origin)` or a
 * `window.location.href = '/dashboard'` therefore leaves it out, and under a
 * base path every one of those 404s. Neither the type-checker nor a runtime
 * test of a single hook catches a new one being written, so the source itself
 * is asserted here: each of those calls goes through `withBasePath()`.
 *
 * The scan reads the syntax tree, not lines of text: the call and its path can
 * sit on different lines, and the path is just as often built into a variable
 * first.
 */
import ts from 'typescript'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'

const REPO_ROOT = join(__dirname, '../../../../..')

const TREES = [
  'packages/core/src',
  'packages/core/templates',
  'themes',
  'plugins',
  'apps/dev/app',
  'apps/dev/lib',
  'apps/dev/src',
]

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', 'tests', '__tests__', 'cypress'])

/** Calls that take a URL Next.js does not prefix. */
const CALLS = new Set(['fetch', 'sendBeacon', 'open', 'new URL', 'new EventSource', 'new WebSocket'])

/** History entries: the URL the browser is left showing is the third argument. */
const HISTORY_CALLS = new Set(['pushState', 'replaceState'])

/** A call that is a URL of its own, not one this app serves. */
const ALLOWED = [
  {
    file: 'packages/core/src/lib/mcp/executor.ts',
    text: 'INTERNAL_ORIGIN',
    why: 'a request handed straight to a route handler, which is given its URL without the base path',
  },
]

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      sourceFiles(path, found)
      continue
    }
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.(test|spec|d)\.tsx?$/.test(entry.name)) continue
    found.push(path)
  }
  return found
}

/** The path a node spells out, when it spells one out at all. */
function writtenPath(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) return node.head.text
  if (ts.isConditionalExpression(node)) return writtenPath(node.whenTrue) ?? writtenPath(node.whenFalse)
  return undefined
}

function isWrapped(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    (node.expression.text === 'withBasePath' || node.expression.text === 'withBasePathIfInApp')
  )
}

function calledName(node: ts.Node): string {
  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression)) return node.expression.text
    if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) return `new ${node.expression.text}`
  return ''
}

function offendersIn(file: string): string[] {
  const relativePath = relative(REPO_ROOT, file)
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const pathVariables = new Map<string, string>()
  const found: string[] = []

  const report = (node: ts.Node, kind: string, text: string) => {
    const shown = text.replace(/\s+/g, ' ').slice(0, 90)
    if (ALLOWED.some(allowed => allowed.file === relativePath && node.getText(source).includes(allowed.text))) return
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    found.push(`${relativePath}:${line + 1}  ${kind}  ${shown}`)
  }

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && writtenPath(node.initializer)?.startsWith('/')) {
      pathVariables.set(node.name.text, node.initializer!.getText(source))
    }

    if (CALLS.has(calledName(node))) {
      const argument = (node as ts.CallExpression | ts.NewExpression).arguments?.[0]
      if (argument && !isWrapped(argument)) {
        if (writtenPath(argument)?.startsWith('/')) report(node, calledName(node), argument.getText(source))
        else if (ts.isIdentifier(argument) && pathVariables.has(argument.text)) {
          report(node, `${calledName(node)} via variable`, `${argument.text} = ${pathVariables.get(argument.text)}`)
        }
      }
    }

    if (HISTORY_CALLS.has(calledName(node)) && ts.isCallExpression(node)) {
      const argument = node.arguments[2]
      if (argument && !isWrapped(argument) && writtenPath(argument)?.startsWith('/')) {
        report(node, calledName(node), argument.getText(source))
      }
    }

    // An <a> is the one link Next.js does not prefix; <Link> it does
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'href') {
      const element = node.parent.parent
      const tag = ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element) ? element.tagName.getText(source) : ''
      const value = node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer
      if (tag === 'a' && value && !isWrapped(value) && writtenPath(value)?.startsWith('/')) {
        report(node, 'anchor', value.getText(source))
      }
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = node.left.getText(source)
      if (/location\.(href|pathname)$/.test(target) && !isWrapped(node.right) && writtenPath(node.right)?.startsWith('/')) {
        report(node, 'location', `${target} = ${node.right.getText(source)}`)
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function scannedFiles(): string[] {
  return TREES.filter(tree => existsSync(join(REPO_ROOT, tree))).flatMap(tree => sourceFiles(join(REPO_ROOT, tree)))
}

describe('in-app URLs carry the base path', () => {
  test('no fetch, URL, EventSource, WebSocket or location assignment takes a bare in-app path', () => {
    expect(scannedFiles().flatMap(offendersIn)).toEqual([])
  })

  test('the scan reads the trees that ship in-app URLs', () => {
    const files = scannedFiles()
    expect(files.length).toBeGreaterThan(500)
    expect(files.some(file => readFileSync(file, 'utf8').includes('withBasePath'))).toBe(true)
  })

  test('the scan sees the shapes a line-by-line read misses', () => {
    const offenders = offendersIn(join(REPO_ROOT, 'packages/core/tests/jest/lib/__fixtures__/bare-in-app-urls.tsx'))

    expect(offenders.map(offender => offender.replace(/^.*__fixtures__\//, ''))).toEqual([
      'bare-in-app-urls.tsx:6  fetch via variable  path = `/api/v1/${slug}`',
      'bare-in-app-urls.tsx:10  fetch  \'/api/v1/teams\'',
      'bare-in-app-urls.tsx:16  location  window.location.href = \'/dashboard\'',
      'bare-in-app-urls.tsx:27  pushState  `/dashboard/boards/${id}`',
      'bare-in-app-urls.tsx:28  open  \'/dashboard/reports\'',
      'bare-in-app-urls.tsx:34  anchor  "/pricing"',
    ])
  })
})

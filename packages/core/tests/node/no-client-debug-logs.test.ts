/**
 * Debug traces in client code ship in every production bundle and print in every visitor's console. A file that
 * starts with 'use client', and the hooks and theme/entity registries the browser loads beside it, log inside an
 * `if (process.env.NODE_ENV === 'development')` (the bundler drops the branch, message included) or not at all; console.warn and console.error are for real problems and stay.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const ALSO_CLIENT = ['hooks/useEntityConfig.ts', 'lib/theme/override-resolver.ts', 'lib/translations/i18n-integration.ts', 'lib/entities/registry.ts', 'lib/entities/queries.ts']

function* sources(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* sources(file)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) yield file
  }
}

const isClient = (text: string) => /^(?:\s*(?:\/\*[\s\S]*?\*\/|\/\/.*)\s*)*['"]use client['"]/.test(text)

/** The condition targets development: `=== 'development'`, `!== 'production'` (either side, `==`/`!=` too); a bare `NODE_ENV` mention is not enough. */
const isDevCondition = (condition: ts.Expression) =>
  /NODE_ENV\s*={2,3}\s*['"]development['"]|['"]development['"]\s*={2,3}\s*[\w.]*NODE_ENV|NODE_ENV\s*!={1,2}\s*['"]production['"]|['"]production['"]\s*!={1,2}\s*[\w.]*NODE_ENV/.test(condition.getText())

/** Whether `node` sits in the then-branch of an `if` whose condition targets development (or is inside a dev-only conditional expression). */
function inDevBranch(node: ts.Node): boolean {
  for (let child: ts.Node = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isIfStatement(parent) && parent.thenStatement === child && isDevCondition(parent.expression)) return true
    if (ts.isConditionalExpression(parent) && parent.whenTrue === child && isDevCondition(parent.condition)) return true
    if (ts.isBinaryExpression(parent) && parent.right === child && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && isDevCondition(parent.left)) return true
  }
  return false
}

test('the guard must target development, not merely mention NODE_ENV', () => {
  const guarded = (condition: string) => {
    const sf = ts.createSourceFile('x.ts', `if (${condition}) { console.log(1) }`, ts.ScriptTarget.Latest, true)
    let found = false
    const visit = (n: ts.Node) => { if (ts.isCallExpression(n) && inDevBranch(n)) found = true; ts.forEachChild(n, visit) }
    visit(sf)
    return found
  }
  for (const ok of ["process.env.NODE_ENV === 'development'", "process.env.NODE_ENV !== 'production'", "'development' === process.env.NODE_ENV"]) assert.ok(guarded(ok), ok)
  for (const bad of ["process.env.NODE_ENV === 'production'", "process.env.NODE_ENV !== 'development'", 'process.env.NODE_ENV']) assert.ok(!guarded(bad), bad)
})

test('client code has no console.log, console.info or console.debug outside a NODE_ENV development branch', () => {
  const offenders: string[] = []
  for (const file of sources(src)) {
    const text = fs.readFileSync(file, 'utf8')
    const relative = path.relative(src, file).split(path.sep).join('/')
    if (!isClient(text) && !ALSO_CLIENT.includes(relative)) continue
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && /^console\.(log|info|debug)$/.test(node.expression.getText(sf)) && !inDevBranch(node)) {
        offenders.push(`${relative}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  assert.deepEqual(offenders, [], "gate the trace with `if (process.env.NODE_ENV === 'development')`, or drop it")
})

/**
 * #541: `lib/auth` is in the module graph of every route of the app, and MCP browser sign-in configures the
 * authorization server while it loads. What it needs of the project (the entities the API serves, the scopes the
 * tools need) is generated data (`@nextsparkjs/registries/mcp-scopes`), so that sign-in makes auth reach none of:
 *
 * - the entity registry, which imports the config of every entity (core keeps it out of the per-entity routes);
 * - the scope registry, which imports the entity registry;
 * - the registry of `entities/<slug>/mcp.ts` files, which imports the project's tool code: evaluated with auth, an
 *   `mcp.ts` that reads `lib/auth` in its module scope would find it half initialized.
 *
 * The walk follows what a bundler follows: `import` and `export ... from` (not the type-only ones), and `require()`
 * and `import()` with a literal argument.
 *
 * Two late loads are older than MCP sign-in and are not its to remove. They are named below so that they stay the
 * only ones: a new path to those registries fails this test, whichever way it is written.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = path.join(CORE, 'src')

function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith('.')
    ? path.resolve(path.dirname(from), specifier)
    : specifier.startsWith('@nextsparkjs/core/') ? path.join(SRC, specifier.slice('@nextsparkjs/core/'.length)) : null
  if (!base) return null
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

/**
 * Late loads of `main`, from before MCP sign-in: the one call of each file that is not followed, by the module it
 * names. Any other `require()` or `import()` of the same file is followed like everywhere else.
 */
const OLDER_LATE_LOADS: Record<string, { specifier: string; call: string }> = {
  // getEntityMetaConfig requires the entity registry for an entity that is not core's (since the first commit);
  // lib/auth reaches it through the user flags service
  'types/meta.types.ts': { specifier: '@nextsparkjs/registries/entity-registry', call: "require('@nextsparkjs/registries/entity-registry')" },
  // suspendUser drops the cached API keys of the account: it imports lib/api/auth only when a key was deactivated,
  // on purpose, because that module pulls in the config registries
  'lib/auth/suspension.ts': { specifier: '../api/auth', call: "import('../api/auth')" },
}

/** The specifiers a module loads at run time. */
function loadedBy(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found: string[] = []
  const older = OLDER_LATE_LOADS[path.relative(SRC, file)]?.specifier
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined
      const typeOnly = Boolean(clause?.isTypeOnly) || (ts.isExportDeclaration(node) && node.isTypeOnly) ||
        Boolean(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name && clause.namedBindings.elements.every(element => element.isTypeOnly))
      if (!typeOnly) found.push(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const specifier = (node.arguments[0] as ts.StringLiteralLike).text
      if ((isRequire || isImport) && specifier !== older) found.push(specifier)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** Every generated registry the graph of `root` reaches, with the core module that loads it. */
function registriesReachedFrom(root: string): Map<string, string> {
  const reached = new Map<string, string>()
  const seen = new Set<string>()
  const queue = [path.join(SRC, root)]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const specifier of loadedBy(file)) {
      const registry = /^@nextsparkjs\/registries\/(.+)$/.exec(specifier)
      if (registry) {
        if (!reached.has(registry[1])) reached.set(registry[1], path.relative(SRC, file))
        continue
      }
      const next = resolveModule(file, specifier)
      if (next) queue.push(next)
    }
  }
  return reached
}

const KEPT_OUT = ['entity-registry', 'entity-registry.client', 'scope-registry', 'mcp-registry']

test('MCP sign-in makes lib/auth load neither the entity registry, nor the scope registry, nor the project\'s mcp.ts files', () => {
  const reached = registriesReachedFrom('lib/auth.ts')
  const offenders = KEPT_OUT.filter(name => reached.has(name)).map(name => `${name} <- ${reached.get(name)}`)
  assert.deepEqual(offenders, [])
  // What it reads of the project for MCP sign-in is the generated data
  assert.equal(reached.get('mcp-scopes'), 'lib/mcp/oauth/tool-scopes.ts')
})

test('the two older late loads are still what this file says they are', () => {
  for (const [file, { call }] of Object.entries(OLDER_LATE_LOADS)) {
    assert.ok(fs.readFileSync(path.join(SRC, file), 'utf8').includes(call), `${file} no longer has ${call}: take it out of OLDER_LATE_LOADS`)
  }
})

test('no module of MCP loads anything late: what it needs is imported where it can be seen', () => {
  const lateLoads = (file: string): string[] => {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const found: string[] = []
    const visit = (node: ts.Node): void => {
      // a call, not the `import('...')` of a type
      if (ts.isCallExpression(node) && ((ts.isIdentifier(node.expression) && node.expression.text === 'require') || node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
        found.push(`${path.relative(SRC, file)}: ${node.getText(source)}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    return found
  }
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (/\.tsx?$/.test(entry.name)) offenders.push(...lateLoads(file))
    }
  }
  walk(path.join(SRC, 'lib/mcp'))
  assert.deepEqual(offenders, [])
})

test('the walk sees what it is there to catch: the /api/mcp route does load those registries', () => {
  const reached = registriesReachedFrom('routes/api/mcp/route.ts')
  assert.ok(reached.has('entity-registry') && reached.has('mcp-registry') && reached.has('scope-registry'), `reached: ${[...reached.keys()].join(', ')}`)
})

test('the walk follows a literal require() and a literal import()', () => {
  const dir = fs.mkdtempSync(path.join(SRC, '.graph-walk-'))
  try {
    fs.writeFileSync(path.join(dir, 'a.ts'), `export function late() { return require('./b') }\n`)
    fs.writeFileSync(path.join(dir, 'b.ts'), `export const later = () => import('./c')\n`)
    fs.writeFileSync(path.join(dir, 'c.ts'), `import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'\nexport { ENTITY_REGISTRY }\n`)
    const reached = registriesReachedFrom(path.relative(SRC, path.join(dir, 'a.ts')))
    assert.equal(reached.get('entity-registry'), path.relative(SRC, path.join(dir, 'c.ts')))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

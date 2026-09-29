/**
 * Core routes (#203): every framework route is a module of @nextsparkjs/core under
 * src/routes, listed in src/routes/manifest.json, and the generated host emits one
 * facade per entry with the stage-1 facade emitter. These tests hold that together:
 *
 * - the manifest is what scripts/build/routes-manifest.mjs writes from the files,
 *   in the shape of the host-conformance fixture's CORE_ROUTES;
 * - it lists exactly the framework routes of apps/dev/src/app (everything outside
 *   the build-generated (templates) group);
 * - the emitter emits a facade for every entry with zero diagnostics, inside the
 *   static-imports facade grammar;
 * - no core route module resolves a template at runtime, or loads a module by a runtime
 *   value (`import(x)` / `require(x)` with a non-literal argument);
 * - the package exports each specifier, and the built dist keeps each module's
 *   'use client' directive (checked when dist/routes exists: CI builds it first).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REPO = path.resolve(CORE, '../..')
const ROUTES = path.join(CORE, 'src/routes')
const DIST_ROUTES = path.join(CORE, 'dist/routes')
const DEV_APP = path.join(REPO, 'apps/dev/src/app')

const { buildRoutesManifest, renderJson, unlistedRouteLikeFiles, specifierForRouteFile, ROUTES_SUBPATH } = await import(
  path.join(CORE, 'scripts/build/routes-manifest.mjs')
)
const { emitFacade, ROUTE_KINDS, analyzeRouteSource } = await import(path.join(CORE, 'scripts/build/registry/host/facade-emitter.mjs'))
const { validateGeneratedModule } = await import(path.join(CORE, 'scripts/build/registry/host/static-imports.mjs'))
const { loadTypeScriptFor } = await import(path.join(CORE, 'scripts/build/registry/shared/typescript-compiler.mjs'))
const { CORE_ROUTES: FIXTURE_ROUTES } = await import(path.join(CORE, 'tests/fixtures/host-conformance/fake-core/routes.mjs'))

type Entry = { kind: string; target: string; specifier: string }
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
const manifest: Entry[] = readJson(path.join(ROUTES, 'manifest.json'))
const variants: Record<string, Entry[]> = readJson(path.join(ROUTES, 'variants.json'))
const variantEntries = Object.entries(variants).flatMap(([mode, entries]) => entries.map(entry => ({ mode, ...entry })))

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const abs = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(abs, base) : [path.relative(base, abs).split(path.sep).join('/')]
  })
}

/** The core source file of a `@nextsparkjs/core/routes/...` specifier. */
function sourceOf(specifier: string): string {
  const rel = specifier.slice(`${ROUTES_SUBPATH}/`.length)
  const file = ['.tsx', '.ts'].map(extension => path.join(ROUTES, rel + extension)).find(candidate => fs.existsSync(candidate))
  assert.ok(file, `${specifier} has no source module under src/routes`)
  return file
}

test('manifest.json and variants.json are what routes-manifest.mjs writes from src/routes', () => {
  const built = buildRoutesManifest()
  assert.equal(fs.readFileSync(path.join(ROUTES, 'manifest.json'), 'utf8'), renderJson(built.manifest), 'run node packages/core/scripts/build/routes-manifest.mjs')
  assert.equal(fs.readFileSync(path.join(ROUTES, 'variants.json'), 'utf8'), renderJson(built.variants), 'run node packages/core/scripts/build/routes-manifest.mjs')
  assert.deepEqual(unlistedRouteLikeFiles(), [], 'every .ts/.tsx under src/routes (outside _ folders) is a manifest entry or a variant')
})

test('entries have the shape of the conformance fixture: kind, target, specifier', () => {
  const shape = Object.keys(FIXTURE_ROUTES[0]).sort()
  assert.deepEqual(shape, ['kind', 'specifier', 'target'])
  for (const entry of [...manifest, ...Object.values(variants).flat()]) {
    assert.deepEqual(Object.keys(entry).sort(), shape, JSON.stringify(entry))
    assert.ok(ROUTE_KINDS.includes(entry.kind), `${entry.target}: unknown kind ${entry.kind}`)
    assert.match(entry.specifier, /^@nextsparkjs\/core\/routes\//)
    sourceOf(entry.specifier)
  }
  for (const entry of manifest) assert.equal(entry.specifier, specifierForRouteFile(entry.target))
  assert.equal(new Set(manifest.map(entry => entry.target)).size, manifest.length, 'one entry per target')
})

test('the manifest lists exactly the framework routes of apps/dev/src/app', () => {
  // (templates)/ is written by the registry build from the project's templates/: project routes, not core's.
  const routeLike = /(^|\/)(page|layout|loading|error|not-found|template|default|route|global-error|global-not-found|forbidden|unauthorized)\.(tsx|ts)$/
  const devRoutes = walk(DEV_APP).filter(file => !file.startsWith('(templates)/') && routeLike.test(file)).sort()
  assert.deepEqual(manifest.map(entry => entry.target), devRoutes)
  for (const entry of variantEntries) assert.ok(fs.existsSync(path.join(DEV_APP, entry.specifier.slice(`${ROUTES_SUBPATH}/`.length) + '.tsx')))
})

test('the facade emitter emits every manifest entry with zero diagnostics, inside the facade grammar', async () => {
  const ts = await loadTypeScriptFor(CORE)
  const failures: string[] = []
  const emit = async (entry: Entry, cacheComponents: boolean) => {
    try {
      const { content, target } = await emitFacade({ ...entry, file: sourceOf(entry.specifier), projectRoot: CORE, cacheComponents })
      assert.equal(target, entry.target)
      assert.deepEqual(validateGeneratedModule({ ts, source: content, file: target, grammar: 'facade' }), [], `${entry.target} facade grammar`)
    } catch (error) {
      failures.push(`${entry.target} (cacheComponents: ${cacheComponents}): ${(error as Error).message}`)
    }
  }
  // Core's defaults are the legacy (non-Cache Components) routes; variants are for their mode.
  for (const entry of manifest) await emit(entry, false)
  for (const { mode, ...entry } of variantEntries) await emit(entry, mode === 'cacheComponents')
  assert.deepEqual(failures, [])
})

/**
 * Until the generated host writes src/app (#203 stage 3), apps/dev commits it: a file with
 * no runtime template lookup is exactly the emitter's facade, and one that still resolves a
 * project override at runtime keeps every literal segment config the facade would carry.
 */
test('apps/dev route files are the facades of their core modules, or wrappers that keep their segment config', async () => {
  // The project's own handler: it loads lib/billing/stripe-webhook-extensions.ts, which core's default doesn't.
  const PROJECT_OWNED = new Set(['api/v1/billing/webhooks/stripe/route.ts'])
  const problems: string[] = []
  for (const entry of manifest) {
    const dev = fs.readFileSync(path.join(DEV_APP, entry.target), 'utf8')
    const { content } = await emitFacade({ ...entry, file: sourceOf(entry.specifier), projectRoot: CORE, cacheComponents: false })
    const [, ...facadeBody] = content.split('\n')
    const literals = facadeBody.filter(line => line.startsWith('export const '))
    for (const literal of literals) if (!dev.split('\n').includes(literal)) problems.push(`${entry.target}: lost \`${literal}\``)
    if (PROJECT_OWNED.has(entry.target)) continue
    if (!dev.includes('@nextsparkjs/core/routes/')) problems.push(`${entry.target}: does not import its core module`)
    const resolvesAtRuntime = dev.includes('@nextsparkjs/registries/template-scopes/') || dev.includes("import('@/")
    if (!resolvesAtRuntime && dev.split('\n').slice(1).join('\n') !== facadeBody.join('\n')) problems.push(`${entry.target}: differs from the emitted facade`)
  }
  assert.deepEqual(problems, [])
})

test('no core route module resolves a template or a module at runtime by key', () => {
  const lookup = /\b(getTemplateOrDefault|getTemplateOrDefaultClient|getMetadataOrDefault|getTemplateComponent|hasTemplateOverride)\s*\(|template-scopes|@\/\.nextspark|from ['"]@\/|import\(['"]@\//
  const offenders = walk(ROUTES)
    .filter(file => /\.(tsx|ts)$/.test(file))
    .filter(file => lookup.test(fs.readFileSync(path.join(ROUTES, file), 'utf8')))
  assert.deepEqual(offenders, [], 'core routes must not import a project alias (@/...) or resolve templates at runtime')
})

/**
 * `import(x)` / `require(x)` whose argument is not a string literal, in a core route module or
 * a route helper (`_internal`): the module is chosen by a runtime value. A literal specifier is
 * a fixed lazy load, which is allowed.
 */
export function variableModuleLoads(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const loads = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require') ||
        (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'require')
      const [argument] = node.arguments
      if (loads && !(argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)))) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        found.push(`${file}:${line + 1} ${node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 80)}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

test('no core route module or route helper loads a module by a runtime value (import(x), require(x))', () => {
  const offenders = walk(ROUTES)
    .filter(file => /\.(tsx|ts)$/.test(file))
    .flatMap(file => variableModuleLoads(file, fs.readFileSync(path.join(ROUTES, file), 'utf8')))
  assert.deepEqual(offenders, [])
})

test('the module-load check catches every spelling of a variable import or require', () => {
  const caught = [
    'await import(block.schemaPath)',
    'await import(/* webpackIgnore: true */ path)',
    'await import(`@/blocks/${slug}/schema`)',
    "await import('@/blocks/' + slug)",
    'require(name)',
    'require.resolve(name)',
  ]
  for (const code of caught) assert.equal(variableModuleLoads('probe.ts', `export async function f(block: any, path: string, slug: string, name: string) { ${code} }`).length, 1, code)
  assert.deepEqual(variableModuleLoads('probe.ts', "export const load = () => import('next/navigation')"), [], 'a literal specifier is a fixed lazy load')
})

/**
 * src/routes is built by tsup's onSuccess, not as tsup entries. With a bare `--watch`, tsup
 * skips changes to files outside its entries' dependency graph, so a route-only edit never
 * rebuilt dist/routes; watching a path makes every change under it rebuild, onSuccess included.
 * (Probe: s2-core-routes/watch-probe.sh in the #203 evidence.)
 */
test('`pnpm dev` watches src, so a route-only edit rebuilds dist/routes', () => {
  const { scripts } = readJson(path.join(CORE, 'package.json'))
  assert.match(scripts.dev, /\btsup\b.*--watch\s+src\b/)
})

test('@nextsparkjs/core exports ./routes/* and the manifest files', () => {
  const { exports } = readJson(path.join(CORE, 'package.json'))
  assert.equal(exports['./routes/manifest.json'], './dist/routes/manifest.json')
  assert.equal(exports['./routes/variants.json'], './dist/routes/variants.json')
  assert.deepEqual(exports['./routes/*'], { types: './dist/routes/*.d.ts', import: './dist/routes/*.js' })
})

const distBuilt = fs.existsSync(path.join(DIST_ROUTES, 'manifest.json'))

test('the built dist emits the same facades as the source (what a project that installs core reads)', { skip: !distBuilt && 'dist/routes is not built (pnpm --filter @nextsparkjs/core build:js)' }, async () => {
  assert.equal(fs.readFileSync(path.join(DIST_ROUTES, 'manifest.json'), 'utf8'), fs.readFileSync(path.join(ROUTES, 'manifest.json'), 'utf8'))
  assert.equal(fs.readFileSync(path.join(DIST_ROUTES, 'variants.json'), 'utf8'), fs.readFileSync(path.join(ROUTES, 'variants.json'), 'utf8'))
  const mismatches: string[] = []
  for (const { mode, ...entry } of [...manifest.map(entry => ({ mode: undefined, ...entry })), ...variantEntries]) {
    const source = sourceOf(entry.specifier)
    const built = path.join(DIST_ROUTES, entry.specifier.slice(`${ROUTES_SUBPATH}/`.length) + '.js')
    if (!fs.existsSync(built)) {
      mismatches.push(`${entry.specifier}: ${path.relative(CORE, built)} is missing`)
      continue
    }
    const cacheComponents = mode === 'cacheComponents'
    try {
      const [fromSource, fromDist] = await Promise.all([
        emitFacade({ ...entry, file: source, projectRoot: CORE, cacheComponents }),
        emitFacade({ ...entry, file: built, projectRoot: CORE, cacheComponents }),
      ])
      if (fromSource.content !== fromDist.content) mismatches.push(`${entry.specifier}:\n${fromSource.content}--- dist:\n${fromDist.content}`)
      const [sourceAnalysis, distAnalysis] = await Promise.all([
        analyzeRouteSource({ source: fs.readFileSync(source, 'utf8'), file: source, projectRoot: CORE }),
        analyzeRouteSource({ source: fs.readFileSync(built, 'utf8'), file: built, projectRoot: CORE }),
      ])
      if (sourceAnalysis.directives.join() !== distAnalysis.directives.join()) {
        mismatches.push(`${entry.specifier}: directives [${sourceAnalysis.directives}] -> [${distAnalysis.directives}]`)
      }
    } catch (error) {
      mismatches.push(`${entry.specifier}: ${(error as Error).message}`)
    }
  }
  assert.deepEqual(mismatches, [])
})

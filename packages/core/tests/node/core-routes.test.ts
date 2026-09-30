/**
 * Core routes (#203): every framework route is a module of @nextsparkjs/core under
 * src/routes, listed in src/routes/manifest.json, and the generated host emits one
 * facade per entry with the stage-1 facade emitter. These tests hold that together:
 *
 * - the manifest is what scripts/build/routes-manifest.mjs writes from the files,
 *   in the shape of the host-conformance fixture's CORE_ROUTES (a layout may also
 *   carry `compose`, the wrapper a project override of it is composed with);
 * - it lists exactly the route files under src/routes, less the routes the generated host
 *   writes itself (per-entity routes) and the runtime API dispatchers (retired); apps/dev no
 *   longer commits an app tree: its src/app is generated from this manifest;
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
const ROUTES = path.join(CORE, 'src/routes')
const DIST_ROUTES = path.join(CORE, 'dist/routes')

const { buildRoutesManifest, renderJson, unlistedRouteLikeFiles, specifierForRouteFile, ROUTES_SUBPATH, COMPOSED_ROUTES, VARIANT_FILES } = await import(
  path.join(CORE, 'scripts/build/routes-manifest.mjs')
)
const { emitFacade, ROUTE_KINDS, analyzeRouteSource } = await import(path.join(CORE, 'scripts/build/registry/host/facade-emitter.mjs'))
const { validateGeneratedModule } = await import(path.join(CORE, 'scripts/build/registry/host/static-imports.mjs'))
const { loadTypeScriptFor } = await import(path.join(CORE, 'scripts/build/registry/shared/typescript-compiler.mjs'))
const STATIC_IMPORTS = await import(path.join(CORE, 'scripts/build/registry/host/static-imports.mjs'))
const { CORE_ROUTES: FIXTURE_ROUTES } = await import(path.join(CORE, 'tests/fixtures/host-conformance/fake-core/routes.mjs'))

type Entry = { kind: string; target: string; specifier: string; compose?: { wrapper: string; specifier: string } }
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

test('entries have the shape of the conformance fixture: kind, target, specifier (and compose, on wrapped layouts)', () => {
  const shape = Object.keys(FIXTURE_ROUTES[0]).sort()
  assert.deepEqual(shape, ['kind', 'specifier', 'target'])
  for (const entry of [...manifest, ...Object.values(variants).flat()]) {
    assert.deepEqual(Object.keys(entry).filter(key => key !== 'compose').sort(), shape, JSON.stringify(entry))
    assert.ok(ROUTE_KINDS.includes(entry.kind), `${entry.target}: unknown kind ${entry.kind}`)
    assert.match(entry.specifier, /^@nextsparkjs\/core\/routes\//)
    sourceOf(entry.specifier)
  }
  for (const entry of manifest) assert.equal(entry.specifier, specifierForRouteFile(entry.target))
  assert.equal(new Set(manifest.map(entry => entry.target)).size, manifest.length, 'one entry per target')
})

test('the manifest lists exactly the route files under src/routes, and every variant is one of them', () => {
  // _ folders hold helpers, variants replace a manifest route, presets.ts belongs to the API Explorer
  const routeLike = /(^|\/)(page|layout|loading|error|not-found|template|default|route|global-error|global-not-found|forbidden|unauthorized)\.(tsx|ts)$/
  const isVariant = (file: string) => variantEntries.some(variant => variant.specifier === `${ROUTES_SUBPATH}/${file.replace(/\.(tsx|ts)$/, '')}`)
  const files = walk(ROUTES)
    .filter(file => !file.split('/').some(part => part.startsWith('_')) && routeLike.test(file) && !isVariant(file))
    .sort()
  assert.deepEqual(manifest.map(entry => entry.target), files)
  for (const entry of variantEntries) assert.ok(fs.existsSync(path.join(ROUTES, entry.specifier.slice(`${ROUTES_SUBPATH}/`.length) + '.tsx')))
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

test('core ships no runtime dispatcher and no catch-all entity route: the generated host writes one route per entity, and per-entity routes forward metadata, error and loading from route helpers', () => {
  const files = walk(ROUTES)
  assert.deepEqual(files.filter(file => /^api\/v1\/(theme|plugin)\//.test(file)), [], 'project and plugin routes are route files of their own, not served through a dispatcher')
  assert.deepEqual(files.filter(file => file.startsWith('dashboard/(main)/[entity]/') || file.startsWith('(public)/[...slug]/')), [])
  for (const helper of ['entity-list-metadata.ts', 'entity-detail-metadata.ts', 'entity-error.tsx', 'entity-loading.tsx']) assert.ok(files.includes(`_internal/${helper}`), helper)
  const listed = new Set(manifest.map(entry => entry.target))
  for (const target of listed) assert.doesNotMatch(target, /^api\/v1\/(theme|plugin)\//)
})

test('layouts that wrap the layout a project resolves declare the wrapper their overrides are composed with', async () => {
  const wrapped = manifest.filter(entry => entry.compose)
  assert.deepEqual(wrapped.map(entry => entry.target).sort(), Object.keys(COMPOSED_ROUTES).sort())
  const { analyzeRouteSource } = await import(path.join(CORE, 'scripts/build/registry/host/facade-emitter.mjs'))
  for (const entry of [...wrapped, ...variantEntries.filter(variant => variant.compose)]) {
    assert.equal(entry.kind, 'layout')
    const file = sourceOf(entry.compose!.specifier)
    const { exports } = await analyzeRouteSource({ source: fs.readFileSync(file, 'utf8'), file, projectRoot: CORE })
    assert.ok(exports.some((exported: { name: string }) => exported.name === entry.compose!.wrapper), `${entry.compose!.specifier} exports ${entry.compose!.wrapper}`)
  }
  // The Cache Components root layout is composed with its own wrapper.
  const ppr = variants.cacheComponents.find(entry => entry.target === 'layout.tsx')!
  assert.equal(ppr.compose?.specifier, `${ROUTES_SUBPATH}/_internal/root-layout.ppr`)
})

test('the Cache Components variants are the routes whose segment config Next.js rejects with it, the root layout and the layouts that load messages', async () => {
  assert.deepEqual(
    Object.keys(VARIANT_FILES.cacheComponents).sort(),
    [
      '(auth)/layout.cc.tsx', '(auth)/login/page.cc.tsx', '(auth)/signup/page.cc.tsx', '(public)/docs/[section]/[page]/page.cc.tsx', '(public)/layout.cc.tsx',
      'dashboard/layout.cc.tsx', 'devtools/layout.cc.tsx', 'layout.ppr.tsx', 'superadmin/docs/[section]/[page]/page.cc.tsx', 'superadmin/layout.cc.tsx',
    ]
  )
  // Every manifest entry that Next.js refuses with cacheComponents has a variant that it accepts.
  const covered = new Set(variants.cacheComponents.map(entry => entry.target))
  const uncovered: string[] = []
  for (const entry of manifest) {
    const emitted = await emitFacade({ ...entry, file: sourceOf(entry.specifier), projectRoot: CORE, cacheComponents: true }).then(() => null, error => error as Error)
    if (emitted && !covered.has(entry.target)) uncovered.push(`${entry.target}: ${emitted.message.split('\n')[1]}`)
  }
  assert.deepEqual(uncovered, [], 'a route Next.js rejects under Cache Components needs a variant')
})

test('a layout that awaits getMessages() has a Cache Components variant that does not (Next.js refuses it outside Suspense while prerendering)', () => {
  const covered = new Set(variants.cacheComponents.map(entry => entry.target))
  const missing: string[] = []
  for (const entry of manifest.filter(route => route.kind === 'layout')) {
    const files = [entry.specifier, entry.compose?.specifier].filter((specifier): specifier is string => Boolean(specifier))
    const awaitsMessages = files.some(specifier => /await\s+getMessages\(/.test(fs.readFileSync(sourceOf(specifier), 'utf8')))
    if (awaitsMessages && !covered.has(entry.target)) missing.push(entry.target)
  }
  assert.deepEqual(missing, [], 'add a layout.cc.tsx variant (see _internal/group-layouts.cc.tsx)')

  // The variants themselves never await getMessages() outside a component under Suspense: their wrappers load it in RequestMessages.
  for (const entry of variants.cacheComponents.filter(variant => variant.kind === 'layout')) {
    for (const specifier of [entry.specifier, entry.compose?.specifier].filter((value): value is string => Boolean(value))) {
      assert.doesNotMatch(fs.readFileSync(sourceOf(specifier), 'utf8').replace(/async function RequestMessages[\s\S]*?\n}\n/, ''), /await\s+getMessages\(/, specifier)
    }
  }
})

test('the Cache Components root layout puts the page behind Suspense and the group wrappers keep their shells', () => {
  const ppr = fs.readFileSync(path.join(ROUTES, 'layout.ppr.tsx'), 'utf8')
  assert.match(ppr, /<main><Suspense fallback=\{null\}>\{children\}<\/Suspense><\/main>/)
  const groups = fs.readFileSync(path.join(ROUTES, '_internal/group-layouts.cc.tsx'), 'utf8')
  assert.match(groups, /<Suspense fallback=\{null\}>\{children\}<\/Suspense>/, 'the static wrappers put the group pages behind Suspense')
  assert.match(groups, /DynamicMarker/, 'the request-messages wrappers declare their area request-time')
})

/**
 * The generated host's per-entity routes are given their entity's config: the modules they call look no entity
 * up by a runtime key and import no entity registry, so a route's module graph holds the one entity it serves.
 * (The client views and wrappers they render read the client registry by slug; that is components, not routes.)
 */
test('the per-entity route modules import no entity registry and look no entity or template up by a key', () => {
  const modules = walk(path.join(ROUTES, '_internal')).filter(file =>
    /^(entity-(layout|list|detail|create|edit)-route|entity-dashboard|public-(item|archive)-route|public-entity-shared)\.tsx?$/.test(file)
  )
  assert.deepEqual(modules.sort(), [
    'entity-create-route.tsx', 'entity-dashboard.ts', 'entity-detail-route.tsx', 'entity-edit-route.tsx', 'entity-layout-route.tsx',
    'entity-list-route.tsx', 'public-archive-route.tsx', 'public-entity-shared.tsx', 'public-item-route.tsx',
  ])
  const lookup = /registries\/entity-registry|\b(getEntity|getEntityRegistry|getChildEntities|setEntityRegistry|getRegisteredEntities|matchPathToEntity|resolvePublicEntityFromUrl)\s*\(|\b(getTemplateOrDefault|hasTemplateOverride|getTemplateComponent)\b/
  const offenders = modules.filter(file => lookup.test(fs.readFileSync(path.join(ROUTES, '_internal', file), 'utf8')))
  assert.deepEqual(offenders, [])
})

test('each per-entity route kind has a module of its own, so a route imports only the client components it renders', () => {
  const clientWrappers = (file: string) => [...fs.readFileSync(path.join(ROUTES, '_internal', file), 'utf8').matchAll(/from '(@nextsparkjs\/core\/components\/[^']+|\.\/entity-(?:create|edit)-view)'/g)].map(match => match[1])
  assert.deepEqual(clientWrappers('entity-list-route.tsx'), ['@nextsparkjs/core/components/entities/wrappers/EntityListWrapper'])
  assert.deepEqual(clientWrappers('entity-detail-route.tsx'), ['@nextsparkjs/core/components/entities/wrappers/EntityDetailWrapper'])
  assert.deepEqual(clientWrappers('entity-create-route.tsx'), ['./entity-create-view'])
  assert.deepEqual(clientWrappers('entity-edit-route.tsx'), ['./entity-edit-view'])
  assert.deepEqual(clientWrappers('entity-layout-route.tsx'), [])
  assert.deepEqual(clientWrappers('public-archive-route.tsx'), ['@nextsparkjs/core/components/public/entities/PublicEntityGrid'])
  assert.deepEqual(clientWrappers('public-item-route.tsx'), ['@nextsparkjs/core/components/public/pageBuilder'])
})

/**
 * Core's protections are always the outer layer of a composition: a composed override of a protected layout gets core's
 * guard around the project's layout (and only inside it the project's layout), never the messages wrapper alone.
 */
test('a group layout with a role guard is composed only through a wrapper that puts the guard around the project layout, in both rendering modes', () => {
  const guarded: Array<{ target: string; guard: string; wrapper: string; helper: string; messages: string }> = [
    { target: 'superadmin/layout.tsx', guard: 'SuperAdminGuard', wrapper: 'withSuperadminGuard', helper: 'guardSuperadminLayout', messages: 'withSuperadminMessages' },
    { target: 'devtools/layout.tsx', guard: 'DeveloperGuard', wrapper: 'withDevtoolsGuard', helper: 'guardDevtoolsLayout', messages: 'withDevtoolsMessages' },
  ]
  const variantOf = (target: string) => variants.cacheComponents.find(candidate => candidate.target === target)!
  for (const { target, guard, wrapper, helper, messages } of guarded) {
    const entry = manifest.find(candidate => candidate.target === target)!
    // ISR module and Cache Components module: the same wrapper name, the same specifier the facade grammar allows
    for (const composed of [entry, variantOf(target)]) {
      assert.equal(composed.compose?.wrapper, wrapper, `${target} (${composed.specifier}) is composed with ${wrapper}`)
      const source = fs.readFileSync(sourceOf(composed.compose!.specifier), 'utf8')
      assert.ok(source.includes(`export function ${wrapper}(`) || source.includes(`export const ${wrapper} =`), `${wrapper} is exported by ${composed.compose!.specifier}`)
      assert.ok(source.includes(`${messages}(${helper}(ProjectLayout))`), `${wrapper}: messages, then ${helper} around the project layout`)
      assert.ok(STATIC_IMPORTS.CORE_COMPOSITION_WRAPPERS[composed.compose!.specifier].includes(wrapper), `${wrapper} is on the facade grammar's allowlist for ${composed.compose!.specifier}`)
    }
    // The helper the wrapper uses is the one that puts the guard around the project layout, whatever the mode
    const base = fs.readFileSync(sourceOf(entry.compose!.specifier), 'utf8')
    const start = base.indexOf(`export function ${helper}(`)
    assert.ok(start >= 0, `${helper} is exported`)
    const body = base.slice(start)
    const at = (needle: string) => body.indexOf(needle)
    assert.ok(at(`<${guard}>`) > 0 && at('<ProjectLayout>') > at(`<${guard}>`) && at('</ProjectLayout>') < at(`</${guard}>`), `${helper}: <${guard}> wraps <ProjectLayout>`)
    // The Cache Components variant of core's own layout still renders core's layout (which holds the guard itself)
    assert.match(fs.readFileSync(sourceOf(variantOf(target).specifier), 'utf8'), /export default with\w+Messages\((SuperadminLayout|DevLayout)\)/)
  }
  // Any other layout whose default module imports a guard must be listed above: a new guard cannot be forgotten
  const guardImport = /components\/app\/guards\/(\w+)/
  for (const entry of manifest.filter(candidate => candidate.compose)) {
    const defaults = fs.readFileSync(sourceOf(entry.specifier), 'utf8') + fs.readFileSync(sourceOf(entry.compose!.specifier), 'utf8')
    if (guardImport.test(defaults)) assert.ok(guarded.some(item => item.target === entry.target), `${entry.target} has a role guard: add it to the guarded list`)
  }
  assert.ok(!Object.values(STATIC_IMPORTS.CORE_COMPOSITION_WRAPPERS).flat().some(name => /^with(Superadmin|Devtools)Messages$/.test(name)), 'the messages-only wrappers of the guarded groups are not callable from a facade')
  // protected_all layouts cannot be replaced: the dashboard layout variant carries the same protection as its base (host-plan.test.mjs)
})

/**
 * The per-entity routes carry only their own entity: no module they reach, in core, imports the generated client entity
 * registry (which imports every entity's config) as a value. Type imports are erased and do not count.
 */
test('a per-entity route\'s core module graph never imports the generated client entity registry', () => {
  const resolveModule = (from: string, specifier: string): string | null => {
    const base = specifier.startsWith('.')
      ? path.resolve(path.dirname(from), specifier)
      : specifier.startsWith('@nextsparkjs/core/') ? path.join(CORE, 'src', specifier.slice('@nextsparkjs/core/'.length)) : null
    if (!base) return null
    return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
  }
  const importsOf = (file: string): Array<{ specifier: string; typeOnly: boolean }> => {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const found: Array<{ specifier: string; typeOnly: boolean }> = []
    for (const statement of source.statements) {
      if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
        const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined
        const typeOnly = Boolean(clause?.isTypeOnly) || (ts.isExportDeclaration(statement) && statement.isTypeOnly) ||
          Boolean(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name && clause.namedBindings.elements.every(element => element.isTypeOnly))
        found.push({ specifier: statement.moduleSpecifier.text, typeOnly })
      }
    }
    return found
  }
  const offenders: string[] = []
  const roots = ['entity-layout-route', 'entity-list-route', 'entity-detail-route', 'entity-create-route', 'entity-edit-route', 'public-item-route', 'public-archive-route']
  for (const root of roots) {
    const start = ['.tsx', '.ts'].map(extension => path.join(ROUTES, '_internal', root + extension)).find(candidate => fs.existsSync(candidate))!
    const seen = new Set<string>()
    const queue = [start]
    while (queue.length > 0) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      for (const { specifier, typeOnly } of importsOf(file)) {
        if (typeOnly) continue
        if (/registries\/entity-registry(\.client)?$/.test(specifier)) {
          offenders.push(`${root} -> ${path.relative(CORE, file)} imports ${specifier}`)
          continue
        }
        const next = resolveModule(file, specifier)
        if (next) queue.push(next)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

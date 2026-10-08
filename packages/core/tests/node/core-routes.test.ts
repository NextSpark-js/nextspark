/**
 * Core routes (#203): every framework route is a module of @nextsparkjs/core under
 * src/routes, listed in src/routes/manifest.json, and the generated host emits one
 * facade per entry with the stage-1 facade emitter. These tests hold that together:
 *
 * - the manifest is what scripts/build/routes-manifest.mjs writes from the files,
 *   in the shape of the host-conformance fixture's CORE_ROUTES (a layout may also
 *   carry `compose`, the wrapper a project override of it is composed with, and the layout of a role-gated
 *   area `access`, the wrapper every page and layout under it is composed with);
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

type Entry = { kind: string; target: string; specifier: string; compose?: { wrapper: string; specifier: string }; access?: { wrapper: string; metadata?: string; handler?: string; specifier: string } }
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

test('entries have the shape of the conformance fixture: kind, target, specifier (and compose, on wrapped layouts, and access, on role-gated areas)', () => {
  const shape = Object.keys(FIXTURE_ROUTES[0]).sort()
  assert.deepEqual(shape, ['kind', 'specifier', 'target'])
  for (const entry of [...manifest, ...Object.values(variants).flat()]) {
    assert.deepEqual(Object.keys(entry).filter(key => key !== 'compose' && key !== 'access').sort(), shape, JSON.stringify(entry))
    assert.ok(ROUTE_KINDS.includes(entry.kind), `${entry.target}: unknown kind ${entry.kind}`)
    assert.match(entry.specifier, /^@nextsparkjs\/core\/routes\//)
    sourceOf(entry.specifier)
  }
  for (const entry of manifest) assert.equal(entry.specifier, specifierForRouteFile(entry.target))
  assert.equal(new Set(manifest.map(entry => entry.target)).size, manifest.length, 'one entry per target')
})

test('the manifest lists exactly the route files under src/routes, and every variant is one of them', () => {
  // _ folders hold helpers, variants replace a manifest route, presets.ts belongs to the API Explorer
  const routeLike = /(^|\/)(page|layout|loading|error|not-found|template|default|route|global-error|global-not-found|forbidden|unauthorized|robots)\.(tsx|ts)$/
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
      '(auth)/layout.cc.tsx', '(auth)/login/page.cc.tsx', '(auth)/signup/page.cc.tsx', '(public)/docs/[section]/[page]/page.cc.tsx', '(public)/layout.cc.tsx', '(public)/page.cc.tsx',
      'dashboard/(main)/layout.cc.tsx', 'dashboard/layout.cc.tsx', 'devtools/layout.cc.tsx', 'layout.ppr.tsx', 'superadmin/docs/[section]/[page]/page.cc.tsx', 'superadmin/layout.cc.tsx',
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
 * A project that overrides the public or auth layout is composed with these modules (and gets its fallback metadata from
 * them): every client component they reach, even one the override never renders, ships on every route of the group. So they
 * import no component, provider (but the messages one, which the root layout ships anyway) or other group's layout (#192).
 */
test('the composition modules of the public and auth layouts reach no client component', () => {
  const composeModules = [...new Set([...Object.values(COMPOSED_ROUTES), ...variants.cacheComponents.map(entry => entry.compose).filter(Boolean)]
    .filter((compose: { wrapper: string }) => /^with(Public|Auth)Messages$/.test(compose.wrapper))
    .map((compose: { specifier: string }) => compose.specifier))]
  assert.equal(composeModules.length, 4, composeModules.join(', '))
  const offenders: string[] = []
  const seen = new Set<string>()
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const [, specifier] of fs.readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
      if (/@nextsparkjs\/core\/(components\/|providers\/(?!static-intl-provider$))|\/(superadmin|devtools|default-(public|auth))-layout$/.test(specifier)) offenders.push(`${path.relative(ROUTES, file)} -> ${specifier}`)
      if (specifier.startsWith('.')) visit(sourceOf(path.posix.join('@nextsparkjs/core/routes', path.relative(ROUTES, path.dirname(file)).split(path.sep).join('/'), specifier)))
    }
  }
  for (const specifier of composeModules) visit(sourceOf(specifier))
  assert.deepEqual(offenders, [])
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
 * The role check of /superadmin and /devtools does not depend on the project's proxy (#203, S21): the group message
 * wrapper of both rendering modes checks the session on the server before the layout renders, and every page and layout
 * under the area is composed with an access wrapper (a layout cannot protect its pages: Next renders each segment
 * separately). In Cache Components mode that wrapper comes from area-access.cc, which runs the same check inside the
 * segment's own Suspense boundary (#213: a check outside one makes the dev server report the segment as not instant).
 */
test('the role-gated areas check the role on the server in the group wrapper of both modes and in every segment under them', () => {
  const areas = [
    { target: 'superadmin/layout.tsx', area: 'superadmin', access: 'withSuperadminAccess', metadata: 'withSuperadminMetadata', handler: 'withSuperadminRouteAccess', messages: 'withSuperadminMessages', ccMessages: 'withSuperadminAreaMessages', guard: 'withSuperadminGuard' },
    { target: 'devtools/layout.tsx', area: 'devtools', access: 'withDevtoolsAccess', metadata: 'withDevtoolsMetadata', handler: 'withDevtoolsRouteAccess', messages: 'withDevtoolsMessages', ccMessages: 'withDevtoolsAreaMessages', guard: 'withDevtoolsGuard' },
  ]
  const accessModule = `${ROUTES_SUBPATH}/_internal/area-access`
  const ccAccessModule = `${ROUTES_SUBPATH}/_internal/area-access.cc`
  const accessSource = fs.readFileSync(sourceOf(accessModule), 'utf8')
  const ccAccessSource = fs.readFileSync(sourceOf(ccAccessModule), 'utf8')
  const shared = fs.readFileSync(sourceOf(`${ROUTES_SUBPATH}/_internal/group-layouts.cc`), 'utf8')
  for (const { target, area, access, metadata, handler, messages, ccMessages, guard } of areas) {
    const entry = manifest.find(candidate => candidate.target === target)!
    const variant = variants.cacheComponents.find(candidate => candidate.target === target)!
    assert.deepEqual(entry.access, { wrapper: access, metadata, handler, specifier: accessModule }, `${entry.specifier} declares ${access}`)
    assert.deepEqual(variant.access, { wrapper: access, metadata, handler, specifier: ccAccessModule }, `${variant.specifier} declares ${access} from area-access.cc`)
    for (const wrapper of [access, metadata, handler]) {
      assert.ok(accessSource.includes(`export function ${wrapper}<`), `${accessModule} exports ${wrapper}`)
      for (const module of [accessModule, ccAccessModule]) {
        assert.ok(STATIC_IMPORTS.CORE_COMPOSITION_WRAPPERS[module].includes(wrapper), `${wrapper} is on the facade grammar's allowlist for ${module}`)
      }
    }
    // area-access.cc: its own segment wrapper; metadata and Route Handlers are area-access's, re-exported
    assert.ok(ccAccessSource.includes(`export function ${access}<`), `${ccAccessModule} exports ${access}`)
    for (const wrapper of [metadata, handler]) {
      assert.match(ccAccessSource, new RegExp(`export \\{[^}]*\\b${wrapper}\\b[^}]*\\} from './area-access'`), `${ccAccessModule} re-exports ${wrapper}`)
    }
    // ISR: the wrapper awaits the check before anything else, so a page load without the role gets a 307
    const isr = fs.readFileSync(sourceOf(entry.compose!.specifier), 'utf8')
    const body = isr.slice(isr.indexOf(`export function ${messages}(`))
    assert.match(body, new RegExp(`async function \\w+\\([^)]*\\) \\{\\s*await requireAreaAccess\\('${area}'\\)`), `${messages} (ISR) checks '${area}' first`)
    // Cache Components: the area's own module puts the check (in its own Suspense boundary) inside the messages, for
    // core's default layout and for a composed override alike
    const cc = fs.readFileSync(sourceOf(variant.compose!.specifier), 'utf8')
    assert.ok(cc.includes(`export const ${ccMessages} = (Layout: ComponentType<`) && cc.includes(`=> ${messages}(withAreaGate('${area}', Layout))`), `${ccMessages} checks '${area}'`)
    assert.ok(cc.includes(`export const ${guard} = (ProjectLayout: ComponentType<`) && cc.includes(`=> ${ccMessages}(`), `${guard} goes through ${ccMessages}`)
    assert.match(fs.readFileSync(sourceOf(variant.specifier), 'utf8'), new RegExp(`export default ${ccMessages}\\(`), `core's ${target} variant renders through ${ccMessages}`)
  }
  assert.match(accessSource, /async function AreaGate\([^)]*\) \{\s*await requireAreaAccess\(area\)/)
  assert.match(accessSource, /<Suspense fallback=\{null\}>\s*<AreaGate area=\{area\}>/)
  assert.match(ccAccessSource, /async function AreaSegmentGate\([^)]*\) \{\s*await requireAreaAccess\(area\)\s*return <Segment \{\.\.\.props\} \/>/)
  assert.match(ccAccessSource, /<Suspense fallback=\{null\}>\s*<AreaSegmentGate \{\.\.\.props\} \/>\s*<\/Suspense>/)
  // The message module public and auth layouts import reaches none of it
  assert.doesNotMatch(shared, /from '\.\/(area-access|superadmin-layout|devtools-layout)/)
  // No other layout declares access
  assert.deepEqual(manifest.filter(candidate => candidate.access).map(candidate => candidate.target).sort(), areas.map(item => item.target).sort())
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
      // The Cache Components module puts the server-side role check between the messages and the helper
      const viaMessages = composed === entry ? messages : messages.replace(/Messages$/, 'AreaMessages')
      // ISR: the guard shows its loading state until the client session loads; Cache Components: the guard is told the
      // server checked the role (`serverChecked`), so the server render holds the area's segments (#213)
      const helperCall = composed === entry ? `${helper}(ProjectLayout)` : `${helper}(ProjectLayout, true)`
      assert.ok(source.includes(`${viaMessages}(${helperCall})`), `${wrapper}: messages, then ${helperCall} around the project layout`)
      assert.ok(STATIC_IMPORTS.CORE_COMPOSITION_WRAPPERS[composed.compose!.specifier].includes(wrapper), `${wrapper} is on the facade grammar's allowlist for ${composed.compose!.specifier}`)
    }
    // The helper the wrapper uses is the one that puts the guard around the project layout, whatever the mode
    const base = fs.readFileSync(sourceOf(entry.compose!.specifier), 'utf8')
    const start = base.indexOf(`export function ${helper}(`)
    assert.ok(start >= 0, `${helper} is exported`)
    const body = base.slice(start)
    const at = (needle: string) => body.indexOf(needle)
    const open = `<${guard} serverChecked={serverChecked}>`
    assert.ok(at(open) > 0 && at('<ProjectLayout>') > at(open) && at('</ProjectLayout>') < at(`</${guard}>`), `${helper}: <${guard}> wraps <ProjectLayout>`)
    assert.match(body, new RegExp(`^export function ${helper}\\(ProjectLayout: [^,]+, serverChecked = false\\)`), `${helper}: serverChecked is off unless asked`)
    // The Cache Components variant of core's own layout still renders core's layout (which holds the guard itself),
    // telling its guard that the server checked the role
    const ccLayout = fs.readFileSync(sourceOf(variantOf(target).specifier), 'utf8')
    assert.match(ccLayout, /export default with\w+AreaMessages\(ServerChecked(SuperadminLayout|DevLayout)\)/)
    assert.match(ccLayout, /return <(SuperadminLayout|DevLayout) serverChecked>\{children\}<\/\1>/)
    // ...and the ISR layout does not
    assert.doesNotMatch(fs.readFileSync(sourceOf(entry.specifier), 'utf8'), /serverChecked/)
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

test('the default /signup page redirects outside Suspense (a real 307); the Cache Components variant renders it behind its own boundary', () => {
  const legacy = fs.readFileSync(path.join(ROUTES, '(auth)/signup/page.tsx'), 'utf8')
  const cc = fs.readFileSync(path.join(ROUTES, '(auth)/signup/page.cc.tsx'), 'utf8')
  assert.match(legacy, /redirect\('\/login'\)/)
  assert.doesNotMatch(legacy, /<Suspense|import { Suspense/, 'redirect() thrown inside a Suspense boundary reaches the browser as a 200 with a meta refresh')
  assert.match(cc, /import SignupPage, \{ metadata \} from '\.\/page'/)
  assert.match(cc, /<Suspense fallback=\{null\}>\s*<SignupPage searchParams=\{searchParams\} \/>\s*<\/Suspense>/, 'a page that redirects needs a boundary under the segment the dev server validates')
})

test('/signup redirects to /login under the passwordless preset unless it opens an invitation', () => {
  const legacy = fs.readFileSync(path.join(ROUTES, '(auth)/signup/page.tsx'), 'utf8')
  // signup-with-invite registers with or without a password, so an invitation link keeps the form
  assert.match(legacy, /const invited = typeof \(await searchParams\)\?\.inviteToken === 'string'/)
  assert.match(legacy, /if \(!invited && !resolveAuthMethods\(AUTH_CONFIG\)\.includes\('email-password'\)\) \{\s*redirect\('\/login'\)/)
})

/**
 * Next.js's dev server validates every page of a Cache Components host for instant navigation (it logs "Could not
 * validate that a segment in your UI has instant navigation" and the dev badge shows an issue). What it reports
 * in the starter's routes, and how they avoid it (#203):
 */
test('the Cache Components main dashboard layout checks the entity permission behind Suspense; the default one before the shell', () => {
  const read = (file: string) => fs.readFileSync(path.join(ROUTES, file), 'utf8')
  const legacy = read('dashboard/(main)/layout.tsx')
  const cc = read('dashboard/(main)/layout.cc.tsx')
  const shared = read('_internal/dashboard-main-shared.tsx')
  // The ISR layout still answers a denied request with a real redirect: the check runs before anything renders
  assert.match(legacy, /await enforceEntityPermission\(\)\s*\n\s*\n?\s*return <MainDashboardShell>/)
  assert.doesNotMatch(legacy, /<Suspense/)
  // The Cache Components one renders the shell at once and checks inside a boundary around the page
  assert.match(cc, /<MainDashboardShell>\s*<Suspense fallback=\{null\}>\s*<EntityPermission>\{children\}<\/EntityPermission>\s*<\/Suspense>\s*<\/MainDashboardShell>/)
  assert.match(cc, /await enforceEntityPermission\(\)/)
  assert.doesNotMatch(cc.replace(/async function EntityPermission[\s\S]*?\n}\n/, ''), /await\s/, 'the layout itself awaits nothing')
  // The check itself is shared, so the two cannot drift
  assert.match(shared, /export async function enforceEntityPermission/)
  assert.match(shared, /redirect\(`\/dashboard\/permission-denied/)
})

test('the public archive page reads the search parameters behind Suspense (request data outside it makes the route not instant)', () => {
  const archive = fs.readFileSync(path.join(ROUTES, '_internal/public-archive-route.tsx'), 'utf8')
  assert.match(archive, /<Suspense fallback=\{null\}>\s*<ArchiveGrid config=\{config\} searchParams=\{searchParams\} \/>\s*<\/Suspense>/)
  assert.doesNotMatch(archive.replace(/async function ArchiveGrid[\s\S]*?\n}\n/, ''), /await searchParams/)
})

test('the dashboard auth gate renders the page while the session loads (a skeleton in its place drops the route segments from the server render)', () => {
  const gate = fs.readFileSync(path.join(CORE, 'src/components/dashboard/layouts/AuthenticatedDashboardLayout.tsx'), 'utf8')
  assert.doesNotMatch(gate, /if \(isLoading\) return/)
  assert.doesNotMatch(gate, /DashboardAuthSkeleton/)
  assert.match(gate, /if \(!isLoading && !user\) return null/)
})

test('the reserved root slugs are the top-level segments core serves (#215), plus _next', async () => {
  const { RESERVED_SLUGS } = await import(path.join(CORE, 'src/lib/constants/reserved-slugs.ts'))
  const segments = new Set<string>(['_next'])
  for (const entry of JSON.parse(fs.readFileSync(path.join(ROUTES, 'manifest.json'), 'utf8')) as Entry[]) {
    const [first, ...rest] = entry.target.split('/').filter(part => !/^\(.*\)$/.test(part))
    if (rest.length > 0) segments.add(first) // a lone file (page.tsx, layout.tsx, robots.ts) is not a segment
  }
  assert.deepEqual([...RESERVED_SLUGS].sort(), [...segments].sort())
})

/**
 * Stage 4 (#203): one generated route per entity. The host writes concrete routes for every entity,
 * each a composed facade over its config (and the project's template when it has one); nothing
 * resolves an entity or a template by a runtime key.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-entities.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { ENTITY_DIAGNOSTICS, ENTITY_MODULES, entityConfigFile, planEntityRoutes, readAllEntityFacts, readEntityFacts, routableEntities } from '../entity-routes.mjs'
import { PLAN_DIAGNOSTICS, planHost, urlConflicts } from '../plan.mjs'
import { renderHost } from '../render.mjs'
import { validateGeneratedModule } from '../static-imports.mjs'
import { loadTypeScriptFor } from '../../shared/typescript-compiler.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const ts = await loadTypeScriptFor(CORE_ROOT)

const factories = (...names) => names.map(name => `export function ${name}() { return () => null }`).join('\n')
/** The fake core module of each factory module, by specifier. */
const CORE_MODULES = {
  [ENTITY_MODULES.layout]: ['core/entity-layout-route.tsx', factories('createEntityLayoutRoute')],
  [ENTITY_MODULES.list]: ['core/entity-list-route.tsx', factories('createEntityListRoute')],
  [ENTITY_MODULES.detail]: ['core/entity-detail-route.tsx', factories('createEntityDetailRoute')],
  [ENTITY_MODULES.create]: ['core/entity-create-route.tsx', factories('createEntityCreateRoute')],
  [ENTITY_MODULES.edit]: ['core/entity-edit-route.tsx', factories('createEntityEditRoute')],
  [ENTITY_MODULES.publicItem]: ['core/public-item-route.tsx', factories('createPublicItemRoute', 'createPublicItemMetadata')],
  [ENTITY_MODULES.publicItemCc]: ['core/public-item-route.cc.tsx', factories('createPublicItemRoute', 'createPublicItemMetadata')],
  [ENTITY_MODULES.publicArchive]: ['core/public-archive-route.tsx', factories('createPublicArchiveRoute', 'createPublicArchiveMetadata')],
}

const config = (body, exportName = 'taskEntityConfig') => `export const ${exportName} = {\n${body}\n}\n`
const TASKS = config("  slug: 'tasks',\n  enabled: true,\n  ui: { dashboard: { showInMenu: true } },")
const PAGE = 'export default function Page() { return null }\n'

/** A temporary project, and fake core modules for the factories the entity routes import. */
function world(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-entities-'))
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  for (const [file, content] of Object.values(CORE_MODULES)) write(file, content)
  write('core/entity-page.tsx', "export const metadata = { title: 'Dashboard' }\n")
  write('core/entity-detail-page.tsx', "export const metadata = { title: 'Dashboard' }\n")
  write('core/entity-error.tsx', "'use client'\nexport default function E() { return null }\n")
  write('core/entity-loading.tsx', 'export default function L() { return null }\n')
  for (const [path, content] of Object.entries(files)) write(`source/${path}`, content)
  const files_ = {
    ...Object.fromEntries(Object.entries(CORE_MODULES).map(([specifier, [file]]) => [specifier, file])),
    '@nextsparkjs/core/routes/dashboard/(main)/[entity]/page': 'core/entity-page.tsx',
    '@nextsparkjs/core/routes/dashboard/(main)/[entity]/[id]/page': 'core/entity-detail-page.tsx',
    '@nextsparkjs/core/routes/dashboard/(main)/[entity]/error': 'core/entity-error.tsx',
    '@nextsparkjs/core/routes/dashboard/(main)/[entity]/loading': 'core/entity-loading.tsx',
  }
  const resolveFile = specifier => (files_[specifier] ? join(root, files_[specifier]) : null)
  return { root, source: join(root, 'source'), write, resolveFile, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const entity = (name, exportName, extra = {}) => ({
  name,
  exportName,
  configPath: `@/entities/${name}/${name}.config`,
  relativePath: name,
  parent: null,
  children: [],
  source: 'project',
  ...extra,
})

/** Facts for `entity` from `body`, through the real reader. */
async function facts(body, exportName = 'taskEntityConfig') {
  const result = await readEntityFacts({ source: config(body, exportName), file: '/virtual/x.config.ts', exportName, projectRoot: CORE_ROOT })
  assert.ok(result.facts, result.error)
  return result.facts
}
const value = fact => (fact.state === 'value' ? fact.value : fact.state)

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

test('entity facts are read from the config source as literals, and say when they cannot be', async () => {
  const f = await facts(`
    slug: 'posts',
    enabled: true,
    access: { public: true, basePath: '/blog', allowNestedSlugs: true },
    ui: { dashboard: { showInMenu: false }, public: { hasArchivePage: true } },
    builder: { enabled: true },
  `)
  assert.deepEqual(Object.fromEntries(Object.entries(f).map(([name, fact]) => [name, value(fact)])), {
    slug: 'posts', enabled: true, showInMenu: false, basePath: '/blog', legacyBasePath: 'absent', allowNestedSlugs: true, isPublic: true, builderEnabled: true, hasArchivePage: true,
  })

  const unknown = await facts(`
    slug: SLUG,
    enabled: isEnabled(),
    access: baseAccess,
    ui: { ...baseUi, dashboard: { showInMenu } },
    builder: { enabled: flags['builder'] },
  `)
  assert.deepEqual(Object.fromEntries(Object.entries(unknown).map(([name, fact]) => [name, value(fact)])), {
    slug: 'unknown', enabled: 'unknown', showInMenu: 'unknown', basePath: 'unknown', legacyBasePath: 'absent', allowNestedSlugs: 'unknown', isPublic: 'unknown', builderEnabled: 'unknown', hasArchivePage: 'unknown',
  })

  // Spreads make an absent key unknown, a later literal still wins, and `as const` / `satisfies` are looked through
  const spread = await readEntityFacts({ source: "export const a = { ...base, slug: 'a' } as const satisfies X\n", file: '/x.ts', exportName: 'a', projectRoot: CORE_ROOT })
  assert.equal(value(spread.facts.slug), 'a')
  assert.equal(value(spread.facts.enabled), 'unknown')

  assert.match((await readEntityFacts({ source: 'export const a = makeConfig()\n', file: '/x.ts', exportName: 'a', projectRoot: CORE_ROOT })).error, /not an object literal/)
  assert.match((await readEntityFacts({ source: 'export const b = {}\n', file: '/x.ts', exportName: 'a', projectRoot: CORE_ROOT })).error, /has no `const a = \{ \.\.\. \}`/)
  assert.match((await readEntityFacts({ source: 'export const = ;', file: '/x.ts', exportName: 'a', projectRoot: CORE_ROOT })).error, /does not parse/)
})

test('the entities the host serves are the top-level entity configs of the project and its plugins', () => {
  const entities = [
    entity('tasks', 'taskEntityConfig'),
    entity('comments', 'commentChildConfig', { parent: 'tasks' }),
    entity('nested', 'nestedEntityConfig', { parent: 'tasks' }),
    entity('patterns', 'patternsEntityConfig', { source: 'core', isCore: true }),
    entity('notes', 'notesEntityConfig', { source: 'plugin', pluginContext: { pluginName: 'notes' } }),
  ]
  assert.deepEqual(routableEntities(entities).map(e => e.name), ['tasks', 'notes'])
})

test('a config file is found from its import specifier: the project\'s, a plugin\'s, else none', () => {
  const w = world({ 'entities/tasks/tasks.config.ts': TASKS })
  try {
    assert.equal(entityConfigFile(entity('tasks', 't'), { projectRoot: w.source }), join(w.source, 'entities/tasks/tasks.config.ts'))
    const plugin = { name: 'notes', root: join(w.root, 'plugins/notes'), importBase: '@nextsparkjs/plugin-notes' }
    assert.equal(entityConfigFile(entity('notes', 'n', { configPath: '@nextsparkjs/plugin-notes/entities/notes/notes.config' }), { projectRoot: w.source, plugins: [plugin] }), join(plugin.root, 'entities/notes/notes.config.ts'))
    assert.equal(entityConfigFile(entity('x', 'x', { configPath: '@other/pkg/entities/x/x.config' }), { projectRoot: w.source, plugins: [plugin] }), null)
  } finally {
    w.cleanup()
  }
})

// ---------------------------------------------------------------------------
// Dashboard routes
// ---------------------------------------------------------------------------

async function plan(w, entities, factsByName, { coreRoutes = [], plugins = [], modes = [], cacheComponents } = {}) {
  const { routes: entityRoutes, diagnostics: entityDiagnostics } = planEntityRoutes({
    entities,
    facts: new Map(Object.entries(factsByName)),
    coreRoutes,
    resolveFile: w.resolveFile,
    cacheComponents,
    modes,
  })
  const planned = planHost({ coreRoutes, entityRoutes, plugins, project: { root: w.source } })
  return { routes: planned.routes, diagnostics: [...entityDiagnostics, ...planned.diagnostics] }
}
const factsOf = async body => ({ facts: await facts(body) })
const render = async routes => renderHost({ routes, projectRoot: CORE_ROOT })
const targets = routes => routes.map(route => route.target)
const at = (result, path) => result.files.find(file => file.path === `src/app/${path}`)?.content

test('every entity the dashboard serves gets its own layout, error, loading, list, create, detail and edit routes', async () => {
  const w = world()
  try {
    const { routes, diagnostics } = await plan(w, [entity('tasks', 'taskEntityConfig')], { tasks: { facts: await facts("slug: 'tasks', enabled: true, ui: { dashboard: { showInMenu: true } }") } })
    assert.deepEqual(diagnostics, [])
    assert.deepEqual(targets(routes), [
      'dashboard/(main)/tasks/[id]/edit/page.tsx',
      'dashboard/(main)/tasks/[id]/page.tsx',
      'dashboard/(main)/tasks/create/page.tsx',
      'dashboard/(main)/tasks/error.tsx',
      'dashboard/(main)/tasks/layout.tsx',
      'dashboard/(main)/tasks/loading.tsx',
      'dashboard/(main)/tasks/page.tsx',
    ])
    const result = await render(routes)
    assert.deepEqual(result.diagnostics, [])
    const header = '// Generated by NextSpark for entities/tasks (taskEntityConfig). Do not edit: regenerated on every build.'
    assert.equal(
      at(result, 'dashboard/(main)/tasks/page.tsx'),
      [
        header,
        'import { taskEntityConfig } from "@/entities/tasks/tasks.config"',
        `import { createEntityListRoute } from "${ENTITY_MODULES.list}"`,
        'export default createEntityListRoute(taskEntityConfig)',
        'export { metadata } from "@nextsparkjs/core/routes/dashboard/(main)/[entity]/page"',
        '',
      ].join('\n')
    )
    assert.match(at(result, 'dashboard/(main)/tasks/[id]/page.tsx'), /export default createEntityDetailRoute\(taskEntityConfig, \[\]\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/layout.tsx'), /export default createEntityLayoutRoute\(taskEntityConfig\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/create/page.tsx'), /export default createEntityCreateRoute\(taskEntityConfig\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/[id]/edit/page.tsx'), /export default createEntityEditRoute\(taskEntityConfig\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/error.tsx'), /^\/\/ Generated by .*\n'use client'\n\nexport \{ default \} from "@nextsparkjs\/core\/routes\/dashboard\/\(main\)\/\[entity\]\/error"\n$/)
    // Each route imports the factory of its own kind only (a shared module would give every route the client code of all)
    const modulesOf = path => [...at(result, path).matchAll(/from "(@nextsparkjs\/core\/routes\/_internal\/[^"]+)"/g)].map(match => match[1])
    assert.deepEqual(modulesOf('dashboard/(main)/tasks/page.tsx'), [ENTITY_MODULES.list])
    assert.deepEqual(modulesOf('dashboard/(main)/tasks/[id]/page.tsx'), [ENTITY_MODULES.detail])
    assert.deepEqual(modulesOf('dashboard/(main)/tasks/create/page.tsx'), [ENTITY_MODULES.create])
    assert.deepEqual(modulesOf('dashboard/(main)/tasks/[id]/edit/page.tsx'), [ENTITY_MODULES.edit])
    assert.deepEqual(modulesOf('dashboard/(main)/tasks/layout.tsx'), [ENTITY_MODULES.layout])
    // Every file passes the grammar gate, and none of them looks anything up by a key
    for (const file of result.files) {
      assert.deepEqual(validateGeneratedModule({ ts, source: file.content, file: file.path, grammar: file.grammar }), [], file.path)
      assert.doesNotMatch(file.content, /getTemplateOrDefault|template-scopes|\[entity\]\/page'|ENTITY_REGISTRY/)
    }
    assert.equal(result.files.find(file => file.path.endsWith('layout.tsx')).grammar, 'composed-facade')
    assert.equal(routes.find(route => route.target.endsWith('/layout.tsx')).protected, true, 'the permission layout cannot be replaced')
  } finally {
    w.cleanup()
  }
})

test('a project template for an entity page is composed into the route: it runs after the same checks', async () => {
  const w = world({
    'templates/dashboard/(main)/tasks/page.tsx': PAGE,
    'templates/dashboard/(main)/tasks/[id]/page.tsx': PAGE,
    'templates/dashboard/(main)/tasks/create/page.tsx': PAGE,
  })
  try {
    const { routes, diagnostics } = await plan(w, [entity('tasks', 'taskEntityConfig', { children: ['comments', 'notes'] })], { tasks: await factsOf("slug: 'tasks', enabled: true") })
    assert.deepEqual(diagnostics, [])
    const result = await render(routes)
    assert.deepEqual(result.diagnostics, [])
    assert.equal(
      at(result, 'dashboard/(main)/tasks/page.tsx'),
      [
        '// Generated by NextSpark for entities/tasks (taskEntityConfig). Do not edit: regenerated on every build.',
        'import NextSparkTemplate from "@/templates/dashboard/(main)/tasks/page"',
        'import { taskEntityConfig } from "@/entities/tasks/tasks.config"',
        `import { createEntityListRoute } from "${ENTITY_MODULES.list}"`,
        'export default createEntityListRoute(taskEntityConfig, NextSparkTemplate)',
        'export { metadata } from "@nextsparkjs/core/routes/dashboard/(main)/[entity]/page"',
        '',
      ].join('\n')
    )
    assert.match(at(result, 'dashboard/(main)/tasks/[id]/page.tsx'), /export default createEntityDetailRoute\(taskEntityConfig, \["comments","notes"\], NextSparkTemplate\)/)
    // Create and edit take a template too, composed after core's checks; the generated factory is never discarded
    assert.match(at(result, 'dashboard/(main)/tasks/create/page.tsx'), /export default createEntityCreateRoute\(taskEntityConfig, NextSparkTemplate\)/)
    assert.equal(routes.find(route => route.target === 'dashboard/(main)/tasks/create/page.tsx').origin, 'core')
    assert.match(at(result, 'dashboard/(main)/tasks/create/page.tsx'), /import NextSparkTemplate from "@\/templates\/dashboard\/\(main\)\/tasks\/create\/page"/)
    assert.match(at(result, 'dashboard/(main)/tasks/[id]/edit/page.tsx'), /export default createEntityEditRoute\(taskEntityConfig\)$/m, 'no edit template: the plain factory')
    // A template for a file that takes none (the layout, error, loading) replaces the generated file, as any project route does
  } finally {
    w.cleanup()
  }
})

test('a template without a default export is a diagnostic naming it, not a broken route', async () => {
  const w = world({ 'templates/dashboard/(main)/tasks/page.tsx': 'export const x = 1\n' })
  try {
    const { routes } = await plan(w, [entity('tasks', 'taskEntityConfig')], { tasks: await factsOf("slug: 'tasks', enabled: true") })
    const result = await render(routes)
    assert.match(result.diagnostics[0].message, /templates\/dashboard\/\(main\)\/tasks\/page\.tsx: a template needs a default export/)
  } finally {
    w.cleanup()
  }
})

test('entities the dashboard does not serve get no dashboard routes: disabled, hidden, or served by a dedicated core route', async () => {
  const w = world()
  try {
    const entities = [entity('off', 'offEntityConfig'), entity('hidden', 'hiddenEntityConfig'), entity('patterns', 'patternsEntityConfig'), entity('maybe', 'maybeEntityConfig')]
    const { routes } = await plan(
      w,
      entities,
      {
        off: await factsOf("slug: 'off', enabled: false"),
        hidden: await factsOf("slug: 'hidden', enabled: true, ui: { dashboard: { showInMenu: false } }"),
        patterns: await factsOf("slug: 'patterns', enabled: true"),
        maybe: await factsOf("slug: 'maybe', enabled: ENABLED"),
      },
      { coreRoutes: [{ kind: 'page', target: 'dashboard/(main)/patterns/page.tsx', specifier: '@nextsparkjs/core/routes/p', file: '/core/p.tsx', protected: false }] }
    )
    assert.deepEqual([...new Set(targets(routes).filter(target => target.startsWith('dashboard/(main)/')).map(target => target.split('/')[2]))], ['maybe', 'patterns'], 'an unreadable flag keeps the route: the runtime check answers notFound()')
    assert.deepEqual(targets(routes).filter(target => target.includes('/patterns/')), ['dashboard/(main)/patterns/page.tsx'], 'core\'s own routes serve patterns; no entity route is added')
  } finally {
    w.cleanup()
  }
})

test('an entity whose slug differs from its directory name, or whose config cannot be read, is a diagnostic', async () => {
  const w = world()
  try {
    const { routes, diagnostics } = await plan(
      w,
      [entity('tasks', 'taskEntityConfig'), entity('broken', 'brokenEntityConfig'), entity('missing', 'missingEntityConfig')],
      { tasks: await factsOf("slug: 'todo', enabled: true"), broken: { error: 'does not parse (nope)' } }
    )
    assert.deepEqual(routes, [])
    assert.deepEqual(diagnostics.map(d => d.code), [ENTITY_DIAGNOSTICS.SLUG_MISMATCH, ENTITY_DIAGNOSTICS.CONFIG_UNREADABLE, ENTITY_DIAGNOSTICS.CONFIG_UNREADABLE])
    assert.match(diagnostics[0].message, /entities\/tasks: slug "todo" differs from the entity's directory name "tasks"/)
    assert.match(diagnostics[1].message, /entities\/broken: the entity config does not parse \(nope\)/)
  } finally {
    w.cleanup()
  }
})

test('a core module that does not export what a route imports from it is a diagnostic, not a build failure later', async () => {
  const w = world()
  try {
    w.write('core/entity-list-route.tsx', 'export function somethingElse() {}\n')
    w.write('core/entity-edit-route.tsx', 'export const createEntityEditRoute = () => null\n')
    const { routes } = await plan(w, [entity('tasks', 'taskEntityConfig')], { tasks: await factsOf("slug: 'tasks', enabled: true") })
    const result = await render(routes)
    const missing = result.diagnostics.filter(d => d.code === 'NS_HOST_CORE_EXPORT_MISSING').map(d => /does not export "(\w+)"/.exec(d.message)[1])
    assert.deepEqual([...new Set(missing)].sort(), ['createEntityListRoute'], 'a name a module exports is found, whatever the form')
  } finally {
    w.cleanup()
  }
})

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

const BLOG = "slug: 'posts', enabled: true, access: { public: true, basePath: '/blog' }, ui: { public: { hasArchivePage: true } }, builder: { enabled: true }"

test('a builder entity with a basePath gets an item route under it (nested slugs included) and an archive route', async () => {
  const w = world({ 'templates/(public)/blog/[slug]/page.tsx': PAGE })
  try {
    const { routes, diagnostics } = await plan(w, [entity('posts', 'postsEntityConfig')], { posts: await factsOf(BLOG) })
    assert.deepEqual(diagnostics, [])
    assert.deepEqual(targets(routes).filter(target => target.startsWith('(public)')), ['(public)/blog/[...slug]/page.tsx', '(public)/blog/page.tsx'])
    const result = await render(routes)
    assert.deepEqual(result.diagnostics, [])
    assert.equal(
      at(result, '(public)/blog/[...slug]/page.tsx'),
      [
        '// Generated by NextSpark for entities/posts (postsEntityConfig). Do not edit: regenerated on every build.',
        'import NextSparkTemplate from "@/templates/(public)/blog/[slug]/page"',
        'import { postsEntityConfig } from "@/entities/posts/posts.config"',
        `import { createPublicItemMetadata, createPublicItemRoute } from "${ENTITY_MODULES.publicItem}"`,
        'export default createPublicItemRoute(postsEntityConfig, NextSparkTemplate)',
        'export const generateMetadata = createPublicItemMetadata(postsEntityConfig)',
        'export const revalidate = 3600',
        '',
      ].join('\n')
    )
    assert.match(at(result, '(public)/blog/page.tsx'), new RegExp(`import \\{ createPublicArchiveMetadata, createPublicArchiveRoute \\} from "${ENTITY_MODULES.publicArchive}"`))
    assert.match(at(result, '(public)/blog/page.tsx'), /export default createPublicArchiveRoute\(postsEntityConfig\)/)
    assert.doesNotMatch(at(result, '(public)/blog/page.tsx'), /revalidate/)
    // The template was absorbed: no route of its own
    assert.ok(!targets(routes).includes('(public)/blog/[slug]/page.tsx'))
    for (const file of result.files) assert.deepEqual(validateGeneratedModule({ ts, source: file.content, file: file.path, grammar: file.grammar }), [], file.path)
  } finally {
    w.cleanup()
  }
})

test('the root basePath gives [slug] (a single segment), or [...slug] when the entity allows nested slugs', async () => {
  const w = world()
  try {
    const root = "slug: 'pages', enabled: true, access: { basePath: '/' }, builder: { enabled: true }"
    const single = await plan(w, [entity('pages', 'pagesEntityConfig')], { pages: await factsOf(root) })
    assert.deepEqual(targets(single.routes).filter(target => target.startsWith('(public)')), ['(public)/[slug]/page.tsx'])
    const nested = await plan(w, [entity('pages', 'pagesEntityConfig')], { pages: await factsOf(root.replace("basePath: '/'", "basePath: '/', allowNestedSlugs: true")) })
    assert.deepEqual(targets(nested.routes).filter(target => target.startsWith('(public)')), ['(public)/[...slug]/page.tsx'])
  } finally {
    w.cleanup()
  }
})

test('Cache Components hosts get no revalidate on public item pages (Next.js rejects it there)', async () => {
  const w = world()
  try {
    const args = [w, [entity('posts', 'postsEntityConfig')], { posts: await factsOf(BLOG) }]
    const revalidates = async options => (at(await render((await plan(...args, options)).routes), '(public)/blog/[...slug]/page.tsx').includes('export const revalidate = 3600'))
    assert.equal(await revalidates({ cacheComponents: false }), true)
    assert.equal(await revalidates({}), true)
    assert.equal(await revalidates({ cacheComponents: true }), false)
    assert.equal(await revalidates({ modes: ['isr', 'cc'] }), false, 'a host that builds both ways writes what is valid in both')
  } finally {
    w.cleanup()
  }
})

test('a public entity with an archive page and no builder basePath gets an archive at its own path, at any depth (as the catch-all served it)', async () => {
  const w = world()
  try {
    const { routes } = await plan(
      w,
      [entity('customers', 'customersEntityConfig'), entity('private', 'privateEntityConfig'), entity('noarchive', 'noarchiveEntityConfig')],
      {
        customers: await factsOf("slug: 'customers', enabled: true, access: { public: true }, ui: { public: { hasArchivePage: true } }"),
        private: await factsOf("slug: 'private', enabled: true, access: { public: false }, ui: { public: { hasArchivePage: true } }"),
        noarchive: await factsOf("slug: 'noarchive', enabled: true, access: { public: true }"),
      }
    )
    assert.deepEqual(targets(routes).filter(target => target.startsWith('(public)')), ['(public)/customers/[[...rest]]/page.tsx'])
  } finally {
    w.cleanup()
  }
})

test('a basePath the host cannot turn into a route is a diagnostic naming the entity and the fix', async () => {
  const w = world()
  try {
    const { routes, diagnostics } = await plan(
      w,
      [entity('a', 'aEntityConfig'), entity('b', 'bEntityConfig'), entity('c', 'cEntityConfig')],
      {
        a: await factsOf("slug: 'a', access: { basePath: BASE }, builder: { enabled: true }"),
        b: await factsOf("slug: 'b', access: { basePath: '/blog/[x]' }, builder: { enabled: true }"),
        c: await factsOf("slug: 'c', access: { basePath: '/c' }, builder: { enabled: ON }"),
      }
    )
    assert.deepEqual(targets(routes).filter(target => target.startsWith('(public)')), [])
    assert.deepEqual(diagnostics.map(d => d.code), [ENTITY_DIAGNOSTICS.NOT_STATIC, ENTITY_DIAGNOSTICS.BASE_PATH, ENTITY_DIAGNOSTICS.NOT_STATIC])
    assert.match(diagnostics[0].message, /entities\/a \(aEntityConfig\): `access\.basePath` is not a literal, and it decides which public routes the host writes/)
    assert.match(diagnostics[1].message, /access\.basePath "\/blog\/\[x\]" must be "\/" or a static path/)
  } finally {
    w.cleanup()
  }
})

test('two entities that would serve one public route are a collision naming both', async () => {
  const w = world()
  try {
    const root = "enabled: true, access: { basePath: '/' }, builder: { enabled: true }"
    const { diagnostics } = await plan(w, [entity('pages', 'pagesEntityConfig'), entity('docs', 'docsEntityConfig')], { pages: await factsOf(`slug: 'pages', ${root}`), docs: await factsOf(`slug: 'docs', ${root}`) })
    assert.deepEqual(diagnostics.map(d => d.code), [PLAN_DIAGNOSTICS.COLLISION])
    assert.match(diagnostics[0].message, /\(public\)\/\[slug\]\/page\.tsx: two core files provide this route: entities\/docs \(docsEntityConfig\) public route and entities\/pages \(pagesEntityConfig\) public route/)
  } finally {
    w.cleanup()
  }
})

test('a plugin\'s entity is served with its plugin\'s import specifier', async () => {
  const w = world()
  try {
    const { routes } = await plan(w, [entity('notes', 'notesEntityConfig', { source: 'plugin', configPath: '@nextsparkjs/plugin-notes/entities/notes/notes.config', pluginContext: { pluginName: 'notes' }, relativePath: 'notes' })], { notes: await factsOf("slug: 'notes', enabled: true") })
    const result = await render(routes)
    assert.match(at(result, 'dashboard/(main)/notes/page.tsx'), /import \{ notesEntityConfig \} from "@nextsparkjs\/plugin-notes\/entities\/notes\/notes\.config"/)
    assert.match(at(result, 'dashboard/(main)/notes/page.tsx'), /Generated by NextSpark for plugins\/notes\/entities\/notes \(notesEntityConfig\)/)
  } finally {
    w.cleanup()
  }
})

test('every entity\'s facts are read from its config file (real reader, real files)', async () => {
  const w = world({ 'entities/tasks/tasks.config.ts': TASKS, 'entities/broken/broken.config.ts': 'export const brokenEntityConfig = {\n' })
  try {
    const map = await readAllEntityFacts({ entities: [entity('tasks', 'taskEntityConfig'), entity('broken', 'brokenEntityConfig'), entity('gone', 'goneEntityConfig')], projectRoot: w.source })
    assert.equal(value(map.get('tasks').facts.slug), 'tasks')
    assert.match(map.get('broken').error, /does not parse/)
    assert.match(map.get('gone').error, /cannot be read/)
  } finally {
    w.cleanup()
  }
})

// ---------------------------------------------------------------------------
// Namespaces and URL conflicts (plan.mjs)
// ---------------------------------------------------------------------------

const ROUTE = 'export async function GET() { return Response.json({}) }\n'

test('API namespaces, every combination: who may serve what under /api', () => {
  const w = world({
    // the project
    'api/ai/usage/route.ts': ROUTE, // ok: /api/ai/usage
    'api/v1/mine/route.ts': ROUTE, // core's namespace
    'api/plugins/p/x/route.ts': ROUTE, // the plugins' namespace
    'templates/api/v1/users/route.ts': ROUTE, // ok: overrides an existing core route
    'templates/api/v1/brand-new/route.ts': ROUTE, // core has no such route: cannot add one
    'templates/api/plugins/p/things/route.ts': ROUTE, // ok: replaces a route plugin p already serves
    'templates/api/plugins/p/brand-new/route.ts': ROUTE, // plugin p serves no such route: cannot add one
    'templates/api/plugins/q/other/route.ts': ROUTE, // plugin q serves no such route either
    'templates/api/reports/route.ts': ROUTE, // ok: /api/reports
    // plugin p
    'plugins/p/api/things/route.ts': ROUTE, // ok: /api/plugins/p/things
    'plugins/p/templates/api/plugins/p/extra/route.ts': ROUTE, // ok: its own namespace
    'plugins/p/templates/api/plugins/q/steal/route.ts': ROUTE, // another plugin's namespace
    'plugins/p/templates/api/v1/users/route.ts': ROUTE, // core's namespace, even to replace an existing route
    'plugins/p/templates/api/loose/route.ts': ROUTE, // outside any plugin namespace
    'plugins/p/templates/about/page.tsx': PAGE, // not an API route: fine
    // plugin q
    'plugins/q/api/own/route.ts': ROUTE, // ok: /api/plugins/q/own
    'plugins/q/templates/api/plugins/p/things/route.ts': ROUTE, // p's namespace
  })
  try {
    const core = { kind: 'route', target: 'api/v1/users/route.ts', specifier: '@nextsparkjs/core/routes/api/v1/users/route', file: '/core/u', protected: false }
    const { routes, diagnostics } = planHost({
      coreRoutes: [core],
      plugins: [
        { name: 'p', root: join(w.source, 'plugins/p'), importBase: '@/plugins/p' },
        { name: 'q', root: join(w.source, 'plugins/q'), importBase: '@/plugins/q' },
      ],
      project: { root: w.source },
    })
    assert.ok(diagnostics.every(d => d.code === PLAN_DIAGNOSTICS.API_NAMESPACE))
    assert.deepEqual(diagnostics.map(d => d.sources[0]).sort(), [
      './api/plugins/p/x/route.ts',
      './api/v1/mine/route.ts',
      './templates/api/plugins/p/brand-new/route.ts',
      './templates/api/plugins/q/other/route.ts',
      './templates/api/v1/brand-new/route.ts',
      'plugins/p/templates/api/loose/route.ts',
      'plugins/p/templates/api/plugins/q/steal/route.ts',
      'plugins/p/templates/api/v1/users/route.ts',
      'plugins/q/templates/api/plugins/p/things/route.ts',
    ])
    assert.deepEqual(routes.map(route => `${route.target} <- ${route.origin}`), [
      'about/page.tsx <- plugin',
      'api/ai/usage/route.ts <- project',
      'api/plugins/p/extra/route.ts <- plugin',
      'api/plugins/p/things/route.ts <- project',
      'api/plugins/q/own/route.ts <- plugin',
      'api/reports/route.ts <- project',
      'api/v1/users/route.ts <- project',
    ])
    assert.match(routes.find(route => route.target === 'api/plugins/p/things/route.ts').overrides, /^plugins\/p\/api\/things\/route\.ts$/, 'the project\'s facade replaces the plugin\'s route')
    assert.equal(routes.find(route => route.target === 'api/v1/users/route.ts').overrides, 'core route @nextsparkjs/core/routes/api/v1/users/route')
    const message = source => diagnostics.find(d => d.sources[0] === source || d.sources[0] === `./${source}`).message
    assert.match(message('templates/api/v1/brand-new/route.ts'), /replaces no core route: templates\/api\/v1\/\.\.\. may only override a route core has at that path/)
    assert.match(message('templates/api/plugins/p/brand-new/route.ts'), /a project cannot create routes there \(templates\/api\/plugins\/<plugin>\/\.\.\. may only replace a route that plugin already serves\)/)
    assert.match(message('plugins/p/templates/api/plugins/q/steal/route.ts'), /outside \/api\/plugins\/p\/\*\*, the only namespace plugin "p" may serve/)
    assert.match(message('api/v1/mine/route.ts'), /core owns \/api\/v1\/\*\*/)
  } finally {
    w.cleanup()
  }
})

test('Next.js\' own routing limits are diagnostics with the routes named: one URL twice, dynamic segments it cannot tell apart', () => {
  const route = (target, kind = 'page') => ({ kind, target, specifier: `@core/${target}`, source: `core route ${target}` })
  assert.deepEqual(urlConflicts([route('(a)/x/page.tsx'), route('(b)/x/page.tsx')]).map(d => d.code), [PLAN_DIAGNOSTICS.URL_CONFLICT])
  assert.deepEqual(urlConflicts([route('(a)/x/page.tsx'), route('x/layout.tsx', 'layout'), route('y/page.tsx')]), [], 'a layout is not a route; two different URLs are fine')
  assert.deepEqual(urlConflicts([{ ...route('x/page.cc.tsx'), mode: 'cc' }, route('x/page.tsx')]), [], 'a cache-mode file is an alternative')

  const names = urlConflicts([route('(public)/[slug]/page.tsx'), route('(auth)/[entity]/page.tsx')])
  assert.deepEqual(names.map(d => d.code), [PLAN_DIAGNOSTICS.DYNAMIC_SEGMENT_CONFLICT])
  assert.match(names[0].message, /Next\.js cannot tell the dynamic segments \[slug\] and \[entity\] apart at one level/)
  assert.equal(urlConflicts([route('[slug]/page.tsx'), route('[...slug]/page.tsx'), route('docs/[section]/page.tsx'), route('docs/[...rest]/page.tsx')]).length, 0, 'a dynamic and a catch-all segment are told apart')
  assert.equal(urlConflicts([route('a/[...x]/page.tsx'), route('a/[[...x]]/page.tsx')]).length, 1, 'required and optional catch-all cannot share a level')
  assert.equal(urlConflicts([route('a/[...x]/page.tsx'), route('a/[...y]/page.tsx')]).length, 1)
  assert.equal(urlConflicts([route('a/[x]/b/page.tsx'), route('a/[y]/c/page.tsx')]).length, 1, 'the conflict is at the shared parent, whatever is below it')
})

test('a public entity route that Next.js could not tell from a core route is a diagnostic at plan time', async () => {
  const w = world()
  try {
    const { diagnostics } = await plan(
      w,
      [entity('pages', 'pagesEntityConfig')],
      { pages: await factsOf("slug: 'pages', enabled: true, access: { basePath: '/' }, builder: { enabled: true }") },
      { coreRoutes: [{ kind: 'page', target: '(auth)/[token]/page.tsx', specifier: '@nextsparkjs/core/routes/t', file: '/core/t.tsx', protected: false }] }
    )
    assert.deepEqual(diagnostics.map(d => d.code), [PLAN_DIAGNOSTICS.DYNAMIC_SEGMENT_CONFLICT])
  } finally {
    w.cleanup()
  }
})

test('a host that builds in Cache Components mode only imports the cached item source; one that builds both, or does not know, keeps the module valid in either', async () => {
  const w = world()
  try {
    const args = [w, [entity('posts', 'postsEntityConfig')], { posts: await factsOf(BLOG) }]
    const moduleOf = async options => at(await render((await plan(...args, options)).routes), '(public)/blog/[...slug]/page.tsx').match(/import \{ createPublicItemMetadata, createPublicItemRoute \} from "([^"]+)"/)[1]
    assert.equal(ENTITY_MODULES.publicItemCc, `${ENTITY_MODULES.publicItem}.cc`)
    assert.equal(await moduleOf({ cacheComponents: true }), ENTITY_MODULES.publicItemCc)
    assert.equal(await moduleOf({ cacheComponents: false }), ENTITY_MODULES.publicItem)
    assert.equal(await moduleOf({}), ENTITY_MODULES.publicItem)
    assert.equal(await moduleOf({ cacheComponents: true, modes: ['isr', 'cc'] }), ENTITY_MODULES.publicItem)
  } finally {
    w.cleanup()
  }
})

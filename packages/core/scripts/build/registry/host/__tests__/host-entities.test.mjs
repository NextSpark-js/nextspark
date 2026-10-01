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
import { PLAN_DIAGNOSTICS, PLAN_NOTICES, planHost, urlConflicts } from '../plan.mjs'
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
    '@nextsparkjs/core/routes/_internal/entity-list-metadata': 'core/entity-page.tsx',
    '@nextsparkjs/core/routes/_internal/entity-detail-metadata': 'core/entity-detail-page.tsx',
    '@nextsparkjs/core/routes/_internal/entity-error': 'core/entity-error.tsx',
    '@nextsparkjs/core/routes/_internal/entity-loading': 'core/entity-loading.tsx',
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
  return { routes: planned.routes, diagnostics: [...entityDiagnostics, ...planned.diagnostics], notices: planned.notices }
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
        'export { metadata } from "@nextsparkjs/core/routes/_internal/entity-list-metadata"',
        '',
      ].join('\n')
    )
    assert.match(at(result, 'dashboard/(main)/tasks/[id]/page.tsx'), /export default createEntityDetailRoute\(taskEntityConfig, \[\]\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/layout.tsx'), /export default createEntityLayoutRoute\(taskEntityConfig\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/create/page.tsx'), /export default createEntityCreateRoute\(taskEntityConfig\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/[id]/edit/page.tsx'), /export default createEntityEditRoute\(taskEntityConfig\)/)
    assert.match(at(result, 'dashboard/(main)/tasks/error.tsx'), /^\/\/ Generated by .*\n'use client'\n\nexport \{ default \} from "@nextsparkjs\/core\/routes\/_internal\/entity-error"\n$/)
    // Each route imports the factory of its own kind only (a shared module would give every route the client code of all)
    const modulesOf = path => [...at(result, path).matchAll(/from "(@nextsparkjs\/core\/routes\/_internal\/[^"]+)"/g)].map(match => match[1])
    assert.deepEqual(modulesOf('dashboard/(main)/tasks/page.tsx'), [ENTITY_MODULES.list, ENTITY_MODULES.listMetadata])
    assert.deepEqual(modulesOf('dashboard/(main)/tasks/[id]/page.tsx'), [ENTITY_MODULES.detail, ENTITY_MODULES.detailMetadata])
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
        'export { metadata } from "@nextsparkjs/core/routes/_internal/entity-list-metadata"',
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

test('a project overrides one entity\'s API: templates/api/v1/<entity>/<rest> when <rest> mirrors a core [entity] route', () => {
  const shapes = ['route.ts', '[id]/route.ts', '[id]/child/[childType]/route.ts', '[id]/child/[childType]/[childId]/route.ts']
  const core = [
    ...shapes.map(shape => ({ kind: 'route', target: `api/v1/[entity]/${shape}`, specifier: `@nextsparkjs/core/routes/api/v1/[entity]/${shape}`, file: '/core/e', protected: false })),
    { kind: 'route', target: 'api/v1/users/route.ts', specifier: '@nextsparkjs/core/routes/api/v1/users/route', file: '/core/u', protected: false },
    { kind: 'route', target: 'api/v1/users/[id]/route.ts', specifier: '@nextsparkjs/core/routes/api/v1/users/[id]/route', file: '/core/uid', protected: false },
  ]
  const w = world({
    'templates/api/v1/tasks/route.ts': ROUTE,
    'templates/api/v1/tasks/[id]/route.ts': ROUTE,
    'templates/api/v1/tasks/[id]/child/[childType]/route.ts': ROUTE,
    'templates/api/v1/tasks/[id]/child/[childType]/[childId]/route.ts': ROUTE,
    'templates/api/v1/projects/[id]/route.ts': ROUTE,
    'templates/api/v1/tasks/[id]/export/route.ts': ROUTE, // not a core [entity] shape
    'templates/api/v1/tasks/[taskId]/route.ts': ROUTE, // the dynamic segment has another name: not core's shape
    'templates/api/v1/ghosts/[id]/route.ts': ROUTE, // not an entity of the project
    'templates/api/v1/users/[id]/route.ts': ROUTE, // core serves this route: replaces it (a notice), whatever the entity names say
    'api/v1/tasks/[id]/route.ts': ROUTE, // api/ is never core's namespace
  })
  try {
    const { routes, diagnostics, notices } = planHost({ coreRoutes: core, entityNames: ['tasks', 'projects'], project: { root: w.source } })
    assert.deepEqual(diagnostics.filter(d => d.code === PLAN_DIAGNOSTICS.API_NAMESPACE).map(d => d.sources[0]).sort(), [
      './api/v1/tasks/[id]/route.ts',
      './templates/api/v1/ghosts/[id]/route.ts',
      './templates/api/v1/tasks/[id]/export/route.ts',
      './templates/api/v1/tasks/[taskId]/route.ts',
    ])
    assert.deepEqual(routes.filter(route => route.origin === 'project').map(route => route.target), [
      'api/v1/projects/[id]/route.ts',
      'api/v1/tasks/[id]/child/[childType]/[childId]/route.ts',
      'api/v1/tasks/[id]/child/[childType]/route.ts',
      'api/v1/tasks/[id]/route.ts',
      'api/v1/tasks/route.ts',
      'api/v1/users/[id]/route.ts',
    ])
    assert.deepEqual(notices.map(n => [n.code, n.entity ?? n.url]), [
      [PLAN_NOTICES.CORE_API_REPLACED, '/api/v1/users/[id]'],
      [PLAN_NOTICES.ENTITY_API_OVERRIDDEN, 'projects'],
      [PLAN_NOTICES.ENTITY_API_OVERRIDDEN, 'tasks'],
    ])
    assert.match(notices[0].message, /replaces core route @nextsparkjs\/core\/routes\/api\/v1\/users\/\[id\]\/route; authentication, permissions, rate limits and hooks of the core handler no longer run/)
    assert.equal(notices[2].urls.length, 4)
    assert.match(notices[2].message, /replace the generic entity handler at .*\/api\/v1\/tasks\/\[id\].*authentication, permissions, rate limits and the entity's hooks are the project's responsibility/)
    // Without the entity registered the same files are refused
    const refused = planHost({ coreRoutes: core, entityNames: [], project: { root: w.source } })
    assert.ok(refused.diagnostics.some(d => d.sources[0] === './templates/api/v1/tasks/[id]/route.ts'))
    assert.deepEqual(refused.notices.map(n => n.code), [PLAN_NOTICES.CORE_API_REPLACED], 'only the core route replacement; no entity override')
  } finally {
    w.cleanup()
  }
})

test('core API namespaces are never taken by an entity: every core name, every shape, against the real core manifest', async () => {
  const { loadCoreRouteManifest } = await import('../core-routes.mjs')
  const manifest = await loadCoreRouteManifest({ coreRoot: CORE_ROOT })
  const names = ['users', 'teams', 'auth', 'billing', 'cron', 'api-keys', 'devtools', 'media', 'media-tags', 'blocks', 'patterns', 'post-categories', 'team-invitations']
  const shapes = ['route.ts', '[id]/route.ts', '[id]/child/[childType]/route.ts', '[id]/child/[childType]/[childId]/route.ts']
  const files = Object.fromEntries(names.flatMap(name => shapes.map(shape => [`templates/api/v1/${name}/${shape}`, ROUTE])))
  const w = world({ ...files, 'templates/api/v1/tasks/[id]/route.ts': ROUTE })
  try {
    const { routes, diagnostics, notices } = planHost({ coreRoutes: manifest.routes, entityNames: [...names, 'tasks'], project: { root: w.source } })
    const coreServes = target => manifest.routes.some(route => route.target === target)
    const projectTargets = routes.filter(route => route.origin === 'project').map(route => route.target)
    // what survives is a route core itself serves at that exact path (the old replace rule) or the one real entity's
    for (const target of projectTargets) assert.ok(coreServes(target) || target === 'api/v1/tasks/[id]/route.ts', `${target} created inside a core namespace`)
    for (const name of names) {
      for (const shape of shapes) {
        const target = `api/v1/${name}/${shape}`
        if (coreServes(target)) continue
        assert.ok(!projectTargets.includes(target), `${target} must not be generated`)
        const refused = diagnostics.find(d => d.sources?.[0] === `./templates/${target}` && d.code === PLAN_DIAGNOSTICS.API_NAMESPACE)
        assert.ok(refused, `${target} must be refused`)
        assert.match(refused.message, new RegExp(`core serves its own API under /api/v1/${name}/\\*\\*`))
      }
    }
    assert.ok(!notices.some(n => n.code === PLAN_NOTICES.ENTITY_API_OVERRIDDEN && n.entity !== 'tasks'), 'no entity override for a core name')
    assert.deepEqual(notices.filter(n => n.code === PLAN_NOTICES.ENTITY_API_OVERRIDDEN).map(n => n.entity), ['tasks'])
    // a route core serves, replaced by the old rule, is never silent
    const replaced = notices.filter(n => n.code === PLAN_NOTICES.CORE_API_REPLACED).map(n => n.url)
    for (const target of projectTargets.filter(target => target !== 'api/v1/tasks/[id]/route.ts')) assert.ok(replaced.includes(`/${target.replace(/\/route\.ts$/, '')}`), `${target} replaces core silently`)
    assert.ok(replaced.includes('/api/v1/users'), 'users/route.ts replaces core\'s users API')
  } finally {
    w.cleanup()
  }
})

test('an entity named after a core API namespace is a diagnostic before any route is planned', () => {
  const coreRoutes = [{ kind: 'route', target: 'api/v1/billing/checkout/route.ts', specifier: '@c/b', file: '/c/b' }, { kind: 'route', target: 'api/v1/[entity]/route.ts', specifier: '@c/e', file: '/c/e' }]
  const facts = new Map()
  const result = planEntityRoutes({ entities: [entity('billing', 'billingEntityConfig'), entity('tasks', 'taskEntityConfig')], facts, coreRoutes, resolveFile: () => null })
  assert.ok(result.diagnostics.some(d => d.code === ENTITY_DIAGNOSTICS.CORE_API_NAMESPACE && /entity "billing".*\/api\/v1\/billing\/\*\*.*Rename the entity/.test(d.message)))
})

test('a project config that overrides a core entity (patterns) keeps its routes; only a new entity with a core API name is refused', async () => {
  const coreRoutes = ['patterns', 'cron', 'auth', 'billing'].map(name => ({ kind: 'route', target: `api/v1/${name}/route.ts`, specifier: `@c/${name}`, file: `/c/${name}` }))
  const facts = new Map()
  for (const name of ['patterns']) facts.set(name, await factsOf(`  slug: '${name}',\n  enabled: true,\n  ui: { dashboard: { showInMenu: true } },`))
  const overrides = ['patterns'].map(name => entity(name, `${name}EntityConfig`, { source: 'theme', overridesCore: true }))
  const result = planEntityRoutes({ entities: [...overrides, entity('cron', 'cronEntityConfig'), entity('auth', 'authEntityConfig')], facts, coreRoutes, resolveFile: () => null })
  const refused = result.diagnostics.filter(d => d.code === ENTITY_DIAGNOSTICS.CORE_API_NAMESPACE)
  assert.deepEqual(refused.map(d => /entity "(\w+)"/.exec(d.message)[1]), ['cron', 'auth'])
  for (const name of ['patterns']) assert.ok(result.routes.some(r => r.target.startsWith(`dashboard/(main)/${name}/`)), `${name} keeps its routes`)
  assert.ok(!result.routes.some(r => /\/(cron|auth)\//.test(r.target)), 'a refused entity gets none')
})

test('Next.js\' own routing limits are diagnostics with the routes named: one URL twice, dynamic segments it cannot tell apart', () => {
  const route = (target, kind = 'page') => ({ kind, target, specifier: `@core/${target}`, source: `core route ${target}` })
  assert.deepEqual(urlConflicts([route('(a)/x/page.tsx'), route('(b)/x/page.tsx')]).map(d => d.code), [PLAN_DIAGNOSTICS.URL_CONFLICT])
  assert.deepEqual(urlConflicts([route('(a)/x/page.tsx'), route('x/layout.tsx', 'layout'), route('y/page.tsx')]), [], 'a layout is not a route; two different URLs are fine')
  assert.deepEqual(urlConflicts([route('(a)/x/page.tsx'), route('(b)/x/@modal/page.tsx'), route('(a)/x/@panel/page.tsx')]), [], 'a slot page at the main page\'s URL is not two routes for Next (it is dropped or used by the slot, never an error)')
  assert.equal(urlConflicts([route('(a)/x/@modal/page.tsx'), route('(b)/x/@modal/page.tsx')]).length, 1, 'two pages of one slot at one URL in different groups: Next silently drops one, flagged here')
  assert.equal(urlConflicts([route('page.tsx'), route('@modal/[[...x]]/page.tsx')]).length, 1, 'next build 16.3.5: REFUSED ("same specificity as an optional catch-all"); an optional catch-all in a slot still takes its parent URL')
  assert.equal(urlConflicts([route('@modal/page.tsx'), route('@modal/[[...x]]/page.tsx')]).length, 1, 'next build 16.3.5: REFUSED (same specificity error), same slot')
  assert.equal(urlConflicts([route('@panel/page.tsx'), route('@modal/[[...x]]/page.tsx')]).length, 1, 'next build 16.3.5: REFUSED (same specificity error), different slots')
  assert.equal(urlConflicts([route('[[...x]]/page.tsx'), route('@modal/page.tsx')]).length, 1, 'next build 16.3.5: REFUSED (same specificity error), catch-all outside a slot, page inside one')
  assert.deepEqual(urlConflicts([route('[[...x]]/page.tsx'), route('@modal/[[...x]]/page.tsx')]), [], 'next build 16.3.5: ACCEPTED (layout renders {modal}): same optional catch-all in the main tree and in a slot')
  assert.deepEqual(urlConflicts([route('@a/[[...x]]/page.tsx'), route('@b/[[...x]]/page.tsx')]), [], 'next build 16.3.5: ACCEPTED: the same optional catch-all in two slots')
  assert.equal(urlConflicts([route('(g1)/[[...x]]/page.tsx'), route('(g2)/[[...x]]/page.tsx')]).length, 1, 'next build 16.3.5: REFUSED ("two parallel pages that resolve to the same path"): same optional catch-all in two route groups')
  assert.deepEqual(urlConflicts([{ ...route('x/page.cc.tsx'), mode: 'cc' }, route('x/page.tsx')]), [], 'a cache-mode file is an alternative')

  const names = urlConflicts([route('(public)/[slug]/page.tsx'), route('(auth)/[entity]/page.tsx')])
  assert.deepEqual(names.map(d => d.code), [PLAN_DIAGNOSTICS.DYNAMIC_SEGMENT_CONFLICT])
  assert.match(names[0].message, /Next\.js cannot tell the dynamic segments \[slug\] and \[entity\] apart at one level/)
  assert.equal(urlConflicts([route('[slug]/page.tsx'), route('[...slug]/page.tsx'), route('docs/[section]/page.tsx'), route('docs/[...rest]/page.tsx')]).length, 0, 'a dynamic and a catch-all segment are told apart')
  assert.equal(urlConflicts([route('a/[...x]/page.tsx'), route('a/[[...x]]/page.tsx')]).length, 1, 'required and optional catch-all cannot share a level')
  assert.equal(urlConflicts([route('a/[...x]/page.tsx'), route('a/[...y]/page.tsx')]).length, 1)
  assert.equal(urlConflicts([route('a/[x]/b/page.tsx'), route('a/[y]/c/page.tsx')]).length, 1, 'the conflict is at the shared parent, whatever is below it')
  // An optional catch-all also serves its parent's URL (Next.js: "same specificity as an optional catch-all route")
  const optional = urlConflicts([route('(a)/x/page.tsx'), route('(b)/x/[[...rest]]/page.tsx')])
  assert.deepEqual(optional.map(d => d.code), [PLAN_DIAGNOSTICS.URL_CONFLICT])
  assert.match(optional[0].message, /^\/x: /)
  assert.equal(urlConflicts([route('x/page.tsx'), route('x/[[...rest]]/page.tsx')]).length, 1, 'in one group too')
  assert.equal(urlConflicts([route('x/[[...rest]]/page.tsx'), route('y/page.tsx')]).length, 0, 'alone it is one route')
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

// ---------------------------------------------------------------------------
// "The template replaces": project templates at an entity's dashboard URL in another route group
// ---------------------------------------------------------------------------

const COHORTS = "slug: 'cohorts', enabled: true, ui: { dashboard: { showInMenu: true } }"
const cohortsEntity = () => entity('cohorts', 'cohortsEntityConfig')
const COHORT_TEMPLATES = {
  'templates/dashboard/(staff)/layout.tsx': 'export default function L({ children }) { return children }\n',
  'templates/dashboard/(staff)/cohorts/page.tsx': PAGE,
  'templates/dashboard/(staff)/cohorts/loading.tsx': 'export default function L() { return null }\n',
  'templates/dashboard/(staff)/cohorts/new/page.tsx': PAGE,
  'templates/dashboard/(staff)/cohorts/[cohortId]/layout.tsx': 'export default function L({ children }) { return children }\n',
  'templates/dashboard/(staff)/cohorts/[cohortId]/page.tsx': PAGE,
  'templates/dashboard/(staff)/cohorts/[cohortId]/edit/page.tsx': PAGE,
}
const GENERATED_COHORTS = [
  'dashboard/(main)/cohorts/[id]/edit/page.tsx',
  'dashboard/(main)/cohorts/[id]/page.tsx',
  'dashboard/(main)/cohorts/create/page.tsx',
  'dashboard/(main)/cohorts/error.tsx',
  'dashboard/(main)/cohorts/layout.tsx',
  'dashboard/(main)/cohorts/loading.tsx',
  'dashboard/(main)/cohorts/page.tsx',
]

test('project templates at an entity\'s dashboard URL in another route group replace its generated routes, with its permission layout kept over them', async () => {
  const w = world(COHORT_TEMPLATES)
  try {
    const { routes, diagnostics, notices } = await plan(w, [cohortsEntity(), entity('tasks', 'taskEntityConfig')], {
      cohorts: await factsOf(COHORTS),
      tasks: await factsOf("slug: 'tasks', enabled: true"),
    })
    // No NS_HOST_URL_CONFLICT for /dashboard/cohorts, no NS_HOST_DYNAMIC_SEGMENT_CONFLICT for [id] vs [cohortId]
    assert.deepEqual(diagnostics, [])
    const all = targets(routes)
    // The whole generated subtree is dropped (create included: /dashboard/cohorts/create is the project's [cohortId], as in 0.x)
    assert.deepEqual(all.filter(target => target.startsWith('dashboard/(main)/cohorts/')), [])
    assert.deepEqual(all.filter(target => target.startsWith('dashboard/(staff)/')), [
      'dashboard/(staff)/cohorts/[cohortId]/edit/page.tsx',
      'dashboard/(staff)/cohorts/[cohortId]/layout.tsx',
      'dashboard/(staff)/cohorts/[cohortId]/page.tsx',
      'dashboard/(staff)/cohorts/layout.tsx',
      'dashboard/(staff)/cohorts/loading.tsx',
      'dashboard/(staff)/cohorts/new/page.tsx',
      'dashboard/(staff)/cohorts/page.tsx',
      'dashboard/(staff)/layout.tsx',
    ])
    // Another entity is untouched
    assert.equal(all.filter(target => target.startsWith('dashboard/(main)/tasks/')).length, 7)

    // The guard: the entity's permission layout, protected, at the top of the project's tree for that URL
    const guard = routes.find(route => route.target === 'dashboard/(staff)/cohorts/layout.tsx')
    assert.equal(guard.origin, 'core')
    assert.equal(guard.protected, true)
    assert.equal(guard.entityRoute.default.factory.name, 'createEntityLayoutRoute')
    // The project's pages are plain project routes (no generated factory, no forwarded metadata)
    const page = routes.find(route => route.target === 'dashboard/(staff)/cohorts/[cohortId]/page.tsx')
    assert.equal(page.origin, 'project')
    assert.equal(page.entityRoute, undefined)

    assert.deepEqual(notices, [{
      code: PLAN_NOTICES.ENTITY_ROUTES_REPLACED,
      entity: 'cohorts',
      url: '/dashboard/cohorts',
      by: [
        'templates/dashboard/(staff)/cohorts/[cohortId]/edit/page.tsx',
        'templates/dashboard/(staff)/cohorts/[cohortId]/page.tsx',
        'templates/dashboard/(staff)/cohorts/page.tsx',
      ],
      dropped: GENERATED_COHORTS,
      guards: ['dashboard/(staff)/cohorts/layout.tsx'],
      message: notices[0].message,
    }])
    assert.match(notices[0].message, /^\/dashboard\/cohorts: the project's templates \(.*\) collide with the entity's generated dashboard routes and replace all of them \(7 files under src\/app\/dashboard\/\(main\)\/cohorts\/\); its permission layout is kept at src\/app\/dashboard\/\(staff\)\/cohorts\/layout\.tsx$/)

    // Rendered: the guard is the same composed facade as the generated layout, and every file passes the grammar gate
    const result = await render(routes)
    assert.deepEqual(result.diagnostics, [])
    assert.equal(
      at(result, 'dashboard/(staff)/cohorts/layout.tsx'),
      [
        '// Generated by NextSpark for entities/cohorts (cohortsEntityConfig). Do not edit: regenerated on every build.',
        'import { cohortsEntityConfig } from "@/entities/cohorts/cohorts.config"',
        `import { createEntityLayoutRoute } from "${ENTITY_MODULES.layout}"`,
        'export default createEntityLayoutRoute(cohortsEntityConfig)',
        '',
      ].join('\n')
    )
    for (const file of result.files) assert.deepEqual(validateGeneratedModule({ ts, source: file.content, file: file.path, grammar: file.grammar }), [], file.path)
  } finally {
    w.cleanup()
  }
})

test('the replacement guards every project tree serving the URL, and only a page or a Route Handler claims it', async () => {
  // Two groups serve under /dashboard/cohorts: each gets the guard. A template in the generated directory is one of
  // them once another group claims the URL (it is then a plain project page, still behind the guard).
  const w = world({
    'templates/dashboard/(staff)/cohorts/[cohortId]/page.tsx': PAGE,
    'templates/dashboard/(main)/cohorts/page.tsx': PAGE,
  })
  try {
    const { routes, diagnostics, notices } = await plan(w, [cohortsEntity()], { cohorts: await factsOf(COHORTS) })
    assert.deepEqual(diagnostics, [])
    assert.deepEqual(targets(routes), [
      'dashboard/(main)/cohorts/layout.tsx',
      'dashboard/(main)/cohorts/page.tsx',
      'dashboard/(staff)/cohorts/[cohortId]/page.tsx',
      'dashboard/(staff)/cohorts/layout.tsx',
    ])
    assert.equal(routes.find(route => route.target === 'dashboard/(main)/cohorts/page.tsx').origin, 'project')
    assert.deepEqual(notices[0].guards, ['dashboard/(main)/cohorts/layout.tsx', 'dashboard/(staff)/cohorts/layout.tsx'])
  } finally {
    w.cleanup()
  }
  // A layout or a loading state alone serves no URL: nothing is replaced
  const layoutOnly = world({ 'templates/dashboard/(staff)/cohorts/loading.tsx': 'export default function L() { return null }\n' })
  try {
    const { routes, notices } = await plan(layoutOnly, [cohortsEntity()], { cohorts: await factsOf(COHORTS) })
    assert.deepEqual(notices, [])
    assert.equal(targets(routes).filter(target => target.startsWith('dashboard/(main)/cohorts/')).length, 7)
  } finally {
    layoutOnly.cleanup()
  }
})

test('templates inside the generated directory keep being composed (no replacement), and a project layout over the moved guard is refused', async () => {
  const inside = world({ 'templates/dashboard/(main)/cohorts/page.tsx': PAGE, 'templates/dashboard/(main)/cohorts/[id]/members/page.tsx': PAGE })
  try {
    const { routes, diagnostics, notices } = await plan(inside, [cohortsEntity()], { cohorts: await factsOf(COHORTS) })
    assert.deepEqual(diagnostics, [])
    assert.deepEqual(notices, [])
    const list = routes.find(route => route.target === 'dashboard/(main)/cohorts/page.tsx')
    assert.equal(list.origin, 'core')
    assert.equal(list.template.source, 'templates/dashboard/(main)/cohorts/page.tsx')
    assert.ok(targets(routes).includes('dashboard/(main)/cohorts/[id]/members/page.tsx'), 'an added page under the entity layout')
  } finally {
    inside.cleanup()
  }
  // The permission layout cannot be replaced where it moved either
  const over = world({ 'templates/dashboard/(staff)/cohorts/page.tsx': PAGE, 'templates/dashboard/(staff)/cohorts/layout.tsx': 'export default function L({ children }) { return children }\n' })
  try {
    const { diagnostics } = await plan(over, [cohortsEntity()], { cohorts: await factsOf(COHORTS) })
    assert.deepEqual(diagnostics.map(d => d.code), [PLAN_DIAGNOSTICS.PROTECTED])
    assert.match(diagnostics[0].message, /src\/app\/dashboard\/\(staff\)\/cohorts\/layout\.tsx: templates\/dashboard\/\(staff\)\/cohorts\/layout\.tsx would replace the protected entities\/cohorts/)
  } finally {
    over.cleanup()
  }
})

test('a template that only adds a URL under the entity coexists with the generated routes; only a real collision replaces them', async () => {
  const HANDLER = 'export async function GET() { return new Response("x") }\n'
  const cases = [
    // [file, replaced?] — a page or a Route Handler that only adds a URL (a static segment wins over [id])
    ['templates/dashboard/(staff)/cohorts/export/page.tsx', false],
    ['templates/dashboard/(staff)/cohorts/export/route.ts', false],
    // The same dynamic name, at a URL the generated routes do not serve
    ['templates/dashboard/(staff)/cohorts/[id]/members/page.tsx', false],
    // The same URL as a generated page, or another name for its dynamic segment
    ['templates/dashboard/(staff)/cohorts/page.tsx', true],
    ['templates/dashboard/(staff)/cohorts/create/page.tsx', true],
    ['templates/dashboard/(staff)/cohorts/[id]/page.tsx', true],
    ['templates/dashboard/(staff)/cohorts/[cohortId]/edit/page.tsx', true],
    ['templates/dashboard/(staff)/cohorts/[cohortId]/performance/page.tsx', true],
    ['templates/dashboard/(staff)/cohorts/[id]/edit/route.ts', true],
    // An optional catch-all also serves its parent's URL: /dashboard/cohorts, /dashboard/cohorts/[id]
    ['templates/dashboard/(staff)/cohorts/[[...slug]]/page.tsx', true],
    ['templates/dashboard/(staff)/cohorts/[id]/[[...x]]/page.tsx', true],
    // A required catch-all does not (Next.js tells [id] and [...x] apart)
    ['templates/dashboard/(staff)/cohorts/[...slug]/page.tsx', false],
  ]
  for (const [file, replaced] of cases) {
    const w = world({ [file]: file.endsWith('route.ts') ? HANDLER : PAGE })
    try {
      const { routes, diagnostics, notices } = await plan(w, [cohortsEntity()], { cohorts: await factsOf(COHORTS) })
      assert.deepEqual(diagnostics, [], file)
      assert.deepEqual(targets(routes).filter(target => target.startsWith('dashboard/(main)/cohorts/')), replaced ? [] : GENERATED_COHORTS, file)
      assert.equal(notices.length, replaced ? 1 : 0, file)
      assert.ok(targets(routes).includes(file.replace(/^templates\//, '')), `${file} is served`)
      assert.equal(targets(routes).includes('dashboard/(staff)/cohorts/layout.tsx'), replaced, `${file}: the guard moves only with a replacement`)
    } finally {
      w.cleanup()
    }
  }
  // An entity whose name is a prefix of another is matched by its exact URL segment only
  const prefix = world({ 'templates/dashboard/(staff)/cohorts/page.tsx': PAGE })
  try {
    const { routes, diagnostics } = await plan(prefix, [cohortsEntity(), entity('cohorts-archive', 'archiveEntityConfig')], { cohorts: await factsOf(COHORTS), 'cohorts-archive': await factsOf("slug: 'cohorts-archive', enabled: true") })
    assert.deepEqual(diagnostics, [])
    assert.equal(targets(routes).filter(target => target.startsWith('dashboard/(main)/cohorts-archive/')).length, 7)
  } finally {
    prefix.cleanup()
  }
})

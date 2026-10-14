import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { RENAMED_FROM_FILE, apiKeyScopesSql, applyEntityRenames, planEntitySlugs, rewriteEntityConfig, rewriteEntityImports, rewritePermissionKey, type EntityRename } from '../src/utils/migrate-entity-slugs.js'

const RENAME: EntityRename = { name: 'order_invoices', oldSlug: 'order_invoices', newSlug: 'order-invoices', tableName: 'order_invoices', setsTableName: true }

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-entity-slugs-'))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  return root
}

test('the slug line changes and tableName follows it, in the three shapes a config has the slug', () => {
  assert.equal(rewriteEntityConfig("export const c = {\n  slug: 'order_invoices',\n  enabled: true,\n}\n", RENAME), "export const c = {\n  slug: 'order-invoices',\n  tableName: 'order_invoices',\n  enabled: true,\n}\n")
  // last property, no comma
  assert.equal(rewriteEntityConfig('export const c = {\n\tenabled: true,\n\tslug: "order_invoices"\n}\n', RENAME), "export const c = {\n\tenabled: true,\n\tslug: 'order-invoices',\n\ttableName: 'order_invoices',\n}\n")
  // inline
  assert.equal(rewriteEntityConfig("export const c = { slug: 'order_invoices', enabled: true }\n", RENAME), "export const c = { slug: 'order-invoices', tableName: 'order_invoices', enabled: true }\n")
  // a tableName the config sets is kept
  assert.equal(rewriteEntityConfig("export const c = {\n  slug: 'order_invoices',\n  tableName: 'invoices',\n}\n", { ...RENAME, tableName: 'invoices', setsTableName: false }), "export const c = {\n  slug: 'order-invoices',\n  tableName: 'invoices',\n}\n")
})

test('imports follow the directory, from the project and from a sibling entity, and nothing else', () => {
  const source = [
    "import a from '@/entities/order_invoices/order_invoices.config'",
    "import b from '../entities/order_invoices/x'",
    "const c = import('@/entities/order_invoices/messages/en.json')",
    "import d from '@/entities/order_invoices_archive/x'",
    "import e from '@/entities/other/order_invoices'",
  ].join('\n')
  assert.equal(rewriteEntityImports(source, RENAME, false), [
    "import a from '@/entities/order-invoices/order_invoices.config'",
    "import b from '../entities/order-invoices/x'",
    "const c = import('@/entities/order-invoices/messages/en.json')",
    "import d from '@/entities/order_invoices_archive/x'",
    "import e from '@/entities/other/order_invoices'",
  ].join('\n'))
  assert.equal(rewriteEntityImports("import a from '../order_invoices/x'\nimport b from './order_invoices/y'", RENAME, true), "import a from '../order-invoices/x'\nimport b from './order_invoices/y'")
  assert.equal(rewriteEntityImports("import a from '../order_invoices/x'", RENAME, false), "import a from '../order_invoices/x'")
})

test('the entity key of the permissions config is renamed, quoted or not, and an action list is not', () => {
  const config = "export const P = {\n  entities: {\n    order_invoices: [\n      { action: 'create', roles: ['owner'] },\n    ],\n    'order_invoices_x': [\n    ],\n  },\n}\n"
  assert.equal(rewritePermissionKey(config, RENAME), config.replace('    order_invoices: [', "    'order-invoices': ["))
})

test('the API-key SQL names the three scopes and is only printed', () => {
  assert.equal(apiKeyScopesSql(RENAME).join('\n'), [
    'UPDATE "api_key"',
    'SET scopes = array_replace(array_replace(array_replace(scopes,',
    "  'order_invoices:read', 'order-invoices:read'),",
    "  'order_invoices:write', 'order-invoices:write'),",
    "  'order_invoices:delete', 'order-invoices:delete')",
    "WHERE scopes && ARRAY['order_invoices:read', 'order_invoices:write', 'order_invoices:delete'];",
  ].join('\n'))
})

test('planning reads both places entities live and skips what cannot be renamed safely', () => {
  const root = project({
    'contents/themes/acme/entities/order_invoices/order_invoices.config.ts': "export const c = {\n  slug: 'order_invoices',\n}\n",
    'entities/campaign_members/campaign_members.config.ts': "export const c = {\n  slug: 'campaign_members',\n  tableName: 'members',\n}\n",
    'entities/tasks/tasks.config.ts': "export const c = { slug: 'tasks' }\n",
    'entities/a_b/a_b.config.ts': "export const c = { slug: 'a_b' }\n",
    'entities/a-b/a-b.config.ts': "export const c = { slug: 'a-b' }\n",
    'entities/x_y/x_y.config.ts': "export const c = { slug: 'x_z' }\n",
  })
  try {
    const plan = planEntitySlugs(root, 'acme')
    assert.deepEqual(plan.renames, [
      { name: 'campaign_members', oldSlug: 'campaign_members', newSlug: 'campaign-members', tableName: 'members', setsTableName: false },
      { name: 'order_invoices', oldSlug: 'order_invoices', newSlug: 'order-invoices', tableName: 'order_invoices', setsTableName: true },
    ])
    assert.deepEqual(plan.skipped.map(item => item.name).sort(), ['a_b', 'x_y'])
    assert.equal(planEntitySlugs(root, null).renames.length, 1, 'without the theme, only the entities already at the root')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('applying renames the directory, edits the config, leaves the marker and rewrites imports; running it twice stops', () => {
  const root = project({
    'entities/order_invoices/order_invoices.config.ts': "export const c = {\n  slug: 'order_invoices',\n}\n",
    'entities/order_invoices/order_invoices.fields.ts': 'export const fields = []\n',
    'lib/use.ts': "import { c } from '@/entities/order_invoices/order_invoices.config'\n",
    'config/permissions.config.ts': "export const P = {\n  entities: {\n    order_invoices: [\n    ],\n  },\n}\n",
    'node_modules/pkg/index.ts': "import '@/entities/order_invoices/x'\n",
  })
  try {
    const { changed } = applyEntityRenames(root, [RENAME])
    assert.ok(changed.includes('entities/order_invoices -> entities/order-invoices'))
    assert.equal(readFileSync(join(root, 'entities/order-invoices/order_invoices.config.ts'), 'utf8'), "export const c = {\n  slug: 'order-invoices',\n  tableName: 'order_invoices',\n}\n")
    assert.equal(readFileSync(join(root, `entities/order-invoices/${RENAMED_FROM_FILE}`), 'utf8'), 'order_invoices -> order-invoices\n')
    assert.equal(readFileSync(join(root, 'entities/order-invoices/order_invoices.fields.ts'), 'utf8'), 'export const fields = []\n')
    assert.equal(readFileSync(join(root, 'lib/use.ts'), 'utf8'), "import { c } from '@/entities/order-invoices/order_invoices.config'\n")
    assert.match(readFileSync(join(root, 'config/permissions.config.ts'), 'utf8'), /'order-invoices': \[/)
    assert.equal(readFileSync(join(root, 'node_modules/pkg/index.ts'), 'utf8'), "import '@/entities/order_invoices/x'\n", 'node_modules is never edited')
    assert.throws(() => applyEntityRenames(root, [RENAME]), /not there to rename/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

const STARTER_COMMENTS = `export const c = {
  // Table naming (from the starter's config):
  // - tableName: 'order_invoices' (slug)
  /* tableName: 'invoices_old', slug: 'not_this' */
  slug: 'order_invoices',
  ui: { tableName: 'nested' },
}
`

test('a tableName that is only written in a comment, or inside a nested object, is not the config\'s tableName', () => {
  const root = project({ 'entities/order_invoices/order_invoices.config.ts': STARTER_COMMENTS })
  try {
    const plan = planEntitySlugs(root, null)
    assert.deepEqual(plan.renames, [RENAME], 'tableName is to be set: the config has none of its own')
    applyEntityRenames(root, plan.renames)
    const config = readFileSync(join(root, 'entities/order-invoices/order_invoices.config.ts'), 'utf8')
    assert.match(config, /^ {2}slug: 'order-invoices',\n {2}tableName: 'order_invoices',$/m)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('planning skips what would lose its table or cannot be read: a dynamic tableName, child entities, no literal slug', () => {
  const root = project({
    'entities/a_dynamic/a_dynamic.config.ts': "const T = 'x'\nexport const c = { slug: 'a_dynamic', tableName: T }\n",
    'entities/a_parent/a_parent.config.ts': "export const c = { slug: 'a_parent' }\n",
    'entities/a_parent/children/items/items.config.ts': "export const c = { slug: 'items' }\n",
    'entities/a_noslug/a_noslug.config.ts': "const S = 'a_noslug'\nexport const c = { slug: S }\n",
    'entities/a_nothing/a_nothing.fields.ts': 'export const fields = []\n',
    'entities/a_ok/a_ok.config.ts': "export const c = { slug: 'a_ok' }\n",
  })
  try {
    const plan = planEntitySlugs(root, null)
    assert.deepEqual(plan.renames.map(item => item.name), ['a_ok'])
    const reasons = Object.fromEntries(plan.skipped.map(item => [item.name, item.reason]))
    assert.match(reasons.a_dynamic, /tableName is not a string literal/)
    assert.match(reasons.a_parent, /child entities' tables are named after this directory/)
    assert.match(reasons.a_noslug, /no literal slug/)
    assert.match(reasons.a_nothing, /no literal slug/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('only module specifiers are rewritten: a comment, a URL or another string keeps the old spelling', () => {
  const source = [
    "// see @/entities/order_invoices/x",
    "const url = '/api/entities/order_invoices/list'",
    'const note = `entities/order_invoices`',
    "import a from '@/entities/order_invoices/x'",
    "export * from '@/entities/order_invoices/y'",
    "const m = require('@/entities/order_invoices/z')",
    "import '@/entities/order_invoices'",
    "jest.mock('@/entities/order_invoices/m1')",
    "vi.mock('@/entities/order_invoices/m2', () => ({}))",
  ].join('\n')
  assert.equal(rewriteEntityImports(source, RENAME, false), [
    "// see @/entities/order_invoices/x",
    "const url = '/api/entities/order_invoices/list'",
    'const note = `entities/order_invoices`',
    "import a from '@/entities/order-invoices/x'",
    "export * from '@/entities/order-invoices/y'",
    "const m = require('@/entities/order-invoices/z')",
    "import '@/entities/order-invoices'",
    "jest.mock('@/entities/order-invoices/m1')",
    "vi.mock('@/entities/order-invoices/m2', () => ({}))",
  ].join('\n'))
})

test('a permissions key the rewrite cannot reach stops the rename and puts every file and directory back', () => {
  const files = {
    'entities/order_invoices/order_invoices.config.ts': "export const c = {\n  slug: 'order_invoices',\n}\n",
    'lib/use.ts': "import { c } from '@/entities/order_invoices/order_invoices.config'\n",
    // the entity key is an object here, not the list the rewrite knows
    'config/permissions.config.ts': "export const P = {\n  entities: {\n    order_invoices: { create: ['owner'] },\n  },\n}\n",
  }
  const root = project(files)
  try {
    assert.throws(() => applyEntityRenames(root, [RENAME]), /could not rename the "order_invoices" key of config\/permissions\.config\.ts; nothing was left changed/)
    for (const [file, content] of Object.entries(files)) assert.equal(readFileSync(join(root, file), 'utf8'), content, file)
    assert.equal(existsSync(join(root, 'entities/order-invoices')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a config the edit cannot change to the new slug and the old table stops the rename and restores the directory', () => {
  const files = { 'entities/order_invoices/order_invoices.config.ts': "export const c = { ...base, slug: 'order_invoices', tableName: TABLE }\n" }
  const root = project(files)
  try {
    // the plan would have skipped this one (dynamic tableName); applying it anyway must not leave a broken tree
    assert.throws(() => applyEntityRenames(root, [{ ...RENAME, setsTableName: false }]), /could not set slug 'order-invoices' and tableName 'order_invoices'/)
    assert.equal(readFileSync(join(root, 'entities/order_invoices/order_invoices.config.ts'), 'utf8'), files['entities/order_invoices/order_invoices.config.ts'])
    assert.equal(existsSync(join(root, 'entities/order-invoices')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

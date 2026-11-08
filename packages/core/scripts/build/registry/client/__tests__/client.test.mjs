import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { planContracts, resolveContractsTarget } from '../../contracts/index.mjs'
import { discoverAllEntities } from '../../discovery/all-entities.mjs'
import { getConfig } from '../../config.mjs'
import { planClient } from '../index.mjs'
import { renderClient } from '../render.mjs'
import { checkHost, prepareHost, projectHostConfig } from '../../host/prepare.mjs'
import { GENERATION_FILE, sha256 } from '../../host/generation.mjs'
import { loadFixtureCoreRoutes } from '../../../../../tests/fixtures/host-conformance/plan.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const require = createRequire(join(CORE_ROOT, 'package.json'))
const ts = require('typescript')
const zodRoot = dirname(require.resolve('zod/package.json'))

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'nextspark-client-')))
const clean = root => rmSync(root, { recursive: true, force: true })

const TASKS_CONFIG = `export const taskEntityConfig = {
  slug: 'tasks',
  names: { singular: 'task', plural: 'Tasks' },
  access: { api: true, shared: false },
  fields: [
    { name: 'title', type: 'text', required: true, display: { label: 'Title' }, api: {} },
    { name: 'status', type: 'select', required: false, defaultValue: 'todo', options: [{ value: 'todo', label: 'To Do' }, { value: 'done', label: 'Done' }], display: { label: 'Status' }, api: {} },
    { name: 'dueDate', type: 'date', required: false, display: { label: 'Due' }, api: {} },
  ],
}
`
const ORDERS_CONFIG = `export const orderEntityConfig = {
  slug: 'orders',
  names: { singular: 'order', plural: 'Orders' },
  access: { api: true },
  fields: [{ name: 'name', type: 'text', required: true, display: { label: 'Name' }, api: {} }],
}
`
// A nested child entity (entities/orders/children/lines): what the child routes serve
const LINES_CONFIG = `export const orderLinesChildConfig = {
  table: 'lines',
  showInParentView: true,
  hasOwnRoutes: false,
  display: { title: 'Lines' },
  fields: [
    { name: 'sku', type: 'text', required: true },
    { name: 'qty', type: 'number', required: false },
    { name: 'kind', type: 'select', required: false, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  ],
}
`
const PLUGIN_ENTITY = `export const noteEntityConfig = {
  slug: 'plugin-notes',
  names: { singular: 'pluginNote', plural: 'Plugin notes' },
  access: { api: true },
  fields: [{ name: 'body', type: 'text', required: true, display: { label: 'Body' }, api: {} }],
}
`

function project(extra = {}) {
  const root = temp()
  write(root, 'nextspark.config.ts', "export default { plugins: ['local-notes'] }\n")
  write(root, 'package.json', JSON.stringify({ name: 'client-project', dependencies: { next: '16.4.2' } }))
  write(root, 'config/theme.config.ts', "export const clientThemeConfig = { name: 'client' }\n")
  write(root, 'entities/tasks/tasks.config.ts', TASKS_CONFIG)
  write(root, 'entities/orders/orders.config.ts', ORDERS_CONFIG)
  write(root, 'entities/orders/children/lines/lines.config.ts', LINES_CONFIG)
  write(root, 'plugins/local-notes/plugin.config.ts', "export const localNotesPluginConfig = { name: 'local-notes', version: '1.0.0', displayName: 'Local notes', description: 'x', enabled: true, dependencies: [] }\n")
  write(root, 'plugins/local-notes/entities/plugin-notes/plugin-notes.config.ts', PLUGIN_ENTITY)
  for (const [path, content] of Object.entries(extra)) write(root, path, content)
  return root
}

const hostConfig = root => ({ ...projectHostConfig({ projectRoot: root, coreRoot: CORE_ROOT }), loadCoreRoutes: loadFixtureCoreRoutes })

async function plans(root) {
  const config = getConfig(root)
  const entities = await discoverAllEntities(config, { includeCore: false })
  const plugins = (config.pluginSources ?? []).map(source => ({ name: source.name, root: source.sourceDir, importBase: source.importBase }))
  const contracts = await planContracts({ entities, projectRoot: root, coreRoot: CORE_ROOT, plugins })
  assert.deepEqual(contracts.diagnostics, [])
  const client = planClient({ entities: contracts.entities, children: contracts.children, projectRoot: root, target: resolveContractsTarget(root) })
  assert.deepEqual(client.diagnostics, [])
  return { contracts, client }
}

/**
 * Type-check the contracts, the generated client and a consumer file the way a project would: the contracts under
 * `.nextspark/contracts`, the client under `.nextspark/registries/entity-client`, and core's own runtime from its sources.
 * Only the diagnostics of files in the temporary project count.
 */
function typeCheck({ contracts, client }, consumer) {
  const root = temp()
  mkdirSync(join(root, 'node_modules'))
  symlinkSync(zodRoot, join(root, 'node_modules/zod'), 'dir')
  for (const file of contracts.files) write(root, `.nextspark/contracts/${file.path}`, file.content)
  for (const file of client.files) write(root, file.path, file.content)
  write(root, 'consumer.tsx', consumer)
  const rootNames = [...contracts.files.map(file => `.nextspark/contracts/${file.path}`), ...client.files.map(file => file.path), 'consumer.tsx'].filter(path => /\.tsx?$/.test(path)).map(path => join(root, path))
  const options = {
    strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve, esModuleInterop: true, types: [], baseUrl: CORE_ROOT,
    paths: { '@nextsparkjs/core/*': ['src/*'], '@/*': ['src/*'] },
  }
  const program = ts.createProgram(rootNames, options)
  const diagnostics = ts.getPreEmitDiagnostics(program)
    .filter(d => d.file && d.file.fileName.startsWith(root))
    .map(d => `${d.file.fileName.slice(root.length + 1)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
  clean(root)
  return diagnostics
}

test('every entity gets a client and hooks: top-level, with child entities, and from a plugin', async () => {
  const root = project()
  try {
    const { client } = await plans(root)
    assert.deepEqual(client.files.map(file => file.path), [
      '.nextspark/registries/entity-client/hooks.ts',
      '.nextspark/registries/entity-client/index.ts',
      '.nextspark/registries/entity-client/orders.client.ts',
      '.nextspark/registries/entity-client/orders.hooks.ts',
      '.nextspark/registries/entity-client/plugin-notes.client.ts',
      '.nextspark/registries/entity-client/plugin-notes.hooks.ts',
      '.nextspark/registries/entity-client/tasks.client.ts',
      '.nextspark/registries/entity-client/tasks.hooks.ts',
    ])
    const get = name => client.files.find(file => file.path.endsWith(`/${name.replace(/^(orders|plugin-notes|tasks)\.ts$/, '$1.client.ts')}`)).content
    assert.match(get('tasks.ts'), /export const tasksClient = runtime\.createEntityClient<Task, CreateTaskInput, UpdateTaskInput>\('tasks'\)/)
    assert.match(get('tasks.ts'), /import type \{ Task, CreateTaskInput, UpdateTaskInput \} from '\.\.\/\.\.\/contracts\/src\/entities\/tasks'/)
    assert.match(get('tasks.hooks.ts'), /^'use client'/)
    for (const hook of ['useTasksList', 'useTask', 'useCreateTask', 'useUpdateTask', 'useDeleteTask']) assert.match(get('tasks.hooks.ts'), new RegExp(`export const ${hook} =`))
    // a child entity: its client, types derived from the parent's contract, and its hooks
    assert.match(get('orders.ts'), /export const orderLinesClient = runtime\.createEntityChildClient<OrderLineRow, CreateOrderLineInput, UpdateOrderLineInput>\('orders', 'lines'\)/)
    assert.match(get('orders.ts'), /export type OrderLineRow = runtime\.EntityChildColumns & \{ sku: string; qty\?: number \| string \| null; kind\?: 'a' \| 'b' \| null \}/)
    assert.match(get('orders.ts'), /export type CreateOrderLineInput = \{ sku: string; qty\?: number \| string \| null; kind\?: 'a' \| 'b' \| null \}/)
    for (const hook of ['useOrderLinesList', 'useCreateOrderLine', 'useUpdateOrderLine', 'useDeleteOrderLine']) assert.match(get('orders.hooks.ts'), new RegExp(`export const ${hook} =`), hook)
    // an entity of a plugin, whose slug is not an identifier
    assert.match(get('plugin-notes.hooks.ts'), /export const usePluginNotesList =/)
    assert.match(get('index.ts'), /'plugin-notes': pluginNotesClient,/)
    assert.match(get('index.ts'), /orders: \{ \.\.\.ordersClient, children: \{ lines: orderLinesClient \} \},/)
    assert.match(get('hooks.ts'), /export \* from '\.\/tasks\.hooks'/)
    // the client never imports a registry or the contracts at run time
    for (const file of client.files) assert.doesNotMatch(file.content, /^import (?!type)[^\n]*contracts/m, file.path)
  } finally {
    clean(root)
  }
})

test('the generated client type-checks under strict, and the types follow the entity: a renamed field is a compile error', async () => {
  const root = project()
  const consumer = `
import { api, type Task, type OrderLineRow } from './.nextspark/registries/entity-client'
import { useTasksList, useTask, useCreateTask, useUpdateTask, useDeleteTask, useCreateOrderLine, useOrderLinesList } from './.nextspark/registries/entity-client/hooks'

export async function server() {
  const list = await api.tasks.list({ limit: 5, filters: { status: 'todo', search: 'x' } })
  const first: Task | undefined = list.data[0]
  const title: string | undefined = first?.title
  const created = await api.tasks.create({ title: 'a', status: 'done' })
  await api.tasks.update(created.id, { title: 'b' })
  const gone: { success: true; id: string } = await api.tasks.delete(created.id)
  await api.orders.children.lines.delete('o1', gone.id)
  const lines = await api.orders.children.lines.list('o1')
  const sku: string | undefined = lines[0]?.sku
  await api.orders.children.lines.create('o1', { sku: 'x', qty: 1 })
  await api['plugin-notes'].create({ body: 'hi' })
  return [title, sku]
}

export function view() {
  const query = useTasksList({ limit: 10 })
  const one = useTask('t1')
  const create = useCreateTask()
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const addLine = useCreateOrderLine()
  const lines = useOrderLinesList('o1')
  create.mutate({ title: 'x' })
  update.mutate({ id: 't1', data: { status: 'done' } })
  remove.mutate('t1')
  addLine.mutate({ parentId: 'o1', data: { sku: 'x' } })
  const rows: OrderLineRow[] | undefined = lines.data
  return [query.data?.data[0]?.title, one.data?.status, rows]
}
`
  try {
    const planned = await plans(root)
    assert.deepEqual(typeCheck(planned, consumer), [])

    // wrong uses fail: a field the entity does not have, a value outside its enum, a missing required field
    const wrong = typeCheck(planned, `
import { api } from './.nextspark/registries/entity-client'
import { useTasksList } from './.nextspark/registries/entity-client/hooks'
export const a = api.tasks.create({ title: 'a', status: 'nope' })
export const b = api.tasks.create({ status: 'done' })
export const c = api.tasks.list({ filters: { nope: 'x' } })
export const d = api.orders.children.lines.create('o1', { qty: 1 })
export const e = () => useTasksList({ filters: { nope: 'x' } })
export const f = api.tasks.delete('x').then(result => result.deleted)
`)
    assert.equal(wrong.length, 6, wrong.join('\n'))

    // rename the field in the entity: the consumer that reads it no longer compiles
    write(root, 'entities/tasks/tasks.config.ts', TASKS_CONFIG.replace("name: 'title'", "name: 'heading'"))
    const renamed = await plans(root)
    assert.deepEqual(typeCheck(renamed, "import { api } from './.nextspark/registries/entity-client'\nexport const ok = api.tasks.create({ heading: 'a' })\n"), [])
    const broken = typeCheck(renamed, consumer)
    assert.ok(broken.some(line => /consumer\.tsx: .*title/.test(line)), broken.join('\n'))
    // and so does a child field renamed
    write(root, 'entities/orders/children/lines/lines.config.ts', LINES_CONFIG.replace("name: 'sku'", "name: 'code'"))
    const childRenamed = typeCheck(await plans(root), consumer)
    assert.ok(childRenamed.some(line => /consumer\.tsx: .*sku/.test(line)), childRenamed.join('\n'))
  } finally {
    clean(root)
  }
})

test('rendering is deterministic: the same entities give the same bytes, in any order, with no timestamps', async () => {
  const root = project()
  try {
    const { contracts } = await plans(root)
    const options = { contractsDir: '../../contracts/src', children: contracts.children }
    const first = renderClient(contracts.entities, options)
    const second = renderClient([...contracts.entities].reverse(), { ...options, children: [...contracts.children].reverse() })
    assert.deepEqual(second, first)
    for (const file of first) assert.doesNotMatch(file.content, /\d{4}-\d{2}-\d{2}T/, file.path)
    // a project with no entity still has a module
    const none = renderClient([], options)
    assert.deepEqual(none.map(file => file.path), ['.nextspark/registries/entity-client/hooks.ts', '.nextspark/registries/entity-client/index.ts'])
  } finally {
    clean(root)
  }
})

test('the types come from the contracts wherever they are written: a linked packages/contracts is imported by its relative path', async () => {
  const base = temp()
  try {
    const web = join(base, 'web')
    write(base, 'packages/contracts/package.json', JSON.stringify({ name: '@project/contracts', private: true, nextspark: { contractsProject: '../../web' } }))
    const sources = project()
    const { cpSync } = await import('node:fs')
    cpSync(sources, web, { recursive: true })
    clean(sources)
    const { client } = await plans(web)
    assert.match(client.files.find(file => file.path.endsWith('/tasks.client.ts')).content, /from '\.\.\/\.\.\/\.\.\/\.\.\/packages\/contracts\/src\/entities\/tasks'/)
  } finally {
    clean(base)
  }
})

test('two entities whose client would export the same name are diagnosed before anything is written', async () => {
  const root = project({
    // `useOrderLinesList` is the hook of this entity and of the lines of an order
    'entities/order-lines/order-lines.config.ts': TASKS_CONFIG.replace("slug: 'tasks'", "slug: 'order-lines'").replace("singular: 'task'", "singular: 'chore'"),
  })
  try {
    const config = getConfig(root)
    const entities = await discoverAllEntities(config, { includeCore: false })
    const contracts = await planContracts({ entities, projectRoot: root, coreRoot: CORE_ROOT, plugins: [] })
    assert.deepEqual(contracts.diagnostics, [])
    const { diagnostics } = planClient({ entities: contracts.entities, children: contracts.children, projectRoot: root, target: resolveContractsTarget(root) })
    assert.ok(diagnostics.some(d => d.code === 'NS_CLIENT_NAME_CLASH' && /useOrderLinesList/.test(d.message)), JSON.stringify(diagnostics))
  } finally {
    clean(root)
  }
})

test('nextspark prepare writes the client with the registries, --check passes, and sees changed, missing, extra and stale files', { timeout: 300_000 }, async () => {
  const root = project()
  try {
    const host = hostConfig(root)
    const first = await prepareHost(host, { mode: 'production' })
    const generated = first.files.filter(file => file.path.startsWith('.nextspark/registries/entity-client/')).map(file => file.path)
    assert.equal(generated.length, 8)
    for (const path of generated) assert.ok(existsSync(join(root, path)), path)
    assert.deepEqual(await checkHost(host), { ok: true, problems: [] })

    // a second run writes nothing and the bytes are the same
    const before = Object.fromEntries(generated.map(path => [path, readFileSync(join(root, path), 'utf8')]))
    const second = await prepareHost(host, { mode: 'production' })
    assert.deepEqual([second.written, second.deleted], [[], []])
    for (const path of generated) assert.equal(readFileSync(join(root, path), 'utf8'), before[path])

    const problems = async () => (await checkHost(host)).problems
    // a generated file edited
    write(root, '.nextspark/registries/entity-client/tasks.hooks.ts', `${before['.nextspark/registries/entity-client/tasks.hooks.ts']}// edited\n`)
    assert.ok((await problems()).some(p => p.path === '.nextspark/registries/entity-client/tasks.hooks.ts'), 'edited')
    await prepareHost(host, { mode: 'production' })
    assert.deepEqual(await problems(), [])

    // a generated file deleted
    rmSync(join(root, '.nextspark/registries/entity-client/tasks.client.ts'))
    assert.ok((await problems()).some(p => p.state === 'missing' && p.path === '.nextspark/registries/entity-client/tasks.client.ts'), 'deleted')
    await prepareHost(host, { mode: 'production' })
    assert.deepEqual(await problems(), [])

    // a file the generation does not own, among the generated ones
    write(root, '.nextspark/registries/entity-client/leftover.ts', 'export {}\n')
    const extra = (await problems()).find(p => p.path === '.nextspark/registries/entity-client/leftover.ts')
    assert.ok(extra, 'extra')
    // prepare never deletes a file it does not own, so the message asks for it to be deleted, by path
    assert.match(extra.detail, /delete \.nextspark\/registries\/entity-client\/leftover\.ts by hand/)
    assert.doesNotMatch(extra.detail, /run nextspark prepare/i)
    await prepareHost(host, { mode: 'production' })
    assert.equal(existsSync(join(root, '.nextspark/registries/entity-client/leftover.ts')), true, 'prepare leaves it')
    assert.ok((await problems()).some(p => p.path === '.nextspark/registries/entity-client/leftover.ts'), 'still reported after prepare')
    rmSync(join(root, '.nextspark/registries/entity-client/leftover.ts'))
    assert.deepEqual(await problems(), [])

    // the entity changes: the client is stale until prepare, and a removed entity's files go with it
    write(root, 'entities/tasks/tasks.config.ts', TASKS_CONFIG.replace("name: 'title'", "name: 'heading'"))
    assert.ok((await problems()).some(p => p.state === 'stale'), 'changed entity')
    await prepareHost(host, { mode: 'production' })
    assert.match(readFileSync(join(root, '.nextspark/registries/entity-client/tasks.client.ts'), 'utf8'), /createEntityClient<Task/)
    assert.deepEqual(await problems(), [])
    rmSync(join(root, 'entities/orders'), { recursive: true })
    const removed = await prepareHost(host, { mode: 'production' })
    assert.ok(removed.deleted.includes('.nextspark/registries/entity-client/orders.hooks.ts'))
    assert.equal(existsSync(join(root, '.nextspark/registries/entity-client/orders.client.ts')), false)
    assert.deepEqual(await problems(), [])

    // a registry file that appears with no record, or that the record lists but the output no longer contains
    write(root, '.nextspark/registries/stray-registry.ts', 'export {}\n')
    assert.ok((await problems()).some(p => p.path === '.nextspark/registries/stray-registry.ts'), 'unrecorded registry')
  } finally {
    clean(root)
  }
})

test('--check compares the client with what would be generated, not only with the record: output that drifted with its record is stale', { timeout: 300_000 }, async () => {
  const root = project()
  try {
    const host = hostConfig(root)
    await prepareHost(host, { mode: 'production' })
    assert.deepEqual((await checkHost(host)).problems, [])
    // A generator that changed between two builds of the same version leaves bytes and record agreeing with each other, but not with the output
    const path = '.nextspark/registries/entity-client/tasks.client.ts'
    const drifted = `${readFileSync(join(root, path), 'utf8')}export const drifted = true\n`
    write(root, path, drifted)
    const record = JSON.parse(readFileSync(join(root, GENERATION_FILE), 'utf8'))
    record.files[path] = sha256(drifted)
    write(root, GENERATION_FILE, `${JSON.stringify(record, null, 2)}\n`)
    const problems = (await checkHost(host)).problems
    assert.ok(problems.some(p => p.path === path && p.state === 'stale' && /differs from what prepare generates now/.test(p.detail)), JSON.stringify(problems))
    // The same for a file the output no longer contains, recorded and present
    write(root, '.nextspark/registries/entity-client/old.ts', 'export {}\n')
    const withOld = JSON.parse(readFileSync(join(root, GENERATION_FILE), 'utf8'))
    withOld.files['.nextspark/registries/entity-client/old.ts'] = sha256('export {}\n')
    write(root, GENERATION_FILE, `${JSON.stringify(withOld, null, 2)}\n`)
    assert.ok((await checkHost(host)).problems.some(p => p.path === '.nextspark/registries/entity-client/old.ts' && /no longer part of the output/.test(p.detail)))
    // prepare brings both back, and deletes the file it owned
    const repaired = await prepareHost(host, { mode: 'production' })
    assert.ok(repaired.deleted.includes('.nextspark/registries/entity-client/old.ts'))
    assert.deepEqual((await checkHost(host)).problems, [])
  } finally {
    clean(root)
  }
})

test('a child declared only in childEntities has no client (the routes do not serve it); the nested children/ directory does', async () => {
  const root = project({
    'entities/legacy/legacy.config.ts': `export const legacyEntityConfig = {
  slug: 'legacy',
  access: { api: true },
  fields: [{ name: 'name', type: 'text', required: true, display: { label: 'Name' }, api: {} }],
  childEntities: { rows: { table: 'legacy_rows', showInParentView: true, hasOwnRoutes: false, display: { title: 'Rows' }, fields: [{ name: 'x', type: 'text', required: true }] } },
}
`,
  })
  try {
    const { client } = await plans(root)
    const legacy = client.files.find(file => file.path.endsWith('/legacy.client.ts')).content
    assert.doesNotMatch(legacy, /createEntityChildClient|Row/)
    assert.match(client.files.find(file => file.path.endsWith('/orders.client.ts')).content, /createEntityChildClient/)
  } finally {
    clean(root)
  }
})

test('a slug that is a name of the generated files or of core\'s runtime (hooks, entity) cannot break the module; index is rendered to distinct paths', async () => {
  const entity = slug => TASKS_CONFIG.replace("slug: 'tasks'", `slug: '${slug}'`).replace("singular: 'task'", `singular: '${slug}'`)
  const root = project({ 'entities/hooks/hooks.config.ts': entity('hooks'), 'entities/entity/entity.config.ts': entity('entity') })
  try {
    const planned = await plans(root)
    const paths = planned.client.files.map(file => file.path)
    assert.equal(new Set(paths).size, paths.length)
    assert.ok(paths.includes('.nextspark/registries/entity-client/hooks.client.ts') && paths.includes('.nextspark/registries/entity-client/hooks.hooks.ts'))
    assert.deepEqual(typeCheck(planned, `
import { api } from './.nextspark/registries/entity-client'
import { useHooksList, useEntityList } from './.nextspark/registries/entity-client/hooks'
export const a = [api.hooks.list, api.entity.list, useHooksList, useEntityList]
`), [])
    // the same project prepares: no path is generated twice
    const first = await prepareHost(hostConfig(root), { mode: 'production' })
    assert.ok(first.files.some(file => file.path === '.nextspark/registries/entity-client/hooks.hooks.ts'))
    assert.deepEqual((await checkHost(hostConfig(root))).problems, [])
  } finally {
    clean(root)
  }
  // `index` (the contracts module itself cannot hold an entity of that slug): the client's own files stay distinct
  const contract = { slug: 'index', singular: null, fields: [], childEntities: null }
  const files = renderClient([{ contract, source: 'x' }], { contractsDir: '../../contracts/src' })
  assert.deepEqual(files.map(file => file.path).sort(), [
    '.nextspark/registries/entity-client/hooks.ts', '.nextspark/registries/entity-client/index.client.ts',
    '.nextspark/registries/entity-client/index.hooks.ts', '.nextspark/registries/entity-client/index.ts',
  ])
})

test('--check on the command line: a file prepare does not own asks to be deleted by hand, never to run prepare again', { timeout: 300_000 }, () => {
  const root = project()
  try {
    const cli = join(CORE_ROOT, 'scripts/build/registry/host/prepare-cli.mjs')
    const ran = spawnSync(process.execPath, [cli, '--production'], { cwd: root, encoding: 'utf8' })
    assert.equal(ran.status, 0, ran.stdout + ran.stderr)
    write(root, '.nextspark/registries/entity-client/leftover.ts', 'export {}\n')
    const foreign = spawnSync(process.execPath, [cli, '--check'], { cwd: root, encoding: 'utf8' })
    assert.equal(foreign.status, 1)
    assert.match(foreign.stderr, /leftover\.ts/)
    assert.doesNotMatch(foreign.stderr, /Run nextspark prepare to regenerate/)
    assert.match(foreign.stderr, /Delete the file\(s\) above by hand/)
    // with another problem prepare can fix, it is still asked for
    write(root, 'entities/tasks/tasks.config.ts', TASKS_CONFIG.replace("name: 'title'", "name: 'heading'"))
    assert.match(spawnSync(process.execPath, [cli, '--check'], { cwd: root, encoding: 'utf8' }).stderr, /Run nextspark prepare to regenerate/)
  } finally {
    clean(root)
  }
})

test('a child whose name carries its parent (orders_notes) is requested by that name, and named after the short one; the columns the routes own are not sent', async () => {
  const root = project({
    'entities/orders/children/notes/notes.config.ts': `export const orderNotesChildConfig = {
  table: 'orders_notes',
  showInParentView: true,
  hasOwnRoutes: false,
  display: { title: 'Notes' },
  fields: [
    { name: 'parentId', type: 'text', required: true },
    { name: 'id', type: 'text', required: true },
    { name: 'body', type: 'text', required: true },
  ],
}
`,
  })
  try {
    const planned = await plans(root)
    const orders = planned.client.files.find(file => file.path.endsWith('/orders.client.ts')).content
    // the route matches the registry name, whole
    assert.match(orders, /runtime\.createEntityChildClient<OrderNoteRow, CreateOrderNoteInput, UpdateOrderNoteInput>\('orders', 'orders_notes'\)/)
    assert.match(planned.client.files.find(file => file.path.endsWith('/orders.hooks.ts')).content, /export const useOrderNotesList =/)
    assert.match(planned.client.files.find(file => file.path.endsWith('/index.ts')).content, /children: \{ lines: orderLinesClient, orders_notes: orderNotesClient \}/)
    // parentId and id are the routes' columns: not in what is sent, and in the row only once, as the string the columns give
    assert.match(orders, /export type CreateOrderNoteInput = \{ body: string \}/)
    assert.match(orders, /export type OrderNoteRow = runtime\.EntityChildColumns & \{ body: string \}/)
    assert.deepEqual(typeCheck(planned, `
import { api } from './.nextspark/registries/entity-client'
export const ok = api.orders.children.orders_notes.create('o1', { body: 'x' })
// @ts-expect-error the routes own parentId
export const bad = api.orders.children.orders_notes.create('o1', { body: 'x', parentId: 'p' })
`), [])
  } finally {
    clean(root)
  }
})

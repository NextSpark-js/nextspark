import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { Sources, readEntityContract } from '../read-entities.mjs'
import { renderContracts } from '../render.mjs'
import { ContractsPublishError, checkContracts, publishContracts, readContractsRecord } from '../publish.mjs'
import { planContracts, resolveContractsTarget } from '../index.mjs'
import { PrepareError, checkHost, prepareHost, projectHostConfig } from '../../host/prepare.mjs'
import { loadFixtureCoreRoutes } from '../../../../../tests/fixtures/host-conformance/plan.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const require = createRequire(join(CORE_ROOT, 'package.json'))
const ts = require('typescript')
const zodRoot = dirname(require.resolve('zod/package.json'))

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'nextspark-contracts-')))
const clean = root => rmSync(root, { recursive: true, force: true })

const FIELDS = `import type { EntityField } from '@nextsparkjs/core/lib/entities/types'
const STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]
export const baseFields: EntityField[] = [
  { name: 'title', type: 'text', required: true, maxLength: 80, display: { label: 'Title' }, api: { readOnly: false } },
]
export const taskFields: EntityField[] = [
  ...baseFields,
  { name: 'status', type: 'select', required: false, defaultValue: 'todo', options: STATUSES, display: { label: 'Status' }, api: {} },
  { name: 'estimate', type: 'number', required: false, min: 0, max: 100, display: { label: 'Estimate' }, api: {} },
  { name: 'done', type: 'boolean', required: false, display: { label: 'Done' }, api: {} },
  { name: 'days', type: 'multiselect', required: false, options: [{ value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }], display: { label: 'Days' }, api: {} },
  { name: 'meta', type: 'json', required: false, display: { label: 'Meta' }, api: {} },
  { name: 'score', type: 'doublerange', required: false, display: { label: 'Score' }, api: {} },
  { name: 'refs', type: 'relation-multi', required: false, display: { label: 'Refs' }, api: {} },
  { name: 'stamp', type: 'datetime', required: false, display: { label: 'Stamp' }, api: { readOnly: true } },
]
`
const TASKS_CONFIG = `import { CheckSquare } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { taskFields } from './tasks.fields'
export const taskEntityConfig: EntityConfig = {
  slug: 'tasks',
  enabled: true,
  names: { singular: 'task', plural: 'Tasks' },
  icon: CheckSquare,
  access: { public: false, api: true, shared: false },
  fields: taskFields,
}
`
const NOTES_CONFIG = `export const noteEntityConfig = {
  slug: 'notes',
  names: { singular: 'note', plural: 'Notes' },
  access: { shared: true },
  fields: [
    { name: 'body', type: 'textarea', required: true, display: { label: 'Body' }, api: {} },
    { name: 'kind', type: 'select', required: true, options: computedOptions(), display: { label: 'Kind' }, api: {} },
    { name: computedName, type: 'text', required: false, display: { label: 'X' }, api: {} },
  ],
}
`

function project(extra = {}) {
  const root = temp()
  write(root, 'nextspark.config.ts', 'export default { plugins: [] }\n')
  write(root, 'package.json', JSON.stringify({ name: 'contracts-project', dependencies: { next: '16.3.6' } }))
  write(root, 'config/theme.config.ts', "export const contractsThemeConfig = { name: 'contracts' }\n")
  write(root, 'entities/tasks/tasks.config.ts', TASKS_CONFIG)
  write(root, 'entities/tasks/tasks.fields.ts', FIELDS)
  write(root, 'entities/notes/notes.config.ts', NOTES_CONFIG)
  write(root, 'entities/hidden/hidden.config.ts', "export const hiddenEntityConfig = { slug: 'hidden', access: { api: false }, fields: [] }\n")
  write(root, 'entities/off/off.config.ts', "export const offEntityConfig = { slug: 'off', enabled: false, fields: [] }\n")
  for (const [path, content] of Object.entries(extra)) write(root, path, content)
  return root
}

const config = root => ({ ...projectHostConfig({ projectRoot: root, coreRoot: CORE_ROOT }), loadCoreRoutes: loadFixtureCoreRoutes })

/** Compile the rendered files (with the real zod) and hand back the CommonJS modules. */
function compile(files) {
  const root = temp()
  mkdirSync(join(root, 'node_modules'))
  symlinkSync(zodRoot, join(root, 'node_modules/zod'), 'dir')
  for (const file of files) write(root, file.path, file.content)
  const rootNames = files.filter(file => file.path.endsWith('.ts')).map(file => join(root, file.path))
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, types: [] }
  const program = ts.createProgram(rootNames, options)
  const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
  for (const file of files) {
    const out = ts.transpileModule(file.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
    write(root, file.path.replace(/\.ts$/, '.js'), out.outputText)
  }
  return { root, diagnostics, load: path => require(join(root, path)), cleanup: () => clean(root) }
}

test('the entity configs are read as literals: fields resolved through imports and spreads, enums, constraints, columns the handlers select', async () => {
  const root = project()
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    assert.deepEqual(plan.diagnostics, [])
    assert.deepEqual(plan.files.map(file => file.path), [
      'src/entities/index.ts', 'src/entities/notes.ts', 'src/entities/tasks.ts', 'src/envelope.ts', 'src/fields.ts', 'src/index.ts',
      'src/schema/media-ref.ts', 'src/schema/response-shape.ts', 'src/schema/schema-generator.ts', 'src/schema/system-fields.ts', 'src/schema/types.ts',
    ])
    const tasks = plan.files.find(file => file.path === 'src/entities/tasks.ts').content
    assert.match(tasks, /^\/\/ Source: @\/entities\/tasks\/tasks\.config$/m)
    assert.match(tasks, /export const tasksApiPath = '\/api\/v1\/tasks'/)
    assert.match(tasks, /export const taskStatusSchema = z\.enum\(\['todo', 'in-progress', 'done'\]\)/)
    assert.match(tasks, /export type TaskStatus = z\.infer<typeof taskStatusSchema>/)
    // the entity descriptor the server's generator runs on: fields resolved through the import and the spread, with their constraints
    assert.match(tasks, /\{ name: 'title', type: 'text', required: true, maxLength: 80, display: \{ label: 'Title' \}, api: \{ readOnly: false \} \},/)
    assert.match(tasks, /\{ name: 'status', type: 'select', required: false, defaultValue: 'todo', options: \[\{ value: 'todo', label: 'To Do' \}, \{ value: 'in-progress', label: 'In Progress' \}, \{ value: 'done', label: 'Done' \}\], display: \{ label: 'Status' \}, api: \{ readOnly: false \} \},/)
    assert.match(tasks, /\{ name: 'estimate', type: 'number', required: false, min: 0, max: 100,/)
    assert.match(tasks, /\{ name: 'stamp', type: 'datetime', required: false, display: \{ label: 'Stamp' \}, api: \{ readOnly: true \} \},/)
    assert.match(tasks, /const taskSchemas = generateEntitySchemas\(taskEntity\)/)
    // the response: the columns the handlers select first (userId always), then the fields; a number of unknown column type is a number or a string
    assert.match(tasks, /export const taskSchema = z\.object\(\{\n {2}id: z\.string\(\),\n {2}userId: z\.string\(\),\n {2}teamId: z\.string\(\),\n {2}createdAt: z\.string\(\),\n {2}updatedAt: z\.string\(\),\n {2}title: z\.string\(\),\n {2}status: taskStatusSchema,\n {2}estimate: z\.union\(\[z\.number\(\), z\.string\(\)\]\)\.nullish\(\),\n {2}done: z\.boolean\(\)\.nullish\(\),\n {2}days: z\.array\(taskDaysOptionSchema\)\.nullish\(\),\n {2}meta: z\.unknown\(\)\.nullish\(\),\n {2}score: z\.tuple\(\[z\.number\(\), z\.number\(\)\]\)\.nullish\(\),\n {2}refs: z\.union\(\[z\.array\(z\.string\(\)\), z\.string\(\)\]\)\.nullish\(\),\n {2}stamp: z\.string\(\)\.nullish\(\),\n {2}metas: metasResponseSchema\.optional\(\),\n {2}children: childrenResponseSchema\.optional\(\),\n\}\)/)
    // requests are the server's schemas, typed for clients; read-only fields are not in the types
    assert.match(tasks, /export const createTaskInputSchema = taskSchemas\.create as unknown as z\.ZodType<CreateTaskInput>/)
    assert.match(tasks, /export const updateTaskInputSchema = taskSchemas\.update as unknown as z\.ZodType<UpdateTaskInput>/)
    assert.doesNotMatch(tasks.split('const taskCreateShape')[1], /stamp/)
    assert.doesNotMatch(tasks, /Warning/)

    // a shared entity still has userId (the handlers always select it); what cannot be read literally says so
    const notes = plan.files.find(file => file.path === 'src/entities/notes.ts').content
    assert.match(notes, /userId: z\.string\(\),/)
    assert.match(notes, /^\/\/ Warning: field "kind": `options` could not be read literally, so its values are typed as plain strings$/m)
    assert.match(notes, /^\/\/ Warning: a field has no literal identifier `name` and was left out of the contract$/m)
    assert.match(notes, /kind: z\.string\(\),/)
    assert.deepEqual(plan.warnings.length, 2)
    // disabled entities and entities without an external API are not part of the contract
    assert.ok(!plan.files.some(file => /hidden|off/.test(file.path)))
  } finally {
    clean(root)
  }
})

async function entitiesOf(root) {
  const { getConfig } = await import('../../config.mjs')
  const { discoverAllEntities } = await import('../../discovery/all-entities.mjs')
  return discoverAllEntities(getConfig(root), { includeCore: false })
}

test('the rendered module type-checks under strict with zod alone, and its schemas behave like the server contract', async () => {
  const root = project({ 'entities/notes/notes.config.ts': "export const noteEntityConfig = { slug: 'notes', names: { singular: 'note' }, access: { shared: true }, fields: [{ name: 'body', type: 'textarea', required: true, display: {}, api: {} }] }\n" })
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    const compiled = compile([
      ...plan.files,
      {
        path: 'probe.ts',
        content: [
          "import { createTaskInputSchema, taskSchema, apiListResponseSchema, type Task, type CreateTaskInput, type UpdateTaskInput, type ApiListResponse, type TaskStatus } from './src'",
          "const status: TaskStatus = 'in-progress'",
          "// @ts-expect-error not a status of the entity",
          "const bad: TaskStatus = 'archived'",
          "const create: CreateTaskInput = { title: 'x' }",
          "// @ts-expect-error a required field is required",
          "const missing: CreateTaskInput = {}",
          "const update: UpdateTaskInput = { estimate: null }",
          "declare const task: Task",
          "const teamId: string = task.teamId",
          "const days: ('mon' | 'tue')[] | null | undefined = task.days",
          "declare const list: ApiListResponse<Task>",
          "const total: number = list.info.total",
          "export const listSchema = apiListResponseSchema(taskSchema)",
          "export const used = [status, bad, create, missing, update, teamId, days, total, createTaskInputSchema]",
        ].join('\n'),
      },
    ])
    try {
      assert.deepEqual(compiled.diagnostics, [])
      const contracts = compiled.load('src/index.js')
      // strict like the server: an unknown key is rejected, a bad option is rejected, defaults are optional
      assert.equal(contracts.createTaskInputSchema.safeParse({ title: 'x' }).success, true)
      assert.equal(contracts.createTaskInputSchema.safeParse({ title: 'x', nope: 1 }).success, false)
      assert.equal(contracts.createTaskInputSchema.safeParse({ title: 'x', status: 'archived' }).success, false)
      assert.equal(contracts.createTaskInputSchema.safeParse({ title: 'x'.repeat(81) }).success, false)
      assert.equal(contracts.createTaskInputSchema.safeParse({ title: 'x', estimate: 101 }).success, false)
      assert.equal(contracts.updateTaskInputSchema.safeParse({ estimate: null, status: null }).success, true)
      assert.equal(contracts.createTaskInputSchema.safeParse({ title: 'x', stamp: '2026-01-01T00:00:00Z' }).success, false, 'read-only fields are not writable')
      const row = { id: '1', title: 'T', status: 'done', teamId: 't', userId: 'u', createdAt: 'a', updatedAt: 'b' }
      assert.equal(contracts.taskSchema.safeParse(row).success, true)
      assert.equal(contracts.taskSchema.safeParse({ ...row, status: 'archived' }).success, false)
      // the envelope is what createApiResponse / createApiError send
      const info = { timestamp: '2026-01-01T00:00:00.000Z', page: 1, limit: 10, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false }
      assert.equal(contracts.apiListResponseSchema(contracts.taskSchema).safeParse({ success: true, data: [row], info }).success, true)
      assert.equal(contracts.apiSuccessResponseSchema(contracts.taskSchema).safeParse({ success: true, data: row, info: { timestamp: 'x', created: true } }).success, true)
      assert.equal(contracts.apiErrorResponseSchema.safeParse({ success: false, error: 'Nope', code: 'HTTP_400', details: [], info: { timestamp: 'x' } }).success, true)
      assert.equal(contracts.apiListResponseSchema(contracts.taskSchema).safeParse({ success: true, data: [row], meta: { total: 1 } }).success, false, 'the wire has info, not meta')
    } finally {
      compiled.cleanup()
    }
  } finally {
    clean(root)
  }
})

test('field types whose wire shape is not a plain scalar follow what the server accepts: files, images, media, addresses, id lists, rating', async () => {
  const fields = [
    ['gallery', 'image'], ['docs', 'file'], ['cover', 'media-library'], ['home', 'address'], ['owners', 'relation-multi'], ['stars', 'rating'], ['cur', 'currency'], ['land', 'country'], ['mystery', 'made-up-type'],
  ].map(([name, type]) => `{ name: '${name}', type: '${type}', required: false, display: {}, api: {} }`).join(', ')
  const root = project({ 'entities/gallery/gallery.config.ts': `export const galleryEntityConfig = { slug: 'galleries', names: { singular: 'gallery' }, fields: [${fields}] }\n` })
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    const gallery = plan.files.find(file => file.path === 'src/entities/galleries.ts').content
    assert.match(gallery, /import \{ addressSchema, fileObjectSchema, mediaRefSchema \} from '\.\.\/fields'/)
    assert.match(gallery, /gallery: z\.union\(\[z\.string\(\), z\.array\(fileObjectSchema\)\]\)\.nullish\(\),/)
    assert.match(gallery, /docs: z\.array\(fileObjectSchema\)\.nullish\(\),/)
    assert.match(gallery, /cover: mediaRefSchema\.nullish\(\),/)
    assert.match(gallery, /home: addressSchema\.nullish\(\),/)
    assert.match(gallery, /owners: z\.union\(\[z\.array\(z\.string\(\)\), z\.string\(\)\]\)\.nullish\(\),/, 'a response may carry the JSON string the server stores')
    assert.match(gallery, /owners: z\.array\(z\.string\(\)\)\.nullish\(\),/, 'a write sends the array')
    assert.match(gallery, /stars: z\.union\(\[z\.number\(\), z\.string\(\)\]\)\.nullish\(\),/, 'the server accepts a number or a numeric string')
    assert.match(gallery, /type: 'currency'/, 'the server enforces the 3-letter length: the descriptor carries the type, the generator does the rest')
    assert.match(gallery, /land: z\.string\(\)\.nullish\(\),/)
    assert.match(gallery, /mystery: z\.unknown\(\)\.nullish\(\),/)
    const compiled = compile(plan.files)
    try {
      assert.deepEqual(compiled.diagnostics, [])
    } finally {
      compiled.cleanup()
    }
  } finally {
    clean(root)
  }
})

/** Evaluate core's portable sources with a tiny CommonJS loader (zod from core), returning `schema-generator`'s exports. */
function loadServerGenerator() {
  const portable = join(CORE_ROOT, 'src/lib/entities/portable')
  const cache = new Map()
  const load = name => {
    if (cache.has(name)) return cache.get(name).exports
    const module = { exports: {} }
    cache.set(name, module)
    const { outputText } = ts.transpileModule(readFileSync(join(portable, `${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
    new Function('require', 'module', 'exports', outputText)(id => (id === 'zod' ? require('zod') : load(id.replace(/^\.\//, ''))), module, module.exports)
    return module.exports
  }
  return load('schema-generator')
}

test('childEntities: the contract accepts `children` exactly when the server does (an order with lines)', async () => {
  const config = `export const orderEntityConfig = {
  slug: 'orders',
  names: { singular: 'order', plural: 'Orders' },
  fields: [{ name: 'name', type: 'text', required: true, display: { label: 'Name' }, api: {} }],
  childEntities: {
    lines: {
      table: 'order_lines',
      showInParentView: true,
      hasOwnRoutes: false,
      display: { title: 'Lines' },
      fields: [
        { name: 'sku', type: 'text', required: true },
        { name: 'qty', type: 'number', required: false, defaultValue: 1 },
        { name: 'kind', type: 'select', required: false, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], display: { label: 'Kind' } },
      ],
    },
  },
}\n`
  const root = project({ 'entities/orders/orders.config.ts': config })
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    assert.deepEqual(plan.diagnostics, [])
    // The child row types reject what the schema rejects: an invalid row is a type error, a valid one is not
    const probe = [
      "import type { CreateOrderInput, UpdateOrderInput } from './src'",
      "export const valid: CreateOrderInput = { name: 'A', children: { lines: [{ sku: 'x', qty: 2, kind: 'a' }, { id: 'l1', sku: 'y', qty: '3' }] } }",
      "export const validUpdate: UpdateOrderInput = { children: { lines: [{ sku: 'x' }] } }",
      "// @ts-expect-error a line without its required sku, and a key no line has",
      "export const bogus: CreateOrderInput = { name: 'A', children: { lines: [{ bogus: 123 }] } }",
      "// @ts-expect-error a line without its required sku",
      "export const noSku: CreateOrderInput = { name: 'A', children: { lines: [{ qty: 1 }] } }",
      "// @ts-expect-error an option the child does not have",
      "export const badKind: CreateOrderInput = { name: 'A', children: { lines: [{ sku: 'x', kind: 'z' }] } }",
      "// @ts-expect-error a child kind the entity does not have",
      "export const other: CreateOrderInput = { name: 'A', children: { other: [] } }",
      "// @ts-expect-error the same holds on update",
      "export const bogusUpdate: UpdateOrderInput = { children: { lines: [{ bogus: 1 }] } }",
    ].join('\n')
    const compiled = compile([...plan.files, { path: 'probe.ts', content: probe }])
    try {
      assert.deepEqual(compiled.diagnostics, [])
      const contract = compiled.load('src/index.js')
      const { outputText } = ts.transpileModule(config, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
      const exported = { exports: {} }
      new Function('module', 'exports', outputText)(exported, exported.exports)
      const server = loadServerGenerator().generateEntitySchemas(exported.exports.orderEntityConfig)
      const cases = [
        ['a parent with lines', { name: 'A', children: { lines: [{ sku: 'x', qty: 2 }] } }],
        ['a line with an id (an update of a line)', { name: 'A', children: { lines: [{ id: 'l1', sku: 'x' }] } }],
        ['a line without its required sku', { name: 'A', children: { lines: [{ qty: 1 }] } }],
        ['a line with an unknown key', { name: 'A', children: { lines: [{ sku: 'x', nope: 1 }] } }],
        ['a bad option in a line', { name: 'A', children: { lines: [{ sku: 'x', kind: 'z' }] } }],
        ['a good option in a line', { name: 'A', children: { lines: [{ sku: 'x', kind: 'b' }] } }],
        ['an unknown child kind', { name: 'A', children: { other: [] } }],
        ['no children', { name: 'A' }],
        ['a numeric string qty', { name: 'A', children: { lines: [{ sku: 'x', qty: '3' }] } }],
      ]
      for (const [name, payload] of cases) {
        const expected = server.create.safeParse(payload)
        const actual = contract.createOrderInputSchema.safeParse(payload)
        assert.equal(actual.success, expected.success, name)
        if (expected.success) assert.deepEqual(actual.data, expected.data, name)
        const expectedUpdate = server.update.safeParse(payload)
        assert.equal(contract.updateOrderInputSchema.safeParse(payload).success, expectedUpdate.success, `update: ${name}`)
      }
      assert.equal(contract.createOrderInputSchema.safeParse({ name: 'A', children: { lines: [{ sku: 'x' }] } }).success, true)
    } finally {
      compiled.cleanup()
    }
  } finally {
    clean(root)
  }
})

test('every shared field schema a child row needs is imported: address, image, file and media-library in child fields compile', async () => {
  const field = (name, type) => `{ name: '${name}', type: '${type}', required: false }`
  const root = project({
    'entities/orders/orders.config.ts': `export const orderEntityConfig = {
  slug: 'orders',
  names: { singular: 'order' },
  fields: [{ name: 'name', type: 'text', required: true, display: { label: 'Name' }, api: {} }],
  childEntities: {
    lines: { table: 'order_lines', fields: [${field('home', 'address')}, ${field('photo', 'image')}, ${field('docs', 'file')}, ${field('cover', 'media-library')}, ${field('kind', 'select').replace('}', ", options: [{ value: 'a', label: 'A' }] }")}] },
  },
}\n`,
  })
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    assert.deepEqual(plan.diagnostics, [])
    const orders = plan.files.find(file => file.path === 'src/entities/orders.ts').content
    assert.match(orders, /import \{ addressSchema, fileObjectSchema, mediaRefSchema \} from '\.\.\/fields'/, 'imported although only child fields use them')
    const probe = [
      "import type { CreateOrderInput } from './src'",
      "export const valid: CreateOrderInput = { name: 'A', children: { lines: [{ home: { city: 'X' }, photo: 'https://e.com/a.png', docs: [{ id: '1', name: 'n', size: 1, url: 'https://e.com/a' }], cover: { mediaId: 'm', url: 'u' }, kind: 'a' }] } }",
      "// @ts-expect-error a child address is an address, not a number",
      "export const bad: CreateOrderInput = { name: 'A', children: { lines: [{ home: 5 }] } }",
    ].join('\n')
    const compiled = compile([...plan.files, { path: 'probe.ts', content: probe }])
    try {
      assert.deepEqual(compiled.diagnostics, [])
    } finally {
      compiled.cleanup()
    }
  } finally {
    clean(root)
  }
})

test('a childEntities that cannot be described fails generation instead of publishing a contradictory schema', async () => {
  const root = project({
    'entities/orders/orders.config.ts': "export const orderEntityConfig = { slug: 'orders', names: { singular: 'order' }, fields: [], childEntities: { ...sharedChildren, lines: { table: 't', fields: buildFields() } } }\n",
  })
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    assert.deepEqual(plan.files, [])
    assert.ok(plan.diagnostics.some(d => d.code === 'NS_CONTRACTS_ENTITY_UNREADABLE' && /childEntities/.test(d.message)), JSON.stringify(plan.diagnostics))
  } finally {
    clean(root)
  }
})

test('the module imports zod and nothing else: no Node built-ins, no server code, no registries', async () => {
  const root = project()
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    for (const file of plan.files) {
      const imports = ts.preProcessFile(file.content, true, true).importedFiles.map(entry => entry.fileName)
      for (const specifier of imports) assert.ok(specifier === 'zod' || specifier.startsWith('./') || specifier.startsWith('../'), `${file.path} imports ${specifier}`)
    }
  } finally {
    clean(root)
  }
})

test('rendering is deterministic: the same entities give the same bytes, in any discovery order', async () => {
  const root = project()
  try {
    const entities = await entitiesOf(root)
    const first = await planContracts({ entities, projectRoot: root, coreRoot: CORE_ROOT })
    const second = await planContracts({ entities: [...entities].reverse(), projectRoot: root, coreRoot: CORE_ROOT })
    assert.deepEqual(first.files, second.files)
    assert.deepEqual(renderContracts([]).map(file => file.path), ['src/entities/index.ts', 'src/envelope.ts', 'src/fields.ts', 'src/index.ts'])
    assert.ok(first.files.every(file => !/\d{4}-\d{2}-\d{2}T/.test(file.content)), 'no timestamps')
  } finally {
    clean(root)
  }
})

test('two entities that would export the same name, and an entity that cannot be read, are diagnosed before anything is written', async () => {
  const root = project({
    'entities/task2/task2.config.ts': "export const otherEntityConfig = { slug: 'to-dos', names: { singular: 'task' }, fields: [] }\n",
    'entities/broken/broken.config.ts': 'export const brokenEntityConfig = makeConfig()\n',
  })
  try {
    const plan = await planContracts({ entities: await entitiesOf(root), projectRoot: root, coreRoot: CORE_ROOT })
    assert.deepEqual(plan.files, [])
    assert.ok(plan.diagnostics.some(d => d.code === 'NS_CONTRACTS_NAME_CLASH' && /"tasks" and "to-dos" would both export Task/.test(d.message)), JSON.stringify(plan.diagnostics))
    assert.ok(plan.diagnostics.some(d => d.code === 'NS_CONTRACTS_ENTITY_UNREADABLE' && /broken/.test(d.message)))
  } finally {
    clean(root)
  }
})

test('publishing: only files the record owns are replaced or deleted, a foreign file stops the run, an unchanged file is not touched', () => {
  const root = temp()
  try {
    const files = [{ path: 'src/index.ts', content: 'export {}\n' }, { path: 'src/entities/a.ts', content: 'export const a = 1\n' }]
    const first = publishContracts({ root, files })
    assert.deepEqual(first.written.sort(), ['src/entities/a.ts', 'src/index.ts'])
    assert.deepEqual(readContractsRecord(root).files, { 'src/entities/a.ts': sha(files[1].content), 'src/index.ts': sha(files[0].content) })
    assert.deepEqual(checkContracts({ root, files }), { ok: true, problems: [] })

    // Nothing changed: nothing is touched
    // Whole seconds: a fractional millisecond does not survive utimes/stat on every filesystem
    const past = new Date(Math.floor((Date.now() - 60_000) / 1000) * 1000)
    for (const path of ['src/index.ts', 'src/entities/a.ts', 'contracts.generation.json']) utimesSync(join(root, path), past, past)
    const second = publishContracts({ root, files })
    assert.deepEqual([second.written, second.deleted, second.unchanged], [[], [], 2])
    for (const path of ['src/index.ts', 'src/entities/a.ts', 'contracts.generation.json']) assert.equal(lstatSync(join(root, path)).mtimeMs, past.getTime(), path)

    // An entity goes away: its generated file is deleted; a file of the user's in src/ stays
    write(root, 'src/mine.ts', 'export const mine = 1\n')
    const third = publishContracts({ root, files: [files[0]] })
    assert.deepEqual(third.deleted, ['src/entities/a.ts'])
    assert.equal(existsSync(join(root, 'src/entities/a.ts')), false)
    assert.equal(readFileSync(join(root, 'src/mine.ts'), 'utf8'), 'export const mine = 1\n')

    // A generated file edited by hand is not overwritten
    write(root, 'src/index.ts', 'export const edited = true\n')
    assert.throws(() => publishContracts({ root, files: [{ path: 'src/index.ts', content: 'export {}\n' }] }), error => error instanceof ContractsPublishError && /src\/index\.ts was edited by hand/.test(error.message))
    assert.equal(readFileSync(join(root, 'src/index.ts'), 'utf8'), 'export const edited = true\n')
    const staleCheck = checkContracts({ root, files: [{ path: 'src/index.ts', content: 'export {}\n' }] })
    assert.deepEqual(staleCheck.problems.map(p => `${p.state} ${p.path}`), ['stale src/index.ts'])

    // A file of the user's at a target path is foreign, and a hand-edited stale file is kept, not deleted
    assert.throws(() => publishContracts({ root, files: [{ path: 'src/index.ts', content: 'export {}\n' }, { path: 'src/mine.ts', content: 'export {}\n' }] }), error => /src\/mine\.ts exists and nextspark prepare did not write it/.test(error.message))
    write(root, 'src/entities/b.ts', 'export const b = 1\n')
    publishContracts({ root, files: [{ path: 'src/index.ts', content: 'export const edited = true\n' }, { path: 'src/entities/b.ts', content: 'export const b = 1\n' }] })
    write(root, 'src/entities/b.ts', 'export const b = "edited"\n')
    const kept = publishContracts({ root, files: [{ path: 'src/index.ts', content: 'export const edited = true\n' }] })
    assert.deepEqual([kept.deleted, kept.kept], [[], ['src/entities/b.ts']])
    assert.ok(existsSync(join(root, 'src/entities/b.ts')))
  } finally {
    clean(root)
  }
})

const sha = content => require('node:crypto').createHash('sha256').update(content).digest('hex')

test('publishing refuses a symlink in the way and a record it cannot trust', () => {
  const root = temp()
  const outside = temp()
  try {
    mkdirSync(join(root, 'src'))
    symlinkSync(outside, join(root, 'src/entities'), 'dir')
    assert.throws(() => publishContracts({ root, files: [{ path: 'src/entities/a.ts', content: 'export {}\n' }] }), /symlink/)
    assert.deepEqual(readdirSync(outside), [])
    write(root, 'contracts.generation.json', '{ nope')
    assert.throws(() => publishContracts({ root, files: [] }), error => error instanceof ContractsPublishError && /not valid JSON/.test(error.message))
    write(root, 'contracts.generation.json', JSON.stringify({ schemaVersion: 1, files: { '../escape.ts': 'x' } }))
    assert.throws(() => readContractsRecord(root), /outside src\//)
  } finally {
    clean(root)
    clean(outside)
  }
})

test('the target: .nextspark/contracts by default, a linked contracts package when it points back at the project', () => {
  const base = temp()
  try {
    const web = join(base, 'web')
    mkdirSync(web)
    assert.deepEqual(resolveContractsTarget(web), { root: join(web, '.nextspark/contracts'), kind: 'default', label: '.nextspark/contracts' })

    // A package that does not name this project is not written
    write(base, 'packages/contracts/package.json', JSON.stringify({ name: '@project/contracts' }))
    assert.equal(resolveContractsTarget(web).kind, 'default')
    write(base, 'packages/contracts/package.json', JSON.stringify({ name: '@project/contracts', nextspark: { contractsProject: '../../other' } }))
    assert.equal(resolveContractsTarget(web).kind, 'default')

    // web+mobile monorepo: packages/contracts beside web/ and mobile/
    write(base, 'packages/contracts/package.json', JSON.stringify({ name: '@project/contracts', nextspark: { contractsProject: '../../web' } }))
    assert.deepEqual(resolveContractsTarget(web), { root: join(base, 'packages/contracts'), kind: 'package', label: '../packages/contracts' })

    // this repository: apps/dev feeds packages/contracts two levels up
    const dev = join(base, 'apps/dev')
    mkdirSync(dev, { recursive: true })
    write(base, 'packages/contracts/package.json', JSON.stringify({ name: '@project/contracts', nextspark: { contractsProject: '../../apps/dev' } }))
    assert.equal(resolveContractsTarget(dev).label, '../../packages/contracts')
    assert.equal(resolveContractsTarget(web).kind, 'default', 'a package fed by another project is not written by this one')

    // a project that carries its own packages/contracts (nextspark add mobile on a flat project)
    write(web, 'packages/contracts/package.json', JSON.stringify({ name: '@project/contracts', nextspark: { contractsProject: '../..' } }))
    assert.equal(resolveContractsTarget(web).label, 'packages/contracts')
  } finally {
    clean(base)
  }
})

test('nextspark prepare: the contracts are published with the host, checked by --check, and a stale or edited module is reported', { timeout: 180_000 }, async () => {
  const root = project()
  try {
    const host = config(root)
    const first = await prepareHost(host, { mode: 'production' })
    assert.equal(first.contracts.label, '.nextspark/contracts')
    assert.equal(first.contracts.written.length, first.contracts.files)
    assert.ok(existsSync(join(root, '.nextspark/contracts/src/entities/tasks.ts')))
    assert.equal(first.contracts.warnings.length, 2, 'unreadable fields are reported, not hidden')
    assert.deepEqual(await checkHost(host), { ok: true, problems: [] })

    // The same sources give the same bytes: a second run writes nothing
    const second = await prepareHost(host, { mode: 'production' })
    assert.deepEqual([second.contracts.written, second.contracts.deleted], [[], []])

    // An entity edit makes the contracts stale for --check, and prepare brings them back
    write(root, 'entities/tasks/tasks.fields.ts', FIELDS.replace("'todo', label: 'To Do' }", "'todo', label: 'To Do' },\n  { value: 'blocked', label: 'Blocked' }"))
    const stale = await checkHost(host)
    assert.ok(stale.problems.some(p => p.state === 'stale' && p.path === '.nextspark/contracts/src/entities/tasks.ts'), JSON.stringify(stale.problems))
    await prepareHost(host, { mode: 'production' })
    assert.match(readFileSync(join(root, '.nextspark/contracts/src/entities/tasks.ts'), 'utf8'), /'todo', 'blocked', 'in-progress', 'done'/)
    assert.deepEqual((await checkHost(host)).problems, [])

    // A hand edit is reported by --check and stops prepare, before anything else is written
    write(root, '.nextspark/contracts/src/index.ts', 'export const edited = true\n')
    assert.ok((await checkHost(host)).problems.some(p => p.path === '.nextspark/contracts/src/index.ts'))
    write(root, 'templates/late/page.tsx', 'export default function Late() { return null }\n')
    await assert.rejects(prepareHost(host, { mode: 'production' }), error => error instanceof PrepareError && /src\/index\.ts was edited by hand/.test(error.message))
    assert.equal(existsSync(join(root, 'src/app/late/page.tsx')), false, 'the host was not published either')
  } finally {
    clean(root)
  }
})

test('a linked packages/contracts receives the module instead of .nextspark/contracts (web + mobile monorepo)', { timeout: 180_000 }, async () => {
  const base = temp()
  try {
    const web = join(base, 'web')
    const project_ = project()
    // Move the project source under web/
    const { cpSync } = await import('node:fs')
    cpSync(project_, web, { recursive: true })
    clean(project_)
    write(base, 'packages/contracts/package.json', JSON.stringify({ name: '@project/contracts', private: true, nextspark: { contractsProject: '../../web' } }))
    const host = config(web)
    const result = await prepareHost(host, { mode: 'production' })
    assert.equal(result.contracts.kind, 'package')
    assert.ok(existsSync(join(base, 'packages/contracts/src/index.ts')))
    assert.ok(existsSync(join(base, 'packages/contracts/contracts.generation.json')))
    assert.equal(existsSync(join(web, '.nextspark/contracts')), false)
    assert.deepEqual((await checkHost(host)).problems, [])
    // The package.json the scaffold owns is never touched
    assert.equal(JSON.parse(readFileSync(join(base, 'packages/contracts/package.json'), 'utf8')).name, '@project/contracts')
  } finally {
    clean(base)
  }
})

test('the CLI script prints the contracts line and warnings, and --check reports the module', { timeout: 180_000 }, () => {
  const root = project()
  try {
    const cli = join(CORE_ROOT, 'scripts/build/registry/host/prepare-cli.mjs')
    const ran = spawnSync(process.execPath, [cli, '--production'], { cwd: root, encoding: 'utf8' })
    assert.equal(ran.status, 0, ran.stdout + ran.stderr)
    assert.match(ran.stdout, /Generated the portable contracts \(\d+ files\) in \.nextspark\/contracts: \d+ written, 0 deleted, 0 unchanged\./)
    assert.match(ran.stdout, /Warning: contracts: notes: field "kind"/)
    const checked = spawnSync(process.execPath, [cli, '--check'], { cwd: root, encoding: 'utf8' })
    assert.equal(checked.status, 0, checked.stdout + checked.stderr)
    assert.match(checked.stdout, /and the portable contracts match/)
    write(root, '.nextspark/contracts/src/envelope.ts', 'export {}\n')
    const stale = spawnSync(process.execPath, [cli, '--check'], { cwd: root, encoding: 'utf8' })
    assert.equal(stale.status, 1)
    assert.match(stale.stderr, /src\/envelope\.ts/)
  } finally {
    clean(root)
  }
})

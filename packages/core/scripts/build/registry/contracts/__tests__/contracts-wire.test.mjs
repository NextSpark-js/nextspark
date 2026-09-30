import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { columnsInSql, readColumnTypes } from '../read-columns.mjs'
import { PORTABLE_FILES, loadResponseShape, readPortableSources } from '../portable.mjs'
import { planContracts } from '../index.mjs'
import { getConfig } from '../../config.mjs'
import { discoverAllEntities } from '../../discovery/all-entities.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'nextspark-contracts-wire-')))

async function planFor(files) {
  const root = temp()
  try {
    write(root, 'nextspark.config.ts', 'export default { plugins: [] }\n')
    write(root, 'package.json', JSON.stringify({ name: 'wire', dependencies: { next: '16.3.5' } }))
    write(root, 'config/theme.config.ts', "export const wireThemeConfig = { name: 'wire' }\n")
    for (const [path, content] of Object.entries(files)) write(root, path, content)
    const entities = await discoverAllEntities(getConfig(root), { includeCore: false })
    return await planContracts({ entities, projectRoot: root, coreRoot: CORE_ROOT })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('the column types come from the entity migrations: CREATE TABLE, ADD COLUMN and ALTER COLUMN TYPE, later files winning', () => {
  const create = `-- a comment with (parens) and CREATE TABLE "other" (x INT);
CREATE TABLE IF NOT EXISTS "items" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "price" NUMERIC(10,2) NOT NULL,
  qty INTEGER,
  "total" BIGINT,
  ratio DOUBLE PRECISION,
  label VARCHAR(80) DEFAULT 'a,b',
  tags JSONB DEFAULT '[]'::jsonb,
  CONSTRAINT items_qty CHECK (qty > 0),
  UNIQUE (label)
);
/* ALTER TABLE "items" ADD COLUMN "ghost" TEXT; */
`
  assert.deepEqual(columnsInSql(create, 'items'), { id: 'TEXT', price: 'NUMERIC(10,2)', qty: 'INTEGER', total: 'BIGINT', ratio: 'DOUBLE PRECISION', label: 'VARCHAR(80)', tags: 'JSONB' })
  const alter = `ALTER TABLE items ADD COLUMN IF NOT EXISTS "weight" DECIMAL(6,3), ADD COLUMN note text;
ALTER TABLE "items" ALTER COLUMN qty SET DATA TYPE BIGINT;
ALTER TABLE other ADD COLUMN nope INT;`
  assert.deepEqual(columnsInSql(alter, 'items'), { weight: 'DECIMAL(6,3)', note: 'text', qty: 'BIGINT' })

  const dir = temp()
  try {
    write(dir, '001_items.sql', create)
    write(dir, '002_alter.sql', alter)
    write(dir, 'notes.txt', 'ALTER TABLE items ADD COLUMN ignored INT;')
    const columns = readColumnTypes('items', [dir, join(dir, 'missing')])
    assert.equal(columns.qty, 'BIGINT', 'a later migration wins')
    assert.equal(columns.price, 'NUMERIC(10,2)')
    assert.equal('ignored' in columns, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the response wire type follows the SQL column: NUMERIC and BIGINT are strings, INT and FLOAT numbers, an undeclared column either', async () => {
  const fields = (...items) => `export const itemFields = [${items.map(([name, type]) => `{ name: '${name}', type: '${type}', required: false, display: { label: '${name}' }, api: {} }`).join(', ')}]\n`
  const config = "import { itemFields } from './items.fields'\nexport const itemEntityConfig = { slug: 'items', names: { singular: 'item' }, fields: itemFields }\n"
  const plan = await planFor({
    'entities/items/items.config.ts': config,
    'entities/items/items.fields.ts': fields(['price', 'number'], ['qty', 'number'], ['total', 'number'], ['ratio', 'number'], ['weight', 'number'], ['undeclared', 'number']),
    'entities/items/migrations/001_items.sql': 'CREATE TABLE items (id TEXT PRIMARY KEY, price NUMERIC(10,2), qty INTEGER, total BIGINT, ratio REAL, "userId" TEXT);\nALTER TABLE items ADD COLUMN weight DECIMAL(6,3);',
  })
  assert.deepEqual(plan.diagnostics, [])
  const items = plan.files.find(file => file.path === 'src/entities/items.ts').content
  const response = items.split('export const itemSchema = z.object({')[1].split('})')[0]
  assert.match(response, /price: z\.string\(\)\.nullish\(\),/)
  assert.match(response, /qty: z\.number\(\)\.nullish\(\),/)
  assert.match(response, /total: z\.string\(\)\.nullish\(\),/)
  assert.match(response, /ratio: z\.number\(\)\.nullish\(\),/)
  assert.match(response, /weight: z\.string\(\)\.nullish\(\),/)
  assert.match(response, /undeclared: z\.union\(\[z\.number\(\), z\.string\(\)\]\)\.nullish\(\),/)
})

test('builder blocks, soft-delete markers and taxonomy fields are in the response exactly as the handlers select them', async () => {
  const plan = await planFor({
    'entities/notes/notes.config.ts': `export const noteEntityConfig = {
  slug: 'notes',
  names: { singular: 'note' },
  builder: { enabled: true },
  table: { softDelete: true },
  taxonomies: { enabled: true, types: [{ type: 'note_tag', field: 'labels', multiple: true }] },
  fields: [{ name: 'title', type: 'text', required: true, display: { label: 'Title' }, api: {} }],
}\n`,
  })
  const notes = plan.files.find(file => file.path === 'src/entities/notes.ts').content
  assert.match(notes, /import \{ builderBlockSchema, childrenResponseSchema, metasResponseSchema, taxonomyTermSchema \} from '\.\.\/schema\/response-shape'/)
  const response = notes.split('export const noteSchema = z.object({')[1].split('})')[0].split('\n').map(line => line.trim()).filter(Boolean)
  assert.deepEqual(response, [
    'id: z.string(),', 'userId: z.string(),', 'teamId: z.string(),', 'createdAt: z.string(),', 'updatedAt: z.string(),',
    'blocks: z.array(builderBlockSchema).nullish(),', 'deletedAt: z.string().nullish(),', 'deletedBy: z.string().nullish(),',
    'title: z.string(),', 'labels: z.array(taxonomyTermSchema),', 'metas: metasResponseSchema.optional(),', 'children: childrenResponseSchema.optional(),',
  ])
  assert.match(notes, /builder: \{ enabled: true \},\n {2}table: \{ softDelete: true \},\n {2}taxonomies: \{ enabled: true, types: \[\{ type: 'note_tag', field: 'labels' \}\] \},/)
  assert.match(notes, /blocks: z\.unknown\(\)\.optional\(\),\n {2}settings: z\.unknown\(\)\.optional\(\),/, 'a builder entity accepts blocks and settings')
})

test('the response columns are the ones core itself computes: the emitter evaluates the shared response-shape', async () => {
  const shape = await loadResponseShape(CORE_ROOT, CORE_ROOT)
  assert.deepEqual(shape.entityResponseSystemColumns({}, { includeSoftDelete: true }), ['id', 'userId', 'teamId', 'createdAt', 'updatedAt'])
  assert.deepEqual(shape.entityResponseSystemColumns({ builder: { enabled: true }, table: { softDelete: true } }, { includeSoftDelete: false }), ['id', 'userId', 'teamId', 'createdAt', 'updatedAt', 'blocks'])
  assert.deepEqual(shape.entityResponseSystemColumns({ builder: { enabled: true }, table: { softDelete: true } }, { includeSoftDelete: true }), ['id', 'userId', 'teamId', 'createdAt', 'updatedAt', 'blocks', 'deletedAt', 'deletedBy'])
  assert.deepEqual(shape.taxonomyResponseFields({ taxonomies: { enabled: true, types: [{ type: 'a', field: 'x' }, { type: 'b', field: 'y' }] } }), ['x', 'y'])
  assert.deepEqual(shape.taxonomyResponseFields({ taxonomies: { enabled: false, types: [{ type: 'a', field: 'x' }] } }), [])
  assert.deepEqual(['NUMERIC(5,2)', 'decimal', 'BIGINT', 'money', 'INTEGER', 'serial', 'REAL', 'DOUBLE PRECISION', 'boolean', 'TIMESTAMP', 'DATE', 'JSONB', 'geometry'].map(type => shape.pgWireKind(type)), ['string', 'string', 'string', 'string', 'number', 'number', 'number', 'number', 'boolean', 'string', 'string', 'unknown', null])

  // The handler uses the very same functions (a source check: the handler no longer computes the columns itself)
  const handler = readFileSync(join(CORE_ROOT, 'src/lib/api/entity/generic-handler.ts'), 'utf8')
  assert.equal((handler.match(/entityResponseSystemColumns\(/g) ?? []).length, 3, 'list, create and read select the columns from the shared description')
  assert.doesNotMatch(handler, /const systemFields = \['id'/)
  assert.match(handler, /taxonomyResponseFields\(entityConfig\)/)
})

test('the portable sources are copied verbatim into the module, and only zod and siblings are imported', () => {
  const sources = readPortableSources(CORE_ROOT)
  assert.deepEqual(sources.map(file => file.path), PORTABLE_FILES.map(name => `src/schema/${name}.ts`))
  for (const file of sources) {
    const original = readFileSync(join(CORE_ROOT, 'src/lib/entities/portable', file.path.split('/').pop()), 'utf8')
    assert.equal(file.content, original)
    for (const match of file.content.matchAll(/^\s*(?:import|export)\s[^'"\n]*from\s+['"]([^'"]+)['"]/gm)) assert.ok(match[1] === 'zod' || /^\.\/[\w-]+$/.test(match[1]), `${file.path} imports ${match[1]}`)
  }
  assert.throws(() => readPortableSources(join(tmpdir(), 'no-such-core')), /does not ship src\/lib\/entities\/portable/)
})

test('a core without the portable sources is a diagnostic, not a crash', async () => {
  const root = temp()
  try {
    write(root, 'package.json', '{"name":"old-core"}')
    const plan = await planContracts({ entities: [], projectRoot: CORE_ROOT, coreRoot: root })
    assert.deepEqual(plan.files, [])
    assert.equal(plan.diagnostics[0].code, 'NS_CONTRACTS_NO_PORTABLE_SOURCES')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a default value or a field type that is not a literal is warned about, not guessed', async () => {
  const plan = await planFor({
    'entities/things/things.config.ts': `const TYPE = 'text'
export const thingEntityConfig = {
  slug: 'things',
  names: { singular: 'thing' },
  fields: [
    { name: 'a', type: 'text', required: false, defaultValue: computeDefault(), display: { label: 'A' }, api: {} },
    { name: 'b', type: typeFromElsewhere, required: false, display: { label: 'B' }, api: {} },
  ],
}\n`,
  })
  const things = plan.files.find(file => file.path === 'src/entities/things.ts').content
  assert.match(things, /^\/\/ Warning: field "a": `defaultValue` is not a literal, so the contract does not apply it$/m)
  assert.match(things, /^\/\/ Warning: field "b": its `type` is not a literal, so it was left out of the contract$/m)
  assert.doesNotMatch(things, /name: 'b'/)
  assert.doesNotMatch(things, /defaultValue: /)
})

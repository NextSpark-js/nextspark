/**
 * Response parity: the generated portable contracts (packages/contracts) describe what the REAL generic
 * handlers return. Each case runs the real handler (list, read, create; DB mocked) on a real entity config of
 * apps/dev and checks
 *   1. the columns the handler SELECTs are exactly the response columns of the contract (nothing the API returns
 *      is missing from the DTO, nothing the DTO promises is never selected),
 *   2. the response the handler sends parses through the contract's envelope + entity schema without losing a key
 *      (zod strips what it does not know, so a dropped key shows as a difference),
 * with rows shaped as the pg driver delivers them (NUMERIC as a string).
 */

import { harness, makeRequest, SESSION_AUTH } from './__helpers__/generic-handler-harness'
import { handleGenericList, handleGenericRead, handleGenericCreate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'
import { customerEntityConfig } from '../../../../../../apps/dev/entities/customers/customers.config'
import { pagesEntityConfig } from '../../../../../../apps/dev/entities/pages/pages.config'
import { postsEntityConfig } from '../../../../../../apps/dev/entities/posts/posts.config'
import { taskEntityConfig } from '../../../../../../apps/dev/entities/tasks/tasks.config'
import {
  apiListResponseSchema, apiSuccessResponseSchema,
  customerSchema, pageSchema, postSchema, taskSchema,
} from '../../../../../contracts/src'

const { mocks } = harness

interface Shape { shape: Record<string, unknown>; safeParse(data: unknown): { success: boolean; data?: unknown; error?: unknown } }

const HEADERS = { 'x-team-id': 'team-1' }
const TIMESTAMP = '2026-01-01T00:00:00.000Z'

/** A value as the driver delivers it for a column of this field. */
function wireValue(field: { name: string; type: string; options?: Array<{ value: string | number }> }): unknown {
  if (field.name === 'estimatedHours') return '8.50' // NUMERIC(5,2): the pg driver returns a string
  switch (field.type) {
    case 'select': case 'radio': return field.options?.[0]?.value ?? 'x'
    case 'multiselect': return [field.options?.[0]?.value ?? 'x']
    case 'boolean': return false
    case 'tags': return ['a']
    case 'number': return 12
    case 'date': case 'datetime': return TIMESTAMP
    case 'image': return 'https://example.com/a.png'
    default: return 'text'
  }
}

const TAXONOMY_TERMS = [{ id: 'term-1', name: 'News', slug: 'news', color: null, icon: null, type: 'post_category', order: 0, entityId: 'row-1' }]

const CASES: Array<{ name: string; config: EntityConfig; schema: Shape; taxonomies: string[] }> = [
  { name: 'tasks', config: taskEntityConfig, schema: taskSchema as unknown as Shape, taxonomies: [] },
  { name: 'customers (shared)', config: customerEntityConfig, schema: customerSchema as unknown as Shape, taxonomies: [] },
  { name: 'pages (builder)', config: pagesEntityConfig, schema: pageSchema as unknown as Shape, taxonomies: [] },
  { name: 'posts (builder + taxonomies)', config: postsEntityConfig, schema: postSchema as unknown as Shape, taxonomies: ['categories'] },
]

const EXPANSIONS = ['metas', 'children']

function selectedColumns(sql: string, table: string): string[] {
  const match = sql.match(new RegExp(`SELECT\\s+([\\s\\S]*?)(?:,\\s*COUNT\\(\\*\\) OVER\\(\\))?\\s+FROM\\s+"${table}"\\s+t`))
  if (!match) throw new Error(`no SELECT from "${table}" in: ${sql}`)
  return [...match[1].matchAll(/t\.(?:"([^"]+)"|(\w+))/g)].map(column => column[1] ?? column[2])
}

function rowFor(config: EntityConfig, columns: string[]): Record<string, unknown> {
  const fields = new Map(config.fields.map(field => [field.name, field]))
  const system: Record<string, unknown> = { id: 'row-1', userId: 'user-1', teamId: 'team-1', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, blocks: [{ id: 'b1', blockSlug: 'hero', props: {} }], deletedAt: null, deletedBy: null }
  const row: Record<string, unknown> = {}
  for (const column of columns) {
    if (fields.has(column)) row[column] = wireValue(fields.get(column) as never)
    else if (column in system) row[column] = system[column]
    else throw new Error(`the handler selects "${column}", which no test value exists for`)
  }
  return row
}

/** The DB behaves: the entity table answers with a row of the selected columns, taxonomy joins with terms. */
function database(config: EntityConfig, seen: { columns: string[] }) {
  mocks.queryWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('entity_taxonomy_relations')) return TAXONOMY_TERMS
    if (sql.includes(`FROM "${config.slug}" t`)) {
      seen.columns = selectedColumns(sql, config.slug)
      // only the list query carries the window count the handler strips again
      return [{ ...rowFor(config, seen.columns), ...(sql.includes('COUNT(*) OVER()') ? { total_count: 1 } : {}) }]
    }
    return []
  })
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'row-1' }] })
}

function expectedColumns(schema: Shape, taxonomies: string[]): string[] {
  return Object.keys(schema.shape).filter(key => !EXPANSIONS.includes(key) && !taxonomies.includes(key)).sort()
}

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
})

describe.each(CASES)('the contract of $name is what the real handlers return', ({ config, schema, taxonomies }) => {
  const useEntity = () => mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: config, entityName: config.slug, hasCustomOverride: false })
  const idParams = { params: Promise.resolve({ entity: config.slug, id: 'row-1' }) }

  it('list: the SELECT lists the contract columns, and the response parses without losing a key', async () => {
    useEntity()
    const seen = { columns: [] as string[] }
    database(config, seen)

    const response = await handleGenericList(makeRequest({ url: `http://localhost/api/v1/${config.slug}`, headers: HEADERS })) as unknown as { status: number; body: { data: Array<Record<string, unknown>> } }

    expect(response.status).toBe(200)
    expect([...seen.columns].sort()).toEqual(expectedColumns(schema, taxonomies))
    const parsed = apiListResponseSchema(schema as never).safeParse(response.body)
    expect(parsed.success).toBe(true)
    const [sent] = response.body.data
    const [kept] = (parsed as unknown as { data: { data: Array<Record<string, unknown>> } }).data.data
    expect(Object.keys(kept).sort()).toEqual(Object.keys(sent).sort())
    for (const field of taxonomies) expect(sent[field]).toEqual([expect.objectContaining({ id: 'term-1', slug: 'news' })])
  })

  it('read: the SELECT lists the contract columns, and the response parses without losing a key', async () => {
    useEntity()
    const seen = { columns: [] as string[] }
    database(config, seen)

    const response = await handleGenericRead(makeRequest({ url: `http://localhost/api/v1/${config.slug}/row-1`, headers: HEADERS }), idParams) as unknown as { status: number; body: { data: Record<string, unknown> } }

    expect(response.status).toBe(200)
    expect([...seen.columns].sort()).toEqual(expectedColumns(schema, taxonomies))
    const parsed = apiSuccessResponseSchema(schema as never).safeParse(response.body)
    expect(parsed.success).toBe(true)
    expect(Object.keys((parsed as unknown as { data: { data: Record<string, unknown> } }).data.data).sort()).toEqual(Object.keys(response.body.data).sort())
  })

  it('create: the row it returns parses through the contract without losing a key', async () => {
    useEntity()
    const seen = { columns: [] as string[] }
    database(config, seen)
    const required = config.fields.filter(field => field.required && !field.api?.readOnly)
    const body = Object.fromEntries(required.map(field => [field.name, wireValue(field as never)]))

    const response = await handleGenericCreate(makeRequest({ method: 'POST', url: `http://localhost/api/v1/${config.slug}`, headers: HEADERS, body })) as unknown as { status: number; body: { data: Record<string, unknown> } }

    expect(response.status).toBe(201)
    expect([...seen.columns].sort()).toEqual(expectedColumns(schema, taxonomies))
    const parsed = apiSuccessResponseSchema(schema as never).safeParse(response.body)
    expect(parsed.success).toBe(true)
    expect(Object.keys((parsed as unknown as { data: { data: Record<string, unknown> } }).data.data).sort()).toEqual(Object.keys(response.body.data).sort())
  })
})

describe('the review\'s response cases', () => {
  it('userId stays on a shared entity, blocks on a builder entity, categories on posts; NUMERIC arrives as a string', () => {
    expect(Object.keys(customerSchema.shape)).toContain('userId')
    expect(Object.keys(pageSchema.shape)).toContain('blocks')
    expect(Object.keys(postSchema.shape)).toEqual(expect.arrayContaining(['blocks', 'categories']))
    const row = { id: '1', title: 't', status: 'todo', priority: 'low', completed: false, estimatedHours: '8.50', teamId: 't', userId: 'u', createdAt: 'a', updatedAt: 'b' }
    expect(taskSchema.safeParse(row).success).toBe(true)
    expect(taskSchema.safeParse({ ...row, estimatedHours: 8.5 }).success).toBe(false)
  })
})

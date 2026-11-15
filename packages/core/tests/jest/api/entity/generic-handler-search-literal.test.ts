/**
 * #463: the generic list handler sorts empty values last in both directions and searches the term literally.
 * `%` and `_` in `?search=` were wildcards (`50%`, `first_name` matched other rows, a lone `%` matched every row of the
 * team), and a descending sort put NULLs first. The first block checks the SQL the handler builds; the second runs
 * that SQL on a throwaway PostgreSQL (skipped without initdb and pg_ctl).
 */

import { Client } from 'pg'
import { harness, makeRequest, listUrl, SESSION_AUTH } from './__helpers__/generic-handler-harness'
import { handleGenericList } from '@/core/lib/api/entity/generic-handler'
import { MAX_SEARCH_TERM_LENGTH, escapeLikeTerm } from '@/core/lib/utils/like-pattern'
import { HAS_POSTGRES, startCluster, type ThrowawayCluster } from '../../../support/throwaway-postgres'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

type Res = { status: number; body: { code?: string; data?: Array<Record<string, unknown>>; details?: { maxLength?: number } } }
const TEAM_HEADERS = { 'x-team-id': 'team-1' }
const field = (name: string, type: string) => ({ name, type, api: { readOnly: false } }) as never

const CONTACTS = {
  slug: 'contacts',
  tableName: 'contacts',
  access: { api: true },
  fields: [field('slug', 'text'), field('callName', 'text'), field('email', 'email'), field('joinedAt', 'datetime')],
} as unknown as EntityConfig

const list = (params: Record<string, string>) =>
  handleGenericList(makeRequest({ url: listUrl(params, 'contacts'), headers: TEAM_HEADERS })) as unknown as Promise<Res>
const listSql = (): [string, unknown[]] => {
  const call = mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "contacts"'))
  expect(call).toBeDefined()
  return call as [string, unknown[]]
}

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: CONTACTS, entityName: 'contacts' })
})

describe('escapeLikeTerm', () => {
  it('escapes the backslash, % and _ and leaves the rest', () => {
    expect(escapeLikeTerm('50%')).toBe('50\\%')
    expect(escapeLikeTerm('first_name')).toBe('first\\_name')
    expect(escapeLikeTerm('a\\b')).toBe('a\\\\b')
    expect(escapeLikeTerm('plain')).toBe('plain')
  })
})

describe('handleGenericList — sort and search SQL (#463)', () => {
  it.each([
    ['desc', 'DESC'],
    ['asc', 'ASC'],
  ])('sorts %s with NULLS LAST', async (order, sql) => {
    await list({ sortBy: 'joinedAt', sortOrder: order })

    expect(listSql()[0]).toContain(`ORDER BY t."joinedAt" ${sql} NULLS LAST`)
  })

  it('escapes % and _ and the backslash in the bound term and writes ESCAPE after every ILIKE, one field and several', async () => {
    for (const searchField of [undefined, 'callName', 'callName,email']) {
      mocks.queryWithRLS.mockClear()
      await list({ search: '50%_a\\b', ...(searchField ? { searchField } : {}) })

      const [sql, params] = listSql()
      const ilikes = sql.match(/ILIKE \$\d+/g) ?? []
      expect(ilikes.length).toBeGreaterThan(0)
      expect(sql.match(/ILIKE \$\d+ ESCAPE '\\'/g)).toHaveLength(ilikes.length)
      expect(params).toContain('%50\\%\\_a\\\\b%')
      expect(params).not.toContain('%50%_a\\b%')
    }
  })

  it(`accepts a term of ${MAX_SEARCH_TERM_LENGTH} characters and refuses a longer one with 400 SEARCH_TERM_TOO_LONG, never querying`, async () => {
    expect((await list({ search: 'a'.repeat(MAX_SEARCH_TERM_LENGTH) })).status).toBe(200)

    mocks.queryWithRLS.mockClear()
    const response = await list({ search: 'a'.repeat(MAX_SEARCH_TERM_LENGTH + 1) })
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('SEARCH_TERM_TOO_LONG')
    expect(response.body.details?.maxLength).toBe(MAX_SEARCH_TERM_LENGTH)
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })
})

const describeWithPostgres = HAS_POSTGRES ? describe : describe.skip

describeWithPostgres('handleGenericList — on PostgreSQL (#463)', () => {
  let cluster: ThrowawayCluster
  let db: Client

  beforeAll(async () => {
    cluster = await startCluster('search-literal-pg')
    db = new Client({ connectionString: `postgresql://owner@127.0.0.1:${cluster.port}/postgres?sslmode=disable` })
    db.on('error', () => {}) // the cluster stops under it at the end
    await db.connect()
    await db.query(`CREATE TABLE contacts (
      id serial PRIMARY KEY, "teamId" text, "userId" text, slug text, "callName" text, email text,
      "joinedAt" timestamptz, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now())`)
    const rows: Array<[string, string, string | null]> = [
      ['team-1', '50% off', '2026-01-01'],
      ['team-1', '500 units', '2026-02-01'],
      ['team-1', 'first_name', '2026-03-01'],
      ['team-1', 'firstXname', null],
      ['team-1', 'back\\slash', null],
      ['team-1', 'plain', '2026-04-01'],
      ['team-1', 'no date', null],
      ['team-2', '50% elsewhere', '2026-05-01'],
    ]
    for (const [team, name, joined] of rows) {
      await db.query(`INSERT INTO contacts ("teamId", "userId", "callName", email, "joinedAt") VALUES ($1, 'session-user-1', $2, 'x@test.dev', $3)`, [team, name, joined])
    }
  }, 120000)

  afterAll(async () => {
    await db?.end().catch(() => {})
    await cluster?.stop()
  })

  beforeEach(() => {
    const fallback = mocks.queryWithRLS.getMockImplementation()
    mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[], ...rest: unknown[]) =>
      sql.includes('FROM "contacts"') ? (await db.query(sql, params)).rows : fallback?.(sql, params, ...rest))
  })

  const names = (response: Res) => (response.body.data ?? []).map(row => row.callName)

  it('descending puts the rows without a date last, newest first; ascending keeps them last', async () => {
    const desc = names(await list({ sortBy: 'joinedAt', sortOrder: 'desc' }))
    expect(desc.slice(0, 4)).toEqual(['plain', 'first_name', '500 units', '50% off'])
    expect(new Set(desc.slice(4))).toEqual(new Set(['firstXname', 'back\\slash', 'no date']))

    const asc = names(await list({ sortBy: 'joinedAt', sortOrder: 'asc' }))
    expect(asc.slice(0, 4)).toEqual(['50% off', '500 units', 'first_name', 'plain'])
    expect(new Set(asc.slice(4))).toEqual(new Set(['firstXname', 'back\\slash', 'no date']))
  })

  it.each([
    ['50%', ['50% off']],
    ['first_name', ['first_name']],
    ['%', ['50% off']],
    ['_', ['first_name']],
    ['\\', ['back\\slash']],
    ['k\\s', ['back\\slash']],
    ['FIRST_NAME', ['first_name']],
  ])('?search=%s matches only the rows that contain it literally', async (search, expected) => {
    const response = await list({ search, searchField: 'callName' })

    expect(response.status).toBe(200)
    expect(names(response).sort()).toEqual(expected)
  })

  it('searches several fields literally too', async () => {
    // every row's email is x@test.dev: the unescaped `_` would match its `v`, the literal one matches nothing
    expect(names(await list({ search: 'x@test.de_', searchField: 'callName,email' }))).toEqual([])
    expect(names(await list({ search: 'x@test.dev', searchField: 'callName,email' }))).toHaveLength(7)
    expect(names(await list({ search: '50%', searchField: 'callName,email' })).sort()).toEqual(['50% off'])
  })
})

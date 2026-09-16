/**
 * PATCH /api/user/profile (apps/dev) saves a preference group without erasing
 * the keys it does not carry (#194).
 *
 * The theme toggle sends `{ meta: { uiPreferences: { theme } } }` and the
 * sidebar sends `{ meta: { uiPreferences: { sidebarCollapsed } } }`: each
 * request carries one key of a group that holds both. Writing the group as it
 * arrives drops the other key, so saving the theme reset the sidebar and the
 * sidebar reset the theme.
 *
 * The route runs with the real MetaService; only the database, the rate limiter
 * and the session are mocked. The database mock applies to its stored value
 * what the query it receives asks for — a jsonb merge or a plain replace — so
 * the assertions are about what the user gets back. It reads that from the
 * expression the upsert assigns to "metaValue": whether it reads the stored
 * column at all, and in which order it and the incoming value are joined. An
 * equivalent rewrite of the same SQL lands on the same answer; taking the
 * merge out lands on the other one.
 *
 * apps/dev/app is the source of the app/ a project is generated with
 * (packages/core/templates/app, written at pack time), so this covers the
 * route the template ships.
 */
import { NextRequest } from 'next/server'

const mockMutateWithRLS = jest.fn()
const mockGetSession = jest.fn()

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryOne: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
}))
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))
jest.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

import { PATCH } from '@/app/api/user/profile/route'

const USER_ID = 'test-user-123'

/** What `users_metas` holds, keyed by meta key. */
let stored: Record<string, Record<string, unknown>>

/** The expression an upsert's ON CONFLICT clause assigns to "metaValue". */
function assignedMetaValue(query: string): string {
  const clause = query.split(/DO\s+UPDATE\s+SET/i)[1] ?? ''
  const assignment = clause.match(/"metaValue"\s*=\s*([\s\S]*?)(?=,\s*"\w+"\s*=|\bWHERE\b|\bRETURNING\b|$)/i)
  return assignment?.[1] ?? ''
}

/**
 * What that expression does to the row that is already there: keep it and lay
 * the incoming keys over it, keep it and let it win, or write the incoming
 * value over it. A `||` between the stored column and EXCLUDED is a merge, and
 * its right-hand side is the side that wins.
 */
function conflictBehaviour(query: string): 'merge-incoming' | 'merge-stored' | 'replace' {
  const expression = assignedMetaValue(query)
  // Quoting an identifier is optional in Postgres and changes nothing
  const storedColumn = /"?users_metas"?\s*\.\s*"?metaValue"?/
  if (!storedColumn.test(expression)) return 'replace'
  const join = expression.match(/([\w".\s]+)\|\|([\w".\s]+)/)
  return join && storedColumn.test(join[2]) ? 'merge-stored' : 'merge-incoming'
}

/**
 * The write as Postgres runs it: the meta upsert does to the stored value what
 * its ON CONFLICT clause says, and the profile UPDATE answers with the row.
 */
function applyWrite(query: string, params: unknown[]) {
  if (/UPDATE "users"/.test(query)) return { rows: [{ id: USER_ID }], rowCount: 1 }

  const [, metaKey, jsonString] = params as [string, string, string]
  const incoming = JSON.parse(jsonString) as Record<string, unknown>
  const current = stored[metaKey]

  if (!current) stored[metaKey] = incoming
  else if (conflictBehaviour(query) === 'merge-incoming') stored[metaKey] = { ...current, ...incoming }
  else if (conflictBehaviour(query) === 'merge-stored') stored[metaKey] = { ...incoming, ...current }
  else stored[metaKey] = incoming

  return { rows: [], rowCount: 1 }
}

function patchProfile(body: unknown) {
  return PATCH(new NextRequest('http://localhost:3000/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  stored = { uiPreferences: { theme: 'light', sidebarCollapsed: true } }
  mockMutateWithRLS.mockReset().mockImplementation((query: string, params: unknown[]) => applyWrite(query, params))
  mockGetSession.mockReset().mockResolvedValue({ user: { id: USER_ID } })
})

describe('PATCH /api/user/profile — preference groups', () => {
  test('saving the theme keeps the sidebar state', async () => {
    const response = await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test('saving the sidebar state keeps the theme', async () => {
    const response = await patchProfile({ meta: { uiPreferences: { sidebarCollapsed: false } } })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'light', sidebarCollapsed: false })
  })

  test('a profile update that also carries meta keeps the rest of the group', async () => {
    const response = await patchProfile({
      firstName: 'Ada',
      lastName: 'Lovelace',
      country: 'AR',
      timezone: 'America/Argentina/Buenos_Aires',
      language: 'en',
      meta: { uiPreferences: { theme: 'dark' } },
    })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'dark', sidebarCollapsed: true })
    // The profile UPDATE and the meta write, in that order
    expect(mockMutateWithRLS.mock.calls[0][0]).toMatch(/UPDATE "users"/)
    expect(mockMutateWithRLS.mock.calls).toHaveLength(2)
  })

  test('writes the group for the signed-in user under their own RLS context', async () => {
    await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    const [, params, rlsUserId] = mockMutateWithRLS.mock.calls[0]
    expect(params[0]).toBe(USER_ID)
    expect(params[1]).toBe('uiPreferences')
    expect(rlsUserId).toBe(USER_ID)
  })

  test('leaves the groups the request does not carry alone', async () => {
    stored.notificationsPreferences = { pushEnabled: true }

    await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    expect(stored.notificationsPreferences).toEqual({ pushEnabled: true })
  })
})

/**
 * The double above stands in for Postgres, so it has to answer the way Postgres
 * would: by what the clause does, not by how it is spelled. Rewriting the same
 * merge — different whitespace, the operands the other way round, the table
 * name written without its quotes — must not turn a merge into a replace, or
 * the tests above would go green on a route that had stopped merging.
 */
describe('the database double reads the conflict clause, not its wording', () => {
  const MERGE = `
    INSERT INTO "users_metas" ("userId", "metaKey", "metaValue")
    VALUES ($1, $2, $3)
    ON CONFLICT ("userId", "metaKey")
    DO UPDATE SET
      "metaValue" = CASE
        WHEN jsonb_typeof("users_metas"."metaValue") = 'object' AND jsonb_typeof(EXCLUDED."metaValue") = 'object'
        THEN "users_metas"."metaValue" || EXCLUDED."metaValue"
        ELSE EXCLUDED."metaValue"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
  `

  const write = (query: string) => {
    stored = { uiPreferences: { theme: 'light', sidebarCollapsed: true } }
    applyWrite(query, [USER_ID, 'uiPreferences', JSON.stringify({ theme: 'dark' })])
    return stored.uiPreferences
  }

  test('the merge the route writes keeps the key the request does not carry', () => {
    expect(write(MERGE)).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test.each([
    ['broken across lines', MERGE.replace(/\|\|/g, '\n          ||')],
    ['squeezed onto one line', MERGE.replace(/\s+/g, ' ')],
    ['the table name unquoted', MERGE.replace(/"users_metas"\./g, 'users_metas.')],
  ])('a merge %s still merges', (_label, query) => {
    expect(write(query)).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test('with the stored value winning, the key the request carries does not', () => {
    const storedWins = MERGE.replace(
      'THEN "users_metas"."metaValue" || EXCLUDED."metaValue"',
      'THEN EXCLUDED."metaValue" || "users_metas"."metaValue"'
    )

    expect(write(storedWins)).toEqual({ theme: 'light', sidebarCollapsed: true })
  })

  test('a clause that only writes the incoming value replaces the group', () => {
    const replace = MERGE.replace(/"metaValue" = CASE[\s\S]*?END,/, '"metaValue" = EXCLUDED."metaValue",')

    expect(write(replace)).toEqual({ theme: 'dark' })
  })
})

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { logRlsBypassAtStartup, rlsRuntimeVerdict, type RlsRuntimeRow } from '@/core/lib/rls-runtime'

const row = (over: Partial<RlsRuntimeRow> = {}): RlsRuntimeRow =>
  ({ role: 'app', superuser: false, bypassRls: false, ownedTables: 0, rlsTables: 20, ...over })
const env = { NODE_ENV: 'production', DATABASE_URL: 'postgres://u@h/db' } as NodeJS.ProcessEnv
const reset = () => delete (globalThis as Record<symbol, unknown>)[Symbol.for('nextspark.rlsBypassWarned')]

describe('rlsRuntimeVerdict', () => {
  test.each([
    ['a plain role', row(), 'enforced'],
    ['a superuser', row({ superuser: true }), 'bypassed'],
    ['BYPASSRLS', row({ bypassRls: true }), 'bypassed'],
    ['the owner of RLS tables', row({ ownedTables: 3 }), 'bypassed'],
    ['no RLS table yet', row({ rlsTables: 0 }), 'unknown'],
  ])('%s', (_name, input, expected) => expect(rlsRuntimeVerdict(input)).toBe(expected))
})

describe('logRlsBypassAtStartup', () => {
  let warn: jest.SpiedFunction<typeof console.warn>
  beforeEach(() => {
    reset()
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    jest.restoreAllMocks()
    reset()
  })

  const returning = (r?: RlsRuntimeRow) => jest.fn(async (_sql: string) => ({ rows: r ? [r] : [] }))

  test('warns once per process when the role skips RLS, naming the role and why', async () => {
    const run = returning(row({ role: 'owner', ownedTables: 4 }))
    await logRlsBypassAtStartup(run, env)
    await logRlsBypassAtStartup(run, env)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('(owner) owns 4 of the tables')
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('is silent when RLS applies and DATABASE_SERVICE_URL is set, when no table has RLS and when the role is not found', async () => {
    for (const r of [row(), row({ rlsTables: 0 }), undefined]) {
      reset()
      await logRlsBypassAtStartup(returning(r), { ...env, DATABASE_SERVICE_URL: 'postgres://owner:secret@h/db' })
    }
    reset()
    await logRlsBypassAtStartup(returning(row({ rlsTables: 0 })), env)
    await logRlsBypassAtStartup(returning(undefined), env)
    expect(warn).not.toHaveBeenCalled()
  })

  // #492: the app role is subject to RLS and the auth lookups have no service connection
  test('warns once, naming DATABASE_SERVICE_URL and the docs and never a URL, when RLS applies and DATABASE_SERVICE_URL is not set', async () => {
    const run = returning(row({ role: 'nextspark_app' }))
    const withPassword = { ...env, DATABASE_URL: 'postgres://nextspark_app:s3cret@h/db' }
    await logRlsBypassAtStartup(run, withPassword)
    await logRlsBypassAtStartup(run, withPassword)
    expect(warn).toHaveBeenCalledTimes(1)
    const text = String(warn.mock.calls[0][0])
    expect(text).toContain('DATABASE_SERVICE_URL is not set')
    expect(text).toContain('docs/10-backend/03-rls-policies.md')
    expect(text).not.toMatch(/s3cret|postgres:\/\//)
    expect(run).toHaveBeenCalledTimes(1)
  })

  test.each([['empty', ''], ['blank', '  ']])('a %s DATABASE_SERVICE_URL counts as not set', async (_name, value) => {
    await logRlsBypassAtStartup(returning(row()), { ...env, DATABASE_SERVICE_URL: value })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('a role that skips RLS gets the bypass warning only, with or without DATABASE_SERVICE_URL', async () => {
    await logRlsBypassAtStartup(returning(row({ ownedTables: 2 })), env)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('is not applied')
    reset()
    warn.mockClear()
    await logRlsBypassAtStartup(returning(row({ superuser: true })), { ...env, DATABASE_SERVICE_URL: 'postgres://o@h/db' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('is silent, and does not throw, when the query fails (no database, no access to the catalogs)', async () => {
    const failing = jest.fn(async (_sql: string): Promise<{ rows: RlsRuntimeRow[] }> => { throw new Error('permission denied') })
    await expect(logRlsBypassAtStartup(failing, env)).resolves.toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  })

  test.each([
    ['outside production', { ...env, NODE_ENV: 'development' }],
    ['during the production build', { ...env, NEXT_PHASE: 'phase-production-build' }],
    ['without DATABASE_URL', { NODE_ENV: 'production' }],
  ])('does not query %s', async (_name, e) => {
    const run = returning(row({ superuser: true }))
    await logRlsBypassAtStartup(run, e as NodeJS.ProcessEnv)
    expect(run).not.toHaveBeenCalled()
  })
})

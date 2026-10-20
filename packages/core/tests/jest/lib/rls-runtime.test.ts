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

  test('is silent when RLS applies, when no table has RLS and when the role is not found', async () => {
    for (const r of [row(), row({ rlsTables: 0 }), undefined]) {
      reset()
      await logRlsBypassAtStartup(returning(r), env)
    }
    expect(warn).not.toHaveBeenCalled()
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

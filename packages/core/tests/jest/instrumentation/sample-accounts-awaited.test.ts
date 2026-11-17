/**
 * register() waits for the sample-password check (#480)
 *
 * Next.js serves nothing until register() resolves. A check started without being awaited could still be querying
 * when the first response went out, and a serverless instance frozen after it cut the query. register() now waits
 * for it, up to SAMPLE_ACCOUNTS_CHECK_WAIT_MS, so a database that does not answer never holds the start longer.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockWarnSampleAccounts = jest.fn<() => Promise<void>>()
jest.mock('@/core/lib/auth/sample-accounts', () => ({
  warnSampleAccountsAtStartup: () => mockWarnSampleAccounts(),
}))
jest.mock('@/core/lib/config/config-sync', () => ({ APP_CONFIG_MERGED: {} }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: jest.fn(),
  initializeRecurringActions: jest.fn(async () => {}),
}))

const env = process.env as Record<string, string | undefined>
const savedRuntime = env.NEXT_RUNTIME

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}

const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0)) }

describe('register() and the sample-password check (#480)', () => {
  beforeEach(() => {
    jest.resetModules()
    env.NEXT_RUNTIME = 'nodejs'
    mockWarnSampleAccounts.mockReset()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    if (savedRuntime === undefined) delete env.NEXT_RUNTIME
    else env.NEXT_RUNTIME = savedRuntime
  })

  test('register() resolves only once the check has ended', async () => {
    const check = deferred()
    mockWarnSampleAccounts.mockReturnValue(check.promise)
    const { register } = await import('@/core/instrumentation')

    let registered = false
    const running = register().then(() => { registered = true })
    await flush()
    expect(mockWarnSampleAccounts).toHaveBeenCalledTimes(1)
    expect(registered).toBe(false)

    check.resolve()
    await running
    expect(registered).toBe(true)
  })

  test('a check that does not end holds the start for SAMPLE_ACCOUNTS_CHECK_WAIT_MS at most', async () => {
    mockWarnSampleAccounts.mockReturnValue(new Promise<void>(() => {}))
    const { logAuthReadinessAtStartup, SAMPLE_ACCOUNTS_CHECK_WAIT_MS } = await import('@/core/lib/auth/runtime-readiness')
    jest.useFakeTimers()

    let done = false
    const running = logAuthReadinessAtStartup({ env: { NODE_ENV: 'production' } }).then(() => { done = true })
    await jest.advanceTimersByTimeAsync(SAMPLE_ACCOUNTS_CHECK_WAIT_MS - 1)
    expect(done).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    await running
    expect(done).toBe(true)
  })
})

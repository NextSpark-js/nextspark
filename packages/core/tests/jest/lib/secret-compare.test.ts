/**
 * secretsMatch and the two cron endpoints that use it: a wrong value is still rejected, the right one is accepted,
 * and the comparison always runs over two SHA-256 digests (equal-length buffers, whatever the input lengths).
 */
import { NextRequest } from 'next/server'

const timingSafeEqual = jest.fn()
jest.mock('node:crypto', () => {
  const actual = jest.requireActual('node:crypto')
  timingSafeEqual.mockImplementation(actual.timingSafeEqual)
  return { ...actual, timingSafeEqual: (...args: unknown[]) => timingSafeEqual(...args) }
})

jest.mock('@nextsparkjs/core/lib/scheduled-actions', () => ({
  processPendingActions: jest.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0, errors: [] }),
  cleanupOldActions: jest.fn().mockResolvedValue(0),
}))
jest.mock('@nextsparkjs/core/lib/billing/jobs', () => ({ handlePastDueGracePeriod: jest.fn().mockResolvedValue({ processed: 0, errors: [] }) }))
jest.mock('@nextsparkjs/core/lib/services', () => ({
  SubscriptionService: { processExpiredTrials: jest.fn().mockResolvedValue(0) },
  UsageService: { processMonthlyReset: jest.fn().mockResolvedValue(0) },
}))

import { secretsMatch } from '../../../src/lib/security/secret-compare'
import { GET as cronProcess } from '../../../src/routes/api/v1/cron/process/route'
import { GET as billingLifecycle } from '../../../src/routes/api/cron/billing/lifecycle/route'

const SECRET = 'a-cron-secret-of-reasonable-length'

describe('secretsMatch', () => {
  beforeEach(() => timingSafeEqual.mockClear())

  it('accepts the exact value and rejects everything else', () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true)
    for (const wrong of ['', 'x', SECRET.slice(0, -1), `${SECRET}x`, SECRET.toUpperCase(), ` ${SECRET}`]) {
      expect(secretsMatch(wrong, SECRET)).toBe(false)
    }
    expect(secretsMatch(null, SECRET)).toBe(false)
    expect(secretsMatch(undefined, SECRET)).toBe(false)
  })

  it('compares two 32-byte digests whatever the lengths, with no early return on length', () => {
    for (const given of ['', 'x', SECRET, `${SECRET}${'y'.repeat(1000)}`]) {
      secretsMatch(given, SECRET)
    }
    expect(timingSafeEqual).toHaveBeenCalledTimes(4)
    for (const [a, b] of timingSafeEqual.mock.calls as [Buffer, Buffer][]) {
      expect(a).toHaveLength(32)
      expect(b).toHaveLength(32)
    }
  })
})

describe('cron endpoints', () => {
  const saved = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
    for (const method of ['log', 'warn', 'error'] as const) jest.spyOn(console, method).mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    process.env.CRON_SECRET = saved
  })

  const processWith = (headers: Record<string, string>) =>
    cronProcess(new NextRequest('http://localhost:3000/api/v1/cron/process', { headers }))
  const lifecycleWith = (headers: Record<string, string>) =>
    billingLifecycle(new NextRequest('http://localhost:3000/api/cron/billing/lifecycle', { headers }))

  it('GET /api/v1/cron/process: 401 without or with a wrong x-cron-secret, 200 with the right one', async () => {
    expect((await processWith({})).status).toBe(401)
    expect((await processWith({ 'x-cron-secret': `${SECRET}x` })).status).toBe(401)
    expect((await processWith({ 'x-cron-secret': SECRET.slice(1) })).status).toBe(401)
    expect((await processWith({ 'x-cron-secret': SECRET })).status).toBe(200)
  })

  it('GET /api/v1/cron/process: 500 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET
    expect((await processWith({ 'x-cron-secret': '' })).status).toBe(500)
  })

  it('GET /api/cron/billing/lifecycle: 401 without or with a wrong bearer, 200 with the right one', async () => {
    expect((await lifecycleWith({})).status).toBe(401)
    expect((await lifecycleWith({ authorization: SECRET })).status).toBe(401)
    expect((await lifecycleWith({ authorization: `Bearer ${SECRET}x` })).status).toBe(401)
    expect((await lifecycleWith({ authorization: `Bearer ${SECRET}` })).status).toBe(200)
  })

  it('GET /api/cron/billing/lifecycle: 401 when CRON_SECRET is not set, even for "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET
    expect((await lifecycleWith({ authorization: 'Bearer undefined' })).status).toBe(401)
    expect((await lifecycleWith({ authorization: 'Bearer ' })).status).toBe(401)
  })
})

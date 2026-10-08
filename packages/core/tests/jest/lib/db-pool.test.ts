/**
 * #221: every pool core creates gets keep-alive, query/statement timeouts and an 'error' handler from one helper.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'

const poolInstances: Array<{ options: Record<string, unknown>; on: jest.Mock }> = []

/** The handler registered for a pool event. */
const handlerFor = (pool: { on: jest.Mock }, event: string) =>
  (pool.on.mock.calls.find(([name]) => name === event) as [string, (...args: unknown[]) => void])[1]
jest.mock('pg', () => ({
  Pool: jest.fn((options: Record<string, unknown>) => {
    const pool = { options, on: jest.fn() }
    poolInstances.push(pool)
    return pool
  }),
}))

import {
  createPool,
  describePoolError,
  parseTimeoutMs,
  poolTimeouts,
  DEFAULT_QUERY_TIMEOUT_MS,
  POOL_IDLE_TIMEOUT_MS,
} from '@/core/lib/db-pool'

describe('createPool', () => {
  beforeEach(() => {
    poolInstances.length = 0
    delete process.env.DB_QUERY_TIMEOUT_MS
    delete process.env.DB_STATEMENT_TIMEOUT_MS
  })

  test('applies keep-alive, idle/connect timeouts, max and the default query timeout', () => {
    createPool('app', { connectionString: 'postgresql://u:secret@h/db' })
    expect(poolInstances[0].options).toMatchObject({
      connectionString: 'postgresql://u:secret@h/db',
      max: 20,
      idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      query_timeout: DEFAULT_QUERY_TIMEOUT_MS,
    })
    expect(poolInstances[0].options.statement_timeout).toBeUndefined()
  })

  test('reads DB_QUERY_TIMEOUT_MS and DB_STATEMENT_TIMEOUT_MS from the environment', () => {
    process.env.DB_QUERY_TIMEOUT_MS = '5000'
    process.env.DB_STATEMENT_TIMEOUT_MS = '4000'
    createPool('app', {})
    expect(poolInstances[0].options).toMatchObject({ query_timeout: 5000, statement_timeout: 4000 })
  })

  test('logs a client error as one line with the code only, and never throws', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    createPool('service', { connectionString: 'postgresql://u:secret@h/db' })
    expect(() => handlerFor(poolInstances[0], 'error')(new Error('x'))).not.toThrow()

    const client = { query: jest.fn(), on: jest.fn() }
    handlerFor(poolInstances[0], 'connect')(client)
    const [event, onError] = client.on.mock.calls[0] as [string, (err: unknown) => void]
    expect(event).toBe('error')
    onError(Object.assign(new Error('read ETIMEDOUT postgresql://u:secret@h/db user "u"'), { code: 'ETIMEDOUT' }))

    expect(warn).toHaveBeenCalledTimes(1)
    const line = String(warn.mock.calls[0][0])
    expect(line).toContain('service pool')
    expect(line).toContain('ETIMEDOUT')
    expect(line).not.toMatch(/secret|postgresql|user/)
    warn.mockRestore()
  })

  test('destroys the socket of a client whose query hit the client-side timeout, and only then', async () => {
    createPool('app', {})
    const destroy = jest.fn()
    const timeout = Object.assign(new Error('Query read timeout'), {})
    const client = { query: jest.fn(() => Promise.reject(timeout)), on: jest.fn(), connection: { stream: { destroy } } }
    handlerFor(poolInstances[0], 'connect')(client)

    await expect(client.query()).rejects.toBe(timeout)
    expect(destroy).toHaveBeenCalledTimes(1)

    expect(client).toMatchObject({ _queryable: false })

    const other = { query: jest.fn(() => Promise.reject(new Error('syntax error'))), on: jest.fn(), connection: { stream: { destroy } } }
    handlerFor(poolInstances[0], 'connect')(other)
    await expect(other.query()).rejects.toThrow('syntax error')
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  test('the callback form is dropped too, and marked non-queryable before the caller sees the error', () => {
    createPool('app', {})
    const destroy = jest.fn()
    const client = {
      _queryable: true,
      query: jest.fn((_text: string, cb: (err: Error | null) => void) => cb(new Error('Query read timeout'))),
      on: jest.fn(),
      connection: { stream: { destroy } },
    }
    handlerFor(poolInstances[0], 'connect')(client)
    const seen: boolean[] = []
    client.query('SELECT 1', () => seen.push(client._queryable))

    expect(seen).toEqual([false])
    expect(destroy).toHaveBeenCalledTimes(1)

    const failing = { _queryable: true, query: jest.fn((_t: string, cb: (err: Error | null) => void) => cb(new Error('boom'))), on: jest.fn(), connection: { stream: { destroy } } }
    handlerFor(poolInstances[0], 'connect')(failing)
    failing.query('SELECT 1', () => {})
    expect(failing._queryable).toBe(true)
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})

describe('timeout env parsing', () => {
  test('unset or empty gives the fallback; 0 disables', () => {
    expect(parseTimeoutMs('X', undefined, 7)).toBe(7)
    expect(parseTimeoutMs('X', '  ', 7)).toBe(7)
    expect(parseTimeoutMs('X', '0', 7)).toBeUndefined()
    expect(parseTimeoutMs('X', '1500', 7)).toBe(1500)
  })

  test.each(['abc', '-5', '1.5', '10s', 'NaN'])('invalid value %p warns and gives the fallback', (raw) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseTimeoutMs('DB_QUERY_TIMEOUT_MS', raw, 7)).toBe(7)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DB_QUERY_TIMEOUT_MS'))
    warn.mockRestore()
  })

  test('poolTimeouts: query default on, statement default off', () => {
    expect(poolTimeouts({})).toEqual({ query_timeout: DEFAULT_QUERY_TIMEOUT_MS, statement_timeout: undefined })
    expect(poolTimeouts({ DB_QUERY_TIMEOUT_MS: '0' }).query_timeout).toBeUndefined()
  })

  test('describePoolError gives the code, else the class, and cannot throw', () => {
    expect(describePoolError(Object.assign(new Error('password for user "x"'), { code: '28P01' }))).toBe('28P01')
    expect(describePoolError(new TypeError('boom'))).toBe('TypeError')
    expect(describePoolError(Object.create(null))).toBe('unknown')
    expect(describePoolError(undefined)).toBe('unknown')
  })
})

/**
 * S80: lib/auth's pool is one per process and database URL. The project's proxy.ts reads the session in process, so
 * its bundle loads its own copy of lib/auth; a pool per copy measured 62 connections at peak under 50 concurrent
 * protected requests where the template that fetched /api/auth/get-session reached 40.
 */
import { describe, test, expect, jest } from '@jest/globals'

const mockPool = jest.fn(() => ({ query: jest.fn() }))
jest.mock('pg', () => ({ Pool: mockPool }))
jest.mock('better-auth', () => ({ betterAuth: jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} })) }))
jest.mock('better-auth/plugins', () => ({ emailOTP: jest.fn(() => ({ id: 'email-otp' })) }))
jest.mock('better-auth/next-js', () => ({ nextCookies: jest.fn(() => ({ id: 'next-cookies' })) }))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({ EmailFactory: { create: jest.fn(() => ({ send: jest.fn() })) } }))

function loadAuthPool(url: string): unknown {
  const previous = { DATABASE_URL: process.env.DATABASE_URL, DATABASE_SERVICE_URL: process.env.DATABASE_SERVICE_URL }
  process.env.DATABASE_URL = url
  delete process.env.DATABASE_SERVICE_URL
  try {
    let options: { database?: unknown } = {}
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const betterAuth = require('better-auth').betterAuth as jest.Mock
      betterAuth.mockClear()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/core/lib/auth')
      options = (betterAuth.mock.calls[0] as unknown[])[0] as { database?: unknown }
    })
    return options.database
  } finally {
    Object.assign(process.env, previous)
  }
}

describe('lib/auth pool (S80)', () => {
  test('every copy of the module in a process shares one pool per database URL', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockPool.mockClear()
    const first = loadAuthPool('postgresql://a@localhost/s80_one')
    const second = loadAuthPool('postgresql://a@localhost/s80_one')
    const other = loadAuthPool('postgresql://a@localhost/s80_two')

    expect(first).toBeDefined()
    expect(second).toBe(first)
    expect(other).not.toBe(first)
    expect(mockPool).toHaveBeenCalledTimes(2)
  })
})

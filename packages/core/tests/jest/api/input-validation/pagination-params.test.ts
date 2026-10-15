/**
 * S192 — parsePaginationParams (lib/api/helpers.ts), the helper behind the list endpoints' `page` / `limit`.
 * Out-of-range values are clamped; a value that is not a number must not reach the database as NaN.
 */

jest.mock('@/core/lib/api/auth', () => ({ validateApiKey: jest.fn() }))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))
jest.mock('@/core/lib/api/rate-limit', () => ({ checkRateLimit: jest.fn(), addRateLimitHeaders: jest.fn(), apiKeyRateLimitResponse: jest.fn() }))
jest.mock('@/core/lib/db', () => ({ mutateWithRLS: jest.fn(), queryWithRLS: jest.fn() }))
jest.mock('@/core/lib/config', () => ({ getApplicationConfig: jest.fn() }))
jest.mock('@/core/lib/services/meta.service', () => ({ MetaService: {} }))
jest.mock('@/core/lib/services/scope.service', () => ({ ScopeService: {} }))
jest.mock('@/core/lib/entities/registry', () => ({ getEntityConfig: jest.fn() }))
jest.mock('@/core/lib/entities/queries', () => ({ getChildEntities: jest.fn(), getEntity: jest.fn() }))

import { NextRequest } from 'next/server'
import { parsePaginationParams } from '@/core/lib/api/helpers'

const parse = (query: string) => parsePaginationParams(new NextRequest(`http://localhost/api/v1/things${query}`))

describe('parsePaginationParams — values out of range are clamped', () => {
  test.each([
    ['nothing', '', { page: 1, limit: 10, offset: 0 }],
    ['a negative page', '?page=-3', { page: 1, limit: 10, offset: 0 }],
    ['page zero', '?page=0', { page: 1, limit: 10, offset: 0 }],
    ['a negative limit', '?limit=-10', { page: 1, limit: 1, offset: 0 }],
    ['limit zero', '?limit=0', { page: 1, limit: 1, offset: 0 }],
    ['a limit over the maximum', '?limit=100000', { page: 1, limit: 100, offset: 0 }],
    ['repeated page parameters (the first wins)', '?page=2&page=9', { page: 2, limit: 10, offset: 10 }],
  ])('%s', (_label, query, expected) => {
    expect(parse(query)).toEqual(expected)
  })
})

describe('parsePaginationParams — values that are not numbers', () => {
  // parseInt gives NaN, Math.max/min keep NaN, and the offset reaches the database as NaN: a type error there, so a 500.
  test.each([
    ['a page of text', '?page=abc'],
    ['a limit of text', '?limit=many'],
    ['an empty-looking page', '?page=%20'],
    ['a page that is only a sign', '?page=-'],
  ])('%s gives finite numbers', (_label, query) => {
    const { page, limit, offset } = parse(query)
    expect([page, limit, offset].every(Number.isFinite)).toBe(true)
  })

  test('a page too large to be an integer gives a finite offset', () => {
    const { offset } = parse('?page=99999999999999999999999&limit=100')
    expect(Number.isSafeInteger(offset)).toBe(true)
  })
})

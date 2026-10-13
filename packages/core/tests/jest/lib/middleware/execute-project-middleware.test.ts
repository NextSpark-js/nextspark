/**
 * A project request hook's error must reach the proxy (which answers a fixed 500): the registry wrapper must not swallow it.
 */
import { afterEach, describe, expect, jest, test } from '@jest/globals'

const mockMiddleware = jest.fn<(...args: unknown[]) => unknown>()

jest.mock('@nextsparkjs/registries/middleware-registry', () => ({
  MIDDLEWARE_REGISTRY: { project: { exists: true, middleware: (...args: unknown[]) => mockMiddleware(...args) } },
}))
jest.mock('@nextsparkjs/registries/theme-registry', () => ({ THEME_REGISTRY: {} }), { virtual: true })

import { executeProjectMiddleware } from '../../../../src/lib/middleware'

describe('executeProjectMiddleware', () => {
  afterEach(() => mockMiddleware.mockReset())

  test.each([
    ['throws synchronously', () => { throw new Error('boom') }, 'boom'],
    ['rejects with a non-Error', () => Promise.reject('plain string'), 'plain string'],
  ])('a hook that %s rejects with that value and logs nothing', async (_name, impl, expected) => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockMiddleware.mockImplementation(impl)
    try {
      const rejected = await executeProjectMiddleware({} as never, null).then(() => undefined, (error: unknown) => error)
      expect(rejected instanceof Error ? rejected.message : rejected).toBe(expected)
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })
})

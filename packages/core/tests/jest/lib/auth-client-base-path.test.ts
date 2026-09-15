/**
 * lib/auth-client.ts under a Next.js basePath: the browser client calls the
 * auth routes where the app serves them. Loads the module in isolation and
 * inspects the options handed to `createAuthClient()`.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'

const mockCreateAuthClient = jest.fn(() => ({}))

jest.mock('better-auth/react', () => ({
  createAuthClient: (...args: unknown[]) => mockCreateAuthClient(...(args as [])),
}), { virtual: true })
jest.mock('better-auth/client/plugins', () => ({
  inferAdditionalFields: jest.fn(() => ({ id: 'infer-additional-fields' })),
  emailOTPClient: jest.fn(() => ({ id: 'email-otp-client' })),
}), { virtual: true })

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

function loadClientOptions(basePath: string | undefined): { basePath?: string } {
  if (basePath === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = basePath
  mockCreateAuthClient.mockClear()
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth-client')
  })
  expect(mockCreateAuthClient).toHaveBeenCalledTimes(1)
  return (mockCreateAuthClient.mock.calls[0] as unknown[])[0] as { basePath?: string }
}

describe('lib/auth-client.ts base path', () => {
  test('calls /api/auth when the app has no base path', () => {
    expect(loadClientOptions(undefined).basePath).toBe('/api/auth')
  })

  test('calls the auth routes under the base path', () => {
    expect(loadClientOptions('/base').basePath).toBe('/base/api/auth')
  })
})

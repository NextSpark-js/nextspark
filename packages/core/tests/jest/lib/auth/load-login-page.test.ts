/**
 * @jest-environment node
 *
 * loadLoginPage leaves for the login page with a full page load, base path included. jsdom does not let a test replace
 * window.location, so the node environment stands in with a window that holds only the location.
 */
const mockAssign = jest.fn()
let mockBasePath = ''

jest.mock('@/core/lib/base-path', () => ({ withBasePath: (path: string) => `${mockBasePath}${path}` }))

import { loadLoginPage } from '@/core/lib/auth/load-login-page'

beforeEach(() => {
  mockAssign.mockReset()
  mockBasePath = ''
  ;(globalThis as { window?: unknown }).window = { location: { assign: mockAssign } }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('loadLoginPage', () => {
  test('assigns the login path', () => {
    loadLoginPage()
    expect(mockAssign).toHaveBeenCalledWith('/login')
  })

  test('carries the base path', () => {
    mockBasePath = '/app'
    loadLoginPage()
    expect(mockAssign).toHaveBeenCalledWith('/app/login')
  })
})

/**
 * @jest-environment node
 *
 * loadLoginPage leaves for the login page with a full page load, base path included. jsdom does not let a test replace
 * window.location, so the node environment stands in with a window that holds only the location.
 */
const mockAssign = jest.fn()
let mockBasePath = ''

jest.mock('@/core/lib/base-path', () => ({ withBasePath: (path: string) => `${mockBasePath}${path}` }))

// the module remembers that the page is leaving, so each test loads its own copy
function freshLoadLoginPage(): () => void {
  let loadLoginPage!: () => void
  jest.isolateModules(() => {
    loadLoginPage = require('@/core/lib/auth/load-login-page').loadLoginPage
  })
  return loadLoginPage
}

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
    freshLoadLoginPage()()
    expect(mockAssign).toHaveBeenCalledWith('/login')
  })

  test('loads the page once when a sign-out and a guard both ask for it (#562)', () => {
    const loadLoginPage = freshLoadLoginPage()
    loadLoginPage()
    loadLoginPage()
    expect(mockAssign).toHaveBeenCalledTimes(1)
  })

  test('carries the base path', () => {
    mockBasePath = '/app'
    freshLoadLoginPage()()
    expect(mockAssign).toHaveBeenCalledWith('/app/login')
  })
})

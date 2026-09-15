/**
 * apiClient.clearAuth() and the native cookie store
 *
 * Each test loads the client in a fresh module registry, so the optional
 * cookie manager can be absent, broken or available per test.
 */

const COOKIE_MANAGER = '@preeternal/react-native-cookie-manager'

function loadClient() {
  const { apiClient } = require('../../../src/api/client') as typeof import('../../../src/api/client')
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store')
  return { apiClient, SecureStore }
}

function mockCookieManager(clearAll: jest.Mock) {
  jest.doMock(COOKIE_MANAGER, () => ({ __esModule: true, default: { clearAll } }), { virtual: true })
}

const STORED_KEYS = ['nextspark.auth.token', 'nextspark.auth.teamId', 'nextspark.auth.user', 'nextspark.auth.team']

function expectSessionCleared({ apiClient, SecureStore }: ReturnType<typeof loadClient>) {
  expect(apiClient.getToken()).toBeNull()
  expect(apiClient.getTeamId()).toBeNull()
  expect(apiClient.getStoredUser()).toBeNull()
  expect(apiClient.getStoredTeam()).toBeNull()
  for (const key of STORED_KEYS) {
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key)
  }
}

async function signIn(apiClient: ReturnType<typeof loadClient>['apiClient']) {
  await apiClient.setToken('token')
  await apiClient.setUser({ id: 'user-1', email: 'ada@example.com', name: 'Ada' } as never)
  await apiClient.setTeam({ id: 'team-1', name: 'Team', role: 'member' })
}

describe('apiClient.clearAuth() and native cookies', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('clears the stored credentials and warns once when the cookie manager is not installed', async () => {
    // What Metro's optional require throws when the package is not in the app.
    jest.doMock(
      COOKIE_MANAGER,
      () => {
        throw Object.assign(new Error(`Cannot find module '${COOKIE_MANAGER}'`), { code: 'MODULE_NOT_FOUND' })
      },
      { virtual: true }
    )
    const { apiClient, SecureStore } = loadClient()
    await apiClient.setToken('token')

    await expect(apiClient.clearAuth()).resolves.toBeUndefined()
    await apiClient.clearAuth()

    expect(apiClient.getToken()).toBeNull()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nextspark.auth.token')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain(COOKIE_MANAGER)
  })

  it('does not break when the package is installed but its native module is missing (Expo Go)', async () => {
    jest.doMock(
      COOKIE_MANAGER,
      () => {
        throw new Error("TurboModuleRegistry.getEnforcing(...): 'CookieManager' could not be found.")
      },
      { virtual: true }
    )
    const { apiClient, SecureStore } = loadClient()
    await apiClient.setToken('token')

    await expect(apiClient.clearAuth()).resolves.toBeUndefined()
    await apiClient.clearAuth()

    expect(apiClient.getToken()).toBeNull()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nextspark.auth.token')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('empties the native cookie store when the cookie manager is available', async () => {
    const clearAll = jest.fn().mockResolvedValue(true)
    mockCookieManager(clearAll)
    const { apiClient, SecureStore } = loadClient()
    await apiClient.setToken('token')

    await apiClient.clearAuth()

    expect(clearAll).toHaveBeenCalledTimes(1)
    expect(apiClient.getToken()).toBeNull()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nextspark.auth.token')
    expect(warn).not.toHaveBeenCalled()
  })

  it('finishes clearing the credentials when emptying the cookie store fails', async () => {
    const clearAll = jest.fn().mockRejectedValue(new Error('native failure'))
    mockCookieManager(clearAll)
    const { apiClient, SecureStore } = loadClient()
    await apiClient.setToken('token')

    await expect(apiClient.clearAuth()).resolves.toBeUndefined()

    expect(apiClient.getToken()).toBeNull()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nextspark.auth.token')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to clear native cookies'), expect.any(Error))
  })

  it('empties the cookie store and ends the session when the first SecureStore delete fails', async () => {
    const clearAll = jest.fn().mockResolvedValue(true)
    mockCookieManager(clearAll)
    const loaded = loadClient()
    await signIn(loaded.apiClient)
    ;(loaded.SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('SecureStore unavailable'))

    await expect(loaded.apiClient.clearAuth()).resolves.toBeUndefined()

    expect(clearAll).toHaveBeenCalledTimes(1)
    expectSessionCleared(loaded)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to clear'), expect.any(Error))
  })

  it('empties the cookie store and ends the session when a later SecureStore delete fails', async () => {
    const clearAll = jest.fn().mockResolvedValue(true)
    mockCookieManager(clearAll)
    const loaded = loadClient()
    await signIn(loaded.apiClient)
    ;(loaded.SecureStore.deleteItemAsync as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('SecureStore unavailable'))

    await expect(loaded.apiClient.clearAuth()).resolves.toBeUndefined()

    expect(clearAll).toHaveBeenCalledTimes(1)
    expectSessionCleared(loaded)
  })

  it('ends the session when the cookie manager itself throws', async () => {
    const clearAll = jest.fn(() => {
      throw new Error('native crash')
    })
    mockCookieManager(clearAll)
    const loaded = loadClient()
    await signIn(loaded.apiClient)

    await expect(loaded.apiClient.clearAuth()).resolves.toBeUndefined()

    expect(clearAll).toHaveBeenCalledTimes(1)
    expectSessionCleared(loaded)
  })

  it('signs out offline with a failing SecureStore: logout resolves and the cookies are cleared', async () => {
    const clearAll = jest.fn().mockResolvedValue(true)
    mockCookieManager(clearAll)
    const loaded = loadClient()
    const { authApi } = require('../../../src/api/core/auth') as typeof import('../../../src/api/core/auth')
    await signIn(loaded.apiClient)
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'))
    ;(loaded.SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('SecureStore unavailable'))

    await expect(authApi.logout()).resolves.toBeUndefined()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/sign-out'),
      expect.objectContaining({ method: 'POST', body: '{}' })
    )
    expect(clearAll).toHaveBeenCalledTimes(1)
    expectSessionCleared(loaded)
  })

  // Overrides the react-native mock for the rest of the file, so it runs last.
  it('leaves cookies to the browser on web', async () => {
    const clearAll = jest.fn().mockResolvedValue(true)
    mockCookieManager(clearAll)
    jest.doMock('react-native', () => ({ Platform: { OS: 'web', select: (obj: { web?: unknown }) => obj.web } }))
    const { clearNativeCookies } = require('../../../src/lib/cookies') as typeof import('../../../src/lib/cookies')

    await clearNativeCookies()

    expect(clearAll).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})

import { apiClient, ApiError, getApiUrl } from '../../../src/api/client'
import * as SecureStore from 'expo-secure-store'

// Re-mock for this specific test
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://test-api.example.com',
    },
    hostUri: null,
  },
}))

describe('getApiUrl', () => {
  it('returns apiUrl from expo config when available', () => {
    const url = getApiUrl()
    expect(url).toBe('http://test-api.example.com')
  })
})

describe('ApiClient', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    // Clear client state
    await apiClient.clearAuth()
  })

  describe('init', () => {
    it('loads stored credentials', async () => {
      const mockToken = 'test-token'
      const mockTeamId = 'test-team-id'
      const mockUser = { id: 'user-1', name: 'Test User' }

      ;(SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(mockToken)
        .mockResolvedValueOnce(mockTeamId)
        .mockResolvedValueOnce(JSON.stringify(mockUser))

      await apiClient.init()

      expect(apiClient.getToken()).toBe(mockToken)
      expect(apiClient.getTeamId()).toBe(mockTeamId)
      expect(apiClient.getStoredUser()).toEqual(mockUser)
    })

    it('loads the stored team record', async () => {
      const mockTeam = { id: 'team-1', name: 'Team One', role: 'member' }

      ;(SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('team-1')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(mockTeam))

      await apiClient.init()

      expect(apiClient.getStoredTeam()).toEqual(mockTeam)
    })
  })

  describe('setTeam', () => {
    it('stores the team id and the full record', async () => {
      const team = { id: 'team-1', name: 'Team One', role: 'member' }
      await apiClient.setTeam(team)

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nextspark.auth.teamId', 'team-1')
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nextspark.auth.team',
        JSON.stringify(team)
      )
      expect(apiClient.getTeamId()).toBe('team-1')
      expect(apiClient.getStoredTeam()).toEqual(team)
    })
  })

  describe('setToken', () => {
    it('stores token in secure storage', async () => {
      const token = 'new-token'
      await apiClient.setToken(token)

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nextspark.auth.token',
        token
      )
      expect(apiClient.getToken()).toBe(token)
    })
  })

  describe('request', () => {
    it('includes Authorization header when token is set', async () => {
      await apiClient.setToken('test-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      })

      await apiClient.get('/test')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('throws ApiError on non-ok response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      })

      await expect(apiClient.get('/test')).rejects.toThrow(ApiError)
    })

    it('does not declare a JSON Content-Type on a bodyless POST', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      })

      await apiClient.post('/api/auth/sign-out')

      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(init.headers).not.toHaveProperty('Content-Type')
      expect(init.body).toBeUndefined()
    })

    it('declares a JSON Content-Type when the POST has a body', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      })

      await apiClient.post('/test', { foo: 'bar' })

      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
      expect(init.body).toBe(JSON.stringify({ foo: 'bar' }))
    })

    it('does not declare a JSON Content-Type when the body is null', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      })

      await apiClient.request('/api/auth/sign-out', { method: 'POST', body: null })

      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(init.headers).not.toHaveProperty('Content-Type')
    })
  })

  describe('clearAuth', () => {
    it('clears all stored credentials', async () => {
      await apiClient.setToken('token')
      await apiClient.setTeam({ id: 'team-id', name: 'Team', role: 'member' })

      await apiClient.clearAuth()

      expect(apiClient.getToken()).toBeNull()
      expect(apiClient.getTeamId()).toBeNull()
      expect(apiClient.getStoredUser()).toBeNull()
      expect(apiClient.getStoredTeam()).toBeNull()
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nextspark.auth.team')
    })
  })
})

// Overrides the expo-constants/react-native mocks for the rest of the file,
// so these run last.
describe('getApiUrl fallback host', () => {
  it('falls back to localhost when there is no dev server host', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: null } }))
    const { getApiUrl: getApiUrlWithoutHost } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlWithoutHost()).toBe('http://localhost:3000')
  })

  it('falls back to the Android emulator alias for the host machine on the emulator', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: null } }))
    jest.doMock('expo-device', () => ({ isDevice: false }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlAndroid } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlAndroid()).toBe('http://10.0.2.2:3000')
  })

  it('keeps localhost on a physical Android device with no dev server host, matching an adb reverse tunnel', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: null } }))
    jest.doMock('expo-device', () => ({ isDevice: true }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlAndroidDevice } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlAndroidDevice()).toBe('http://localhost:3000')
  })

  it('uses the dev server LAN host from hostUri on iOS regardless of Device.isDevice', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '192.168.1.2:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: true }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios', select: (obj: { ios?: unknown }) => obj.ios },
    }))
    const { getApiUrl: getApiUrlWithHost } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlWithHost()).toBe('http://192.168.1.2:3000')
  })

  it('uses the dev server LAN host from hostUri on web', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '192.168.1.2:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: false }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web', select: (obj: { web?: unknown }) => obj.web },
    }))
    const { getApiUrl: getApiUrlWeb } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlWeb()).toBe('http://192.168.1.2:3000')
  })

  it('uses the LAN host from hostUri on a physical Android device without adb reverse', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '192.168.1.2:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: true }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlAndroidDeviceWithHost } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlAndroidDeviceWithHost()).toBe('http://192.168.1.2:3000')
  })

  it('keeps localhost on a physical Android device when hostUri is loopback, matching an adb reverse tunnel', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: 'localhost:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: true }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlAndroidDeviceReverse } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlAndroidDeviceReverse()).toBe('http://localhost:3000')
  })

  it('uses hostUri LAN host on the Android emulator, reachable through its virtual NAT', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '192.168.1.2:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: false }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlAndroidEmulatorWithHost } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlAndroidEmulatorWithHost()).toBe('http://192.168.1.2:3000')
  })

  it('translates a loopback IPv4 hostUri to the Android emulator host alias', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '127.0.0.1:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: false }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlAndroidEmulatorLoopback } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlAndroidEmulatorLoopback()).toBe('http://10.0.2.2:3000')
  })

  it('translates a loopback IPv6 hostUri to the Android emulator host alias', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '[::1]:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: false }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlAndroidEmulatorLoopbackIpv6 } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlAndroidEmulatorLoopbackIpv6()).toBe('http://10.0.2.2:3000')
  })

  it('keeps the brackets around an IPv6 hostUri host on iOS', () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '[::1]:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: true }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios', select: (obj: { ios?: unknown }) => obj.ios },
    }))
    const { getApiUrl: getApiUrlIpv6 } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlIpv6()).toBe('http://[::1]:3000')
  })

  it('prefers EXPO_PUBLIC_API_URL over hostUri auto-detect on the Android emulator', () => {
    jest.resetModules()
    const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_URL
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.9.9:4000'
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {}, hostUri: '127.0.0.1:8081' } }))
    jest.doMock('expo-device', () => ({ isDevice: false }))
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: { android?: unknown }) => obj.android },
    }))
    const { getApiUrl: getApiUrlWithEnv } = require('../../../src/api/client') as typeof import('../../../src/api/client')

    expect(getApiUrlWithEnv()).toBe('http://192.168.9.9:4000')

    process.env.EXPO_PUBLIC_API_URL = ORIGINAL_ENV
  })
})

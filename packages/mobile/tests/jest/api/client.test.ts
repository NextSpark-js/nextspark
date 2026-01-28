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
  })

  describe('clearAuth', () => {
    it('clears all stored credentials', async () => {
      await apiClient.setToken('token')
      await apiClient.setTeamId('team-id')

      await apiClient.clearAuth()

      expect(apiClient.getToken()).toBeNull()
      expect(apiClient.getTeamId()).toBeNull()
      expect(apiClient.getStoredUser()).toBeNull()
    })
  })
})

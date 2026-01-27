/**
 * Tests for api/client.ts
 * ApiClient tests for HTTP operations and auth management
 */

import * as SecureStore from 'expo-secure-store'
import { mockStorage } from '../mocks'

// Storage keys (must match client.ts)
const TOKEN_KEY = 'nextspark.auth.token'
const TEAM_ID_KEY = 'nextspark.auth.teamId'
const USER_KEY = 'nextspark.auth.user'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://test-api.example.com',
    },
  },
}))

// Import the client
import { apiClient, ApiError } from '@/api/client'

describe('ApiClient', () => {
  beforeEach(async () => {
    // Clear all mocks and storage
    jest.clearAllMocks()
    mockStorage.clear()
    mockFetch.mockReset()
    // Clear the client's internal state by clearing auth
    await apiClient.clearAuth()
  })

  describe('init()', () => {
    it('should load token from storage', async () => {
      await SecureStore.setItemAsync(TOKEN_KEY, 'test-token')

      await apiClient.init()

      expect(apiClient.getToken()).toBe('test-token')
    })

    it('should load teamId from storage', async () => {
      await SecureStore.setItemAsync(TEAM_ID_KEY, 'team-123')

      await apiClient.init()

      expect(apiClient.getTeamId()).toBe('team-123')
    })

    it('should load user from storage', async () => {
      const testUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(testUser))

      await apiClient.init()

      expect(apiClient.getStoredUser()).toEqual(testUser)
    })

    it('should handle invalid JSON in stored user', async () => {
      await SecureStore.setItemAsync(USER_KEY, 'invalid-json{')

      await apiClient.init()

      expect(apiClient.getStoredUser()).toBeNull()
    })

    it('should handle empty storage', async () => {
      await apiClient.init()

      expect(apiClient.getToken()).toBeNull()
      expect(apiClient.getTeamId()).toBeNull()
      expect(apiClient.getStoredUser()).toBeNull()
    })
  })

  describe('Token management', () => {
    it('getToken() should return null after clearAuth', async () => {
      await apiClient.clearAuth()
      expect(apiClient.getToken()).toBeNull()
    })

    it('setToken() should store token in memory and storage', async () => {
      await apiClient.setToken('new-token')

      expect(apiClient.getToken()).toBe('new-token')
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'new-token')
    })

    it('getToken() should return stored token after setToken', async () => {
      await apiClient.setToken('my-token')

      expect(apiClient.getToken()).toBe('my-token')
    })
  })

  describe('Team management', () => {
    it('getTeamId() should return null after clearAuth', async () => {
      await apiClient.clearAuth()
      expect(apiClient.getTeamId()).toBeNull()
    })

    it('setTeamId() should store teamId in memory and storage', async () => {
      await apiClient.setTeamId('team-456')

      expect(apiClient.getTeamId()).toBe('team-456')
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TEAM_ID_KEY, 'team-456')
    })
  })

  describe('User management', () => {
    it('getStoredUser() should return null after clearAuth', async () => {
      await apiClient.clearAuth()
      expect(apiClient.getStoredUser()).toBeNull()
    })

    it('setUser() should store user as JSON', async () => {
      const user = { id: 'user-2', name: 'Jane', email: 'jane@example.com' }

      await apiClient.setUser(user as import('@/api/core/types').User)

      expect(apiClient.getStoredUser()).toEqual(user)
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        USER_KEY,
        JSON.stringify(user)
      )
    })
  })

  describe('clearAuth()', () => {
    it('should clear token, teamId, and user from memory', async () => {
      await apiClient.setToken('token')
      await apiClient.setTeamId('team')
      await apiClient.setUser({ id: 'u', name: 'U', email: 'u@e.com' } as import('@/api/core/types').User)

      await apiClient.clearAuth()

      expect(apiClient.getToken()).toBeNull()
      expect(apiClient.getTeamId()).toBeNull()
      expect(apiClient.getStoredUser()).toBeNull()
    })

    it('should delete all keys from storage', async () => {
      jest.clearAllMocks() // Clear previous calls
      await apiClient.clearAuth()

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY)
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TEAM_ID_KEY)
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(USER_KEY)
    })
  })

  describe('request()', () => {
    beforeEach(async () => {
      await apiClient.clearAuth()
    })

    it('should make request with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      })

      await apiClient.request('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
        })
      )
    })

    it('should add Authorization header when token exists', async () => {
      await apiClient.setToken('bearer-token')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      await apiClient.request('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer-token',
          }),
        })
      )
    })

    it('should add x-team-id header when teamId exists', async () => {
      await apiClient.setTeamId('team-789')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      await apiClient.request('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-team-id': 'team-789',
          }),
        })
      )
    })

    it('should throw ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request' }),
      })

      await expect(apiClient.request('/test')).rejects.toThrow(ApiError)
    })

    it('should return empty object for 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      })

      const result = await apiClient.request('/test')

      expect(result).toEqual({})
    })

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const result = await apiClient.request('/test')

      expect(result).toEqual({})
    })
  })

  describe('HTTP methods', () => {
    beforeEach(async () => {
      await apiClient.clearAuth()
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'response' }),
      })
    })

    it('get() should make GET request with params', async () => {
      await apiClient.get('/users', { page: 1, limit: 10 })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/users?page=1&limit=10',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('get() should exclude undefined params', async () => {
      await apiClient.get('/users', { page: 1, search: undefined })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/users?page=1',
        expect.any(Object)
      )
    })

    it('post() should make POST request with JSON body', async () => {
      const data = { name: 'Test', value: 123 }

      await apiClient.post('/items', data)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        })
      )
    })

    it('post() should handle no body', async () => {
      await apiClient.post('/trigger')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/trigger',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      )
    })

    it('patch() should make PATCH request with JSON body', async () => {
      const data = { name: 'Updated' }

      await apiClient.patch('/items/1', data)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/items/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(data),
        })
      )
    })

    it('delete() should make DELETE request', async () => {
      await apiClient.delete('/items/1')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/items/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('URL building', () => {
    beforeEach(async () => {
      await apiClient.clearAuth()
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      })
    })

    it('should build URL without params', async () => {
      await apiClient.get('/api/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/api/test',
        expect.any(Object)
      )
    })

    it('should build URL with multiple params', async () => {
      await apiClient.get('/search', { q: 'test', sort: 'asc', page: 2 })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('q=test')
      expect(calledUrl).toContain('sort=asc')
      expect(calledUrl).toContain('page=2')
    })

    it('should convert boolean params to string', async () => {
      await apiClient.get('/filter', { active: true })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/filter?active=true',
        expect.any(Object)
      )
    })
  })
})

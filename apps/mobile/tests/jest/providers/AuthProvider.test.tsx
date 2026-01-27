/**
 * Tests for providers/AuthProvider.tsx
 * Authentication context and state management
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { User, Team } from '@/api/core/types'

// Import mocks from our __mocks__ folder
import { ApiError, mockApiClient } from '../__mocks__/api-client'
import { mockAuthApi, mockTeamsApi } from '../__mocks__/api-core'

// Mock the modules with the imported mocks
jest.mock('@/api/client', () => require('../__mocks__/api-client'))
jest.mock('@/api/core', () => require('../__mocks__/api-core'))

// Import after mocks are set up
import { AuthProvider, useAuth } from '@/providers/AuthProvider'

// Test data
const testUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
}

const testTeam: Team = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
  role: 'owner',
}

const testTeam2: Team = {
  id: 'team-2',
  name: 'Second Team',
  slug: 'second-team',
  role: 'member',
}

// Wrapper component
function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>
  }
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset default mock implementations
    mockApiClient.init.mockResolvedValue(undefined)
    mockApiClient.getToken.mockReturnValue(null)
    mockApiClient.getStoredUser.mockReturnValue(null)
    mockApiClient.getTeamId.mockReturnValue(null)
    mockApiClient.setToken.mockResolvedValue(undefined)
    mockApiClient.setTeamId.mockResolvedValue(undefined)
    mockApiClient.setUser.mockResolvedValue(undefined)
    mockApiClient.clearAuth.mockResolvedValue(undefined)
    mockAuthApi.getSession.mockResolvedValue(null)
    mockAuthApi.logout.mockResolvedValue(undefined)
    mockTeamsApi.getTeams.mockResolvedValue({ data: [] })
    mockTeamsApi.switchTeam.mockResolvedValue(undefined)
  })

  describe('initialization', () => {
    it('should show loading state initially', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('should load stored credentials on mount', async () => {
      mockApiClient.getToken.mockReturnValue('stored-token')
      mockApiClient.getStoredUser.mockReturnValue(testUser)
      mockApiClient.getTeamId.mockReturnValue('team-1')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: { id: 's1', expiresAt: '2025-01-01' } })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.init).toHaveBeenCalled()
      expect(result.current.user).toEqual(testUser)
    })

    it('should validate session with server', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: { id: 's1', expiresAt: '2025-01-01' } })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockAuthApi.getSession).toHaveBeenCalled()
    })

    it('should use stored user if session validation returns null', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockApiClient.getStoredUser.mockReturnValue(testUser)
      mockAuthApi.getSession.mockResolvedValue(null)
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toEqual(testUser)
    })

    it('should clear auth on 401 error', async () => {
      mockApiClient.getToken.mockReturnValue('expired-token')
      mockAuthApi.getSession.mockRejectedValue(new ApiError('Unauthorized', 401))

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiClient.clearAuth).toHaveBeenCalled()
    })

    it('should keep credentials on network error', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockApiClient.getStoredUser.mockReturnValue(testUser)
      mockAuthApi.getSession.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should NOT clear auth on network errors
      expect(mockApiClient.clearAuth).not.toHaveBeenCalled()
      // Should use stored user
      expect(result.current.user).toEqual(testUser)
    })

    it('should select stored team if available', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockApiClient.getTeamId.mockReturnValue('team-2')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: null })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam, testTeam2] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.team?.id).toBe('team-2')
    })

    it('should select first team if stored team not found', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockApiClient.getTeamId.mockReturnValue('non-existent-team')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: null })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam, testTeam2] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.team?.id).toBe('team-1')
      expect(mockTeamsApi.switchTeam).toHaveBeenCalledWith('team-1')
    })
  })

  describe('login()', () => {
    it('should call authApi.login with credentials', async () => {
      mockAuthApi.login.mockResolvedValue({ user: testUser, session: { token: 'new-token' } })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(mockAuthApi.login).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    it('should set user after successful login', async () => {
      mockAuthApi.login.mockResolvedValue({ user: testUser, session: { token: 'token' } })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(result.current.user).toEqual(testUser)
    })

    it('should fetch and set teams after login', async () => {
      mockAuthApi.login.mockResolvedValue({ user: testUser, session: { token: 'token' } })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam, testTeam2] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(mockTeamsApi.getTeams).toHaveBeenCalled()
      expect(result.current.teams).toHaveLength(2)
    })

    it('should select first team automatically', async () => {
      mockAuthApi.login.mockResolvedValue({ user: testUser, session: { token: 'token' } })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam, testTeam2] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(mockTeamsApi.switchTeam).toHaveBeenCalledWith('team-1')
      expect(result.current.team).toEqual(testTeam)
    })

    it('should throw error if no teams available', async () => {
      mockAuthApi.login.mockResolvedValue({ user: testUser, session: { token: 'token' } })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'password123')
        })
      ).rejects.toThrow('No teams available')
    })
  })

  describe('logout()', () => {
    it('should call authApi.logout', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: null })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(mockAuthApi.logout).toHaveBeenCalled()
    })

    it('should clear user, team, and teams state', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: null })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.user).not.toBeNull()
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.team).toBeNull()
      expect(result.current.teams).toEqual([])
    })
  })

  describe('selectTeam()', () => {
    it('should call teamsApi.switchTeam', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: null })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam, testTeam2] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.selectTeam(testTeam2)
      })

      expect(mockTeamsApi.switchTeam).toHaveBeenCalledWith('team-2')
    })

    it('should update team state', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: null })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam, testTeam2] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.team?.id).toBe('team-1')
      })

      await act(async () => {
        await result.current.selectTeam(testTeam2)
      })

      expect(result.current.team).toEqual(testTeam2)
    })
  })

  describe('isAuthenticated', () => {
    it('should be true when user and team exist', async () => {
      mockApiClient.getToken.mockReturnValue('token')
      mockAuthApi.getSession.mockResolvedValue({ user: testUser, session: null })
      mockTeamsApi.getTeams.mockResolvedValue({ data: [testTeam] })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should be false when user is null', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('useAuth hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      spy.mockRestore()
    })

    it('should return context value when inside provider', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current).toHaveProperty('user')
      expect(result.current).toHaveProperty('team')
      expect(result.current).toHaveProperty('teams')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('isAuthenticated')
      expect(result.current).toHaveProperty('login')
      expect(result.current).toHaveProperty('logout')
      expect(result.current).toHaveProperty('selectTeam')
    })
  })
})

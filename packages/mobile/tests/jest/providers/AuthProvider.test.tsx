import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { AuthProvider, useAuth } from '../../../src/providers/AuthProvider'
import { apiClient } from '../../../src/api/client'
import { authApi, teamsApi } from '../../../src/api/core'
import { ApiError } from '../../../src/api/client.types'

// Mock the API modules
jest.mock('../../../src/api/client')
jest.mock('../../../src/api/core')

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.init as jest.Mock).mockResolvedValue(undefined)
    ;(apiClient.getToken as jest.Mock).mockReturnValue(null)
    ;(apiClient.getStoredUser as jest.Mock).mockReturnValue(null)
    ;(apiClient.getStoredTeam as jest.Mock).mockReturnValue(null)
    ;(apiClient.setTeam as jest.Mock).mockResolvedValue(undefined)
  })

  it('provides auth context', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('handles login', async () => {
    const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' }
    const mockTeam = { id: 'team-1', name: 'Test Team' }

    ;(authApi.login as jest.Mock).mockResolvedValue({ user: mockUser })
    ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [mockTeam] })
    ;(teamsApi.switchTeam as jest.Mock).mockResolvedValue({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.team).toEqual(mockTeam)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('handles passwordless login (request code, then sign in with it)', async () => {
    const mockUser = { id: 'user-2', name: 'Ada', email: 'ada@example.com' }
    const mockTeam = { id: 'team-2', name: 'Ada Team' }

    ;(authApi.sendOtp as jest.Mock).mockResolvedValue(undefined)
    ;(authApi.loginWithOtp as jest.Mock).mockResolvedValue({ user: mockUser, token: 'tok' })
    ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [mockTeam] })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.requestOtp('ada@example.com')
    })
    expect(authApi.sendOtp).toHaveBeenCalledWith('ada@example.com')
    expect(result.current.isAuthenticated).toBe(false)

    await act(async () => {
      await result.current.loginWithOtp('ada@example.com', '123456')
    })

    expect(authApi.loginWithOtp).toHaveBeenCalledWith('ada@example.com', '123456')
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.team).toEqual(mockTeam)
    expect(result.current.isAuthenticated).toBe(true)
    expect(apiClient.setTeam).toHaveBeenCalledWith(mockTeam)
  })

  it('handles logout', async () => {
    ;(authApi.logout as jest.Mock).mockResolvedValue({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  describe('session restore', () => {
    const storedUser = { id: 'user-1', name: 'Stored User', email: 'stored@example.com' }
    const storedTeam = { id: 'team-1', name: 'Stored Team', role: 'member' }

    beforeEach(() => {
      ;(apiClient.getToken as jest.Mock).mockReturnValue('stored-token')
      ;(apiClient.getStoredUser as jest.Mock).mockReturnValue(storedUser)
      ;(apiClient.getStoredTeam as jest.Mock).mockReturnValue(storedTeam)
    })

    it('restores user and team from the server when it answers', async () => {
      const freshUser = { ...storedUser, name: 'Fresh User' }
      ;(authApi.getSession as jest.Mock).mockResolvedValue({ user: freshUser })
      ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [storedTeam] })
      ;(apiClient.getTeamId as jest.Mock).mockReturnValue('team-1')

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toEqual(freshUser)
      expect(result.current.team).toEqual(storedTeam)
      expect(result.current.isAuthenticated).toBe(true)
      expect(apiClient.setTeam).toHaveBeenCalledWith(storedTeam)
    })

    it('keeps user AND team from storage when the server is unreachable', async () => {
      ;(authApi.getSession as jest.Mock).mockRejectedValue(new TypeError('Network request failed'))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toEqual(storedUser)
      expect(result.current.team).toEqual(storedTeam)
      expect(result.current.teams).toEqual([storedTeam])
      expect(result.current.isAuthenticated).toBe(true)
      expect(apiClient.clearAuth).not.toHaveBeenCalled()
    })

    it('stays unauthenticated offline when no team was ever stored', async () => {
      ;(apiClient.getStoredTeam as jest.Mock).mockReturnValue(null)
      ;(authApi.getSession as jest.Mock).mockRejectedValue(new TypeError('Network request failed'))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.user).toEqual(storedUser)
      expect(result.current.team).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('clears everything on a 401', async () => {
      ;(authApi.getSession as jest.Mock).mockRejectedValue(new ApiError('Unauthorized', 401))
      ;(apiClient.clearAuth as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(apiClient.clearAuth).toHaveBeenCalled()
      expect(result.current.user).toBeNull()
      expect(result.current.team).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('refreshSession confirms an offline-restored session once the server answers', async () => {
      ;(authApi.getSession as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.isAuthenticated).toBe(true)

      const otherTeam = { id: 'team-2', name: 'Other Team', role: 'member' }
      ;(authApi.getSession as jest.Mock).mockResolvedValue({ user: storedUser })
      ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [storedTeam, otherTeam] })
      ;(apiClient.getTeamId as jest.Mock).mockReturnValue('team-1')

      await act(async () => {
        await result.current.refreshSession()
      })

      expect(result.current.teams).toEqual([storedTeam, otherTeam])
      expect(result.current.team).toEqual(storedTeam)
      expect(result.current.isLoading).toBe(false)
    })

    it('refreshSession drops the restored team when the server says there is none', async () => {
      ;(authApi.getSession as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

      ;(authApi.getSession as jest.Mock).mockResolvedValue({ user: storedUser })
      ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [] })

      await act(async () => {
        await result.current.refreshSession()
      })

      expect(result.current.team).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  it('persists the selected team as a full record', async () => {
    const newTeam = { id: 'team-9', name: 'Nine', role: 'owner' }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.selectTeam(newTeam)
    })

    expect(apiClient.setTeam).toHaveBeenCalledWith(newTeam)
    expect(result.current.team).toEqual(newTeam)
  })

  describe('login while another session is active', () => {
    const userA = { id: 'user-a', name: 'A', email: 'a@example.com' }
    const teamA = { id: 'team-a', name: 'Team A', role: 'member' }
    const userB = { id: 'user-b', name: 'B', email: 'b@example.com' }
    const teamB = { id: 'team-b', name: 'Team B', role: 'member' }

    beforeEach(() => {
      ;(apiClient.getToken as jest.Mock).mockReturnValue('token-a')
      ;(apiClient.getStoredUser as jest.Mock).mockReturnValue(userA)
      ;(authApi.getSession as jest.Mock).mockResolvedValue({ user: userA })
      ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [teamA] })
      ;(apiClient.getTeamId as jest.Mock).mockReturnValue('team-a')
      ;(teamsApi.switchTeam as jest.Mock).mockResolvedValue(undefined)
    })

    it('never renders the new user paired with the previous team', async () => {
      const renders: Array<{ user: string | undefined; team: string | undefined }> = []
      const { result } = renderHook(
        () => {
          const auth = useAuth()
          renders.push({ user: auth.user?.id, team: auth.team?.id })
          return auth
        },
        { wrapper }
      )
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

      ;(authApi.login as jest.Mock).mockResolvedValue({ user: userB })
      ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [teamB] })

      await act(async () => {
        await result.current.login('b@example.com', 'password')
      })

      expect(result.current.user).toEqual(userB)
      expect(result.current.team).toEqual(teamB)
      expect(renders).not.toContainEqual({ user: 'user-b', team: 'team-a' })
    })

    it('leaves the previous session untouched when the login fails', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

      ;(authApi.login as jest.Mock).mockResolvedValue({ user: userB })
      ;(teamsApi.getTeams as jest.Mock).mockResolvedValue({ data: [] })

      await act(async () => {
        await expect(result.current.login('b@example.com', 'password')).rejects.toThrow(
          'No teams available'
        )
      })

      expect(result.current.user).toEqual(userA)
      expect(result.current.team).toEqual(teamA)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })
  })
})

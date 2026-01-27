import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { AuthProvider, useAuth } from '../../../src/providers/AuthProvider'
import { apiClient } from '../../../src/api/client'
import { authApi, teamsApi } from '../../../src/api/core'

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
})

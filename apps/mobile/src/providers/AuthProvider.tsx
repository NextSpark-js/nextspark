/**
 * Authentication Provider
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { apiClient, ApiError } from '../api/client'
import { authApi, teamsApi } from '../api/core'
import type { User, Team } from '../api/core/types'

interface AuthContextValue {
  user: User | null
  team: Team | null
  teams: Team[]
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectTeam: (team: Team) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        await apiClient.init()

        // Check if we have stored credentials
        const hasToken = apiClient.getToken()
        const storedUser = apiClient.getStoredUser()

        if (hasToken || storedUser) {
          // Try to validate session with server and get fresh user data
          const sessionResponse = await authApi.getSession()

          if (sessionResponse?.user) {
            // Session is valid, use fresh user data
            setUser(sessionResponse.user)
          } else if (storedUser) {
            // Session call failed but we have stored user - try to use it
            // This allows offline-first behavior
            setUser(storedUser)
          } else {
            // No valid session and no stored user - clear auth
            await apiClient.clearAuth()
            return
          }

          // Get teams and restore team selection
          const teamsResponse = await teamsApi.getTeams()
          setTeams(teamsResponse.data)

          if (teamsResponse.data.length > 0) {
            // Check if we have a stored team ID
            const storedTeamId = apiClient.getTeamId()
            const storedTeam = teamsResponse.data.find(t => t.id === storedTeamId)

            if (storedTeam) {
              setTeam(storedTeam)
            } else {
              // Select first team by default
              const firstTeam = teamsResponse.data[0]
              await teamsApi.switchTeam(firstTeam.id)
              setTeam(firstTeam)
            }
          }
        }
      } catch (error) {
        // Only clear auth for authentication failures (401)
        // For network errors or other issues, keep credentials to allow retry
        if (error instanceof ApiError && error.status === 401) {
          await apiClient.clearAuth()
        } else {
          console.warn('[AuthProvider] Init failed (network or server error):', error)
          // Try to use stored user for offline-first behavior
          const storedUser = apiClient.getStoredUser()
          if (storedUser) {
            setUser(storedUser)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)

    try {
      // Login to get token
      const loginResponse = await authApi.login(email, password)
      setUser(loginResponse.user)

      // Get user's teams
      const teamsResponse = await teamsApi.getTeams()
      setTeams(teamsResponse.data)

      if (teamsResponse.data.length === 0) {
        throw new ApiError('No teams available', 400)
      }

      // Select first team
      const firstTeam = teamsResponse.data[0]
      await teamsApi.switchTeam(firstTeam.id)
      setTeam(firstTeam)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    setTeam(null)
    setTeams([])
  }, [])

  const selectTeam = useCallback(async (newTeam: Team) => {
    await teamsApi.switchTeam(newTeam.id)
    setTeam(newTeam)
  }, [])

  const value: AuthContextValue = {
    user,
    team,
    teams,
    isLoading,
    isAuthenticated: !!user && !!team,
    login,
    logout,
    selectTeam,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

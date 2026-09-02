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
import { apiClient } from '../api/client'
import { ApiError } from '../api/client.types'
import { authApi, teamsApi } from '../api/core'
import type { User, Team } from '../api/core/types'

interface AuthContextValue {
  user: User | null
  team: Team | null
  teams: Team[]
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  /** Passwordless step 1: email a one-time sign-in code. */
  requestOtp: (email: string) => Promise<void>
  /** Passwordless step 2: sign in with the emailed code (creates the account on first use). */
  loginWithOtp: (email: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  selectTeam: (team: Team) => Promise<void>
  /**
   * Re-validate the session with the server without toggling `isLoading`.
   * Meant for "connectivity is back" / "app returned to foreground": a session
   * restored offline gets confirmed (fresh user + teams) or cleared (401).
   */
  refreshSession: () => Promise<void>
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

  /**
   * Persist the active team as a full record (id + record) so an offline
   * start can restore it. Split from `applyTeam` so callers that need to
   * commit several state setters in the same render (e.g. `login`) can await
   * the persistence first and batch the `setState` calls together after.
   */
  const persistTeam = useCallback(async (nextTeam: Team) => {
    await apiClient.setTeam(nextTeam)
  }, [])

  const applyTeam = useCallback(
    async (nextTeam: Team) => {
      await persistTeam(nextTeam)
      setTeam(nextTeam)
    },
    [persistTeam]
  )

  /**
   * Restore the session from storage and validate it with the server.
   *
   * Offline-first: when the server cannot be reached (anything but a 401) the
   * stored user AND the stored team are kept, so `isAuthenticated` stays true
   * and the app keeps working on cached data until `refreshSession()` gets an
   * answer. Only a 401 clears the credentials.
   */
  const restoreSession = useCallback(async () => {
    try {
      await apiClient.init()

      // Check if we have stored credentials
      const hasToken = apiClient.getToken()
      const storedUser = apiClient.getStoredUser()

      if (!hasToken && !storedUser) return

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

        // Prefer the stored team; otherwise the first one
        await applyTeam(storedTeam ?? teamsResponse.data[0])
      } else {
        // Membership list is authoritative when the server answers: no teams
        // means no active team, even if one was stored
        setTeam(null)
      }
    } catch (error) {
      // Only clear auth for authentication failures (401)
      // For network errors or other issues, keep credentials to allow retry
      if (error instanceof ApiError && error.status === 401) {
        await apiClient.clearAuth()
        setUser(null)
        setTeam(null)
        setTeams([])
      } else {
        console.warn('[AuthProvider] Init failed (network or server error):', error)
        // Use the stored user AND team for offline-first behavior: without the
        // team, `isAuthenticated` would read false and the app would send a
        // user with a perfectly valid session back to login
        const storedUser = apiClient.getStoredUser()
        const storedTeam = apiClient.getStoredTeam()
        if (storedUser) {
          setUser(storedUser)
          if (storedTeam) {
            setTeam(storedTeam)
            setTeams(teams => (teams.some(t => t.id === storedTeam.id) ? teams : [storedTeam]))
          }
        }
      }
    }
  }, [applyTeam])

  // Initialize auth state from storage
  useEffect(() => {
    restoreSession().finally(() => setIsLoading(false))
  }, [restoreSession])

  const refreshSession = useCallback(async () => {
    await restoreSession()
  }, [restoreSession])

  /**
   * Shared tail of every sign-in method: load the teams, persist the first
   * one and commit user + teams + team together once everything succeeded, so
   * no render ever pairs the new user with the previous session's team and a
   * failed login leaves the previous state untouched.
   */
  const completeSignIn = useCallback(
    async (signedInUser: User) => {
      // Get user's teams
      const teamsResponse = await teamsApi.getTeams()

      if (teamsResponse.data.length === 0) {
        throw new ApiError('No teams available', 400)
      }

      // Select first team. persistTeam() already sets the team id (it wraps
      // apiClient.setTeam, which calls setTeamId internally) — teamsApi.switchTeam()
      // would only repeat that same write, widening the failure window for no benefit.
      const firstTeam = teamsResponse.data[0]
      await persistTeam(firstTeam)

      setUser(signedInUser)
      setTeams(teamsResponse.data)
      setTeam(firstTeam)
    },
    [persistTeam]
  )

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)

      try {
        // Login to get token
        const loginResponse = await authApi.login(email, password)
        await completeSignIn(loginResponse.user)
      } finally {
        setIsLoading(false)
      }
    },
    [completeSignIn]
  )

  const requestOtp = useCallback(async (email: string) => {
    await authApi.sendOtp(email)
  }, [])

  const loginWithOtp = useCallback(
    async (email: string, otp: string) => {
      setIsLoading(true)

      try {
        const otpResponse = await authApi.loginWithOtp(email, otp)
        await completeSignIn(otpResponse.user)
      } finally {
        setIsLoading(false)
      }
    },
    [completeSignIn]
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    setTeam(null)
    setTeams([])
  }, [])

  const selectTeam = useCallback(
    async (newTeam: Team) => {
      await applyTeam(newTeam)
    },
    [applyTeam]
  )

  const value: AuthContextValue = {
    user,
    team,
    teams,
    isLoading,
    isAuthenticated: !!user && !!team,
    login,
    requestOtp,
    loginWithOtp,
    logout,
    selectTeam,
    refreshSession,
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

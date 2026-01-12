'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Team, UserTeamMembership } from '../lib/teams/types'
import { useAuth } from '../hooks/useAuth'
import { TeamSwitchModal } from '../components/teams/TeamSwitchModal'
import { APP_CONFIG_MERGED } from '../lib/config/config-sync'
import { canUserCreateTeam } from '../lib/teams/helpers'

interface TeamContextValue {
  currentTeam: Team | null
  userTeams: UserTeamMembership[]
  isLoading: boolean
  isSwitching: boolean
  canCurrentUserCreateTeam: boolean
  switchTeam: (teamId: string) => Promise<void>
  refreshTeams: () => Promise<void>
}

const TeamContext = createContext<TeamContextValue | undefined>(undefined)

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)
  const [userTeams, setUserTeams] = useState<UserTeamMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)
  const [canCurrentUserCreateTeam, setCanCurrentUserCreateTeam] = useState(true)

  // Modal state for team switching animation
  const [switchModalOpen, setSwitchModalOpen] = useState(false)
  const [previousTeam, setPreviousTeam] = useState<Team | null>(null)
  const [targetTeam, setTargetTeam] = useState<Team | null>(null)

  // Load user teams from API
  const loadUserTeams = useCallback(async () => {
    if (!user) {
      setUserTeams([])
      setCurrentTeam(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/v1/teams')
      const data = await response.json()

      if (response.ok && data.data) {
        // Transform API response to UserTeamMembership format
        const teams: UserTeamMembership[] = data.data.map((t: any) => ({
          team: {
            id: t.id,
            name: t.name,
            slug: t.slug,
            description: t.description,
            ownerId: t.owner_id || t.ownerId,
            avatarUrl: t.avatar_url || t.avatarUrl,
            settings: t.settings || {},
            createdAt: t.created_at || t.createdAt,
            updatedAt: t.updated_at || t.updatedAt
          },
          role: t.userRole || t.user_role || t.role,
          joinedAt: t.joinedAt || t.joined_at
        }))

        setUserTeams(teams)

        // Determine active team (priority: localStorage > first)
        const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('activeTeamId') : null
        const storedTeam = teams.find(t => t.team.id === storedTeamId)
        const activeTeam = storedTeam || teams[0]

        if (activeTeam) {
          setCurrentTeam(activeTeam.team)
          // Always sync localStorage with actual active team
          // This handles: user switch, invalid stored team, first login, etc.
          if (typeof window !== 'undefined' && storedTeamId !== activeTeam.team.id) {
            localStorage.setItem('activeTeamId', activeTeam.team.id)
          }
          // Sync cookie via API for server-side access (layouts, server components)
          // This enables permission validation in [entity]/layout.tsx
          // Cookie is set with httpOnly flag for security
          if (typeof window !== 'undefined') {
            fetch('/api/v1/teams/switch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ teamId: activeTeam.team.id })
            }).catch(err => console.error('Failed to sync team cookie:', err))
          }
        }
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Handle modal completion - refresh router and invalidate cache
  const handleSwitchComplete = useCallback(() => {
    setSwitchModalOpen(false)
    setIsSwitching(false)

    // Clear all TanStack Query cache to ensure fresh data
    queryClient.clear()

    // Dispatch custom event for team switching
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('team-switched', { detail: { teamId: targetTeam?.id } }))
    }

    // Hard reload to ensure all components (Server + Client) get fresh data
    // router.refresh() alone doesn't re-fetch client-side React Query data
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [queryClient, targetTeam])

  // Switch to a different team
  const switchTeam = useCallback(async (teamId: string) => {
    const membership = userTeams.find(t => t.team.id === teamId)
    if (!membership) {
      throw new Error('Team not found or not a member')
    }

    // Don't switch if already on this team
    if (currentTeam?.id === teamId) {
      return
    }

    // Start switching process
    setIsSwitching(true)
    setPreviousTeam(currentTeam)
    setTargetTeam(membership.team)
    setSwitchModalOpen(true)

    // Update the current team immediately
    setCurrentTeam(membership.team)

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeTeamId', teamId)
    }

    // Update session on server
    try {
      await fetch('/api/v1/teams/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      })
    } catch (error) {
      console.error('Failed to update team context on server:', error)
    }
  }, [userTeams, currentTeam])

  // Refresh teams list
  const refreshTeams = useCallback(async () => {
    await loadUserTeams()
  }, [loadUserTeams])

  // Load teams when user changes
  useEffect(() => {
    loadUserTeams()
  }, [loadUserTeams])

  // Calculate if current user can create teams
  useEffect(() => {
    if (!user || !userTeams) {
      setCanCurrentUserCreateTeam(false)
      return
    }

    const { mode, options } = APP_CONFIG_MERGED.teams
    const ownedTeamsCount = userTeams.filter(m => m.role === 'owner').length
    const canCreate = canUserCreateTeam(mode, options || {}, ownedTeamsCount)
    setCanCurrentUserCreateTeam(canCreate)
  }, [userTeams, user])

  return (
    <TeamContext.Provider
      value={{
        currentTeam,
        userTeams,
        isLoading,
        isSwitching,
        canCurrentUserCreateTeam,
        switchTeam,
        refreshTeams
      }}
    >
      {children}
      <TeamSwitchModal
        isOpen={switchModalOpen}
        fromTeam={previousTeam}
        toTeam={targetTeam}
        onComplete={handleSwitchComplete}
      />
    </TeamContext.Provider>
  )
}

export function useTeamContext() {
  const context = useContext(TeamContext)
  if (context === undefined) {
    throw new Error('useTeamContext must be used within TeamProvider')
  }
  return context
}

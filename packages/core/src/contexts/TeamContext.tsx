'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

// Query key for teams data
export const TEAMS_QUERY_KEY = ['user-teams'] as const

// Fetch function for teams (can be reused for prefetching)
export async function fetchUserTeams(): Promise<UserTeamMembership[]> {
  const response = await fetch('/api/v1/teams')
  const data = await response.json()

  if (!response.ok || !data.data) {
    throw new Error('Failed to fetch teams')
  }

  // Transform API response to UserTeamMembership format
  return data.data.map((t: any) => ({
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
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)

  // Modal state for team switching animation
  const [switchModalOpen, setSwitchModalOpen] = useState(false)
  const [previousTeam, setPreviousTeam] = useState<Team | null>(null)
  const [targetTeam, setTargetTeam] = useState<Team | null>(null)

  // Use TanStack Query for teams data with caching
  const {
    data: userTeams = [],
    isLoading: teamsLoading,
    refetch: refetchTeams
  } = useQuery<UserTeamMembership[]>({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: fetchUserTeams,
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes - prevents refetch on navigation
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    // Automatic safety net for the self-heal above: if a membership change
    // happened while this tab was unfocused (removed from a team, a team
    // soft-deleted elsewhere), returning focus re-fetches userTeams without
    // depending on whatever mutated it remembering to call refreshTeams().
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Don't refetch if data exists and is not stale
  })

  // Combined loading state
  const isLoading = authLoading || teamsLoading

  // Calculate if current user can create teams
  const canCurrentUserCreateTeam = useMemo(() => {
    if (!user || !userTeams.length) return false
    const { mode, options } = APP_CONFIG_MERGED.teams
    const ownedTeamsCount = userTeams.filter(m => m.role === 'owner').length
    return canUserCreateTeam(mode, options || {}, ownedTeamsCount)
  }, [userTeams, user])

  // Initialize current team when teams data loads
  useEffect(() => {
    // Guard: don't run during logout (user null but stale TanStack cache)
    if (!user) return

    // User has genuinely zero team memberships (query resolved, not just
    // still loading) — clear any stale currentTeam/localStorage instead of
    // leaving them pointing at a team the user no longer belongs to. Without
    // this, a user removed from EVERY team (not just their active one) never
    // self-heals: getCurrentTeamId() keeps returning a dead team forever.
    if (!teamsLoading && userTeams.length === 0) {
      if (currentTeam) {
        setCurrentTeam(null)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('activeTeamId')
        }
      }
      return
    }

    // Still loading (or genuinely nothing to do yet) — nothing to heal.
    if (!userTeams.length) return

    // Nothing to heal if the team we're already tracking is still a real,
    // current membership. Re-evaluated every time userTeams changes (not
    // just once) — this is what makes the self-heal re-entrant instead of
    // one-shot: a later out-of-band membership change (someone removed from
    // a team, a team soft-deleted) that updates userTeams triggers this
    // effect again and gets corrected, instead of being silently ignored
    // for the rest of the session. Deliberately keyed off `currentTeam`
    // (the state we've actually synced), not the raw localStorage value —
    // on the very first run currentTeam is still null even when a stored
    // id already resolves to a valid membership, so gating on the stored
    // id here would skip the initial sync entirely.
    if (currentTeam && userTeams.some(t => t.team.id === currentTeam.id)) return

    // Determine active team (priority: localStorage > user's teams)
    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('activeTeamId') : null
    // Only use stored team if user is actually a member of it
    const storedTeam = storedTeamId ? userTeams.find(t => t.team.id === storedTeamId) : null
    const activeTeam = storedTeam || userTeams[0]

    if (activeTeam) {
      setCurrentTeam(activeTeam.team)

      // ALWAYS sync localStorage (critical for getCurrentTeamId())
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeTeamId', activeTeam.team.id)
      }

      // Sync cookie via API for server-side access
      if (typeof window !== 'undefined') {
        fetch('/api/v1/teams/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: activeTeam.team.id })
        }).catch(err => console.error('Failed to sync team cookie:', err))
      }
    }
  }, [user, userTeams, currentTeam, teamsLoading])

  // Clear localStorage and TanStack Query cache when user logs out
  // IMPORTANT: Only run when auth has finished loading (!authLoading) to distinguish
  // actual logout (user=null, authLoading=false) from initial page load (user=null, authLoading=true).
  // Without the authLoading guard, this effect fires on every page reload/navigation,
  // wiping localStorage before the initial sync can read the saved team — causing
  // uploads and queries to always fall back to the user's first team.
  useEffect(() => {
    if (!user && !authLoading) {
      setCurrentTeam(null)
      // Clear team context to prevent leaking to next user session
      if (typeof window !== 'undefined') {
        localStorage.removeItem('activeTeamId')
      }
      // Clear all TanStack Query cache to prevent stale data leaking to next user
      queryClient.clear()
    }
  }, [user, authLoading, queryClient])

  // Handle modal completion - refresh router and invalidate cache
  const handleSwitchComplete = useCallback(() => {
    setSwitchModalOpen(false)
    setIsSwitching(false)

    // Clear all TanStack Query cache to ensure fresh data for the new team
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

  // Refresh teams list - invalidate and refetch.
  //
  // Convention: any endpoint that mutates a team_members row or a team's
  // deletedAt outside the standard switchTeam() flow (removing a member,
  // soft-deleting a team, etc.) should call this — or force a hard
  // navigation — immediately after, so any open tab with that team active
  // doesn't wait out the query's staleTime or a window-focus event to
  // notice. Not the only mechanism: the self-heal effect above and
  // refetchOnWindowFocus on the userTeams query both self-correct on their
  // own even if a call-site forgets this.
  const refreshTeams = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY })
    await refetchTeams()
  }, [queryClient, refetchTeams])

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

'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Team, UserTeamMembership } from '../lib/teams/types'
import { useAuth } from '../hooks/useAuth'
import { TeamSwitchModal } from '../components/teams/TeamSwitchModal'
import { APP_CONFIG_MERGED } from '../lib/config/config-sync'
import { canUserCreateTeam } from '../lib/teams/helpers'
import { withBasePath } from '../lib/base-path'

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

// Query key for teams data, followed by the user's id
export const TEAMS_QUERY_KEY = ['user-teams'] as const

/**
 * The write of the activeTeamId cookie each query client's page has made or is
 * making, for `<session>:<team>`. The dashboard, superadmin and devtools layouts
 * each mount their own TeamProvider over the root layout's query client, so
 * moving between those areas remounts the provider; by then the cookie already
 * names the team, and posting the switch again would only repeat the write. A
 * new session counts as unwritten even for the same team: the cookie is bound
 * to the session that wrote it, and readers ignore it for any other (see
 * lib/teams/active-team-cookie). The write and its retries belong to the page,
 * not to a provider, so remounting one while a write is pending loses neither.
 */
interface ActiveTeamCookieWrite {
  key: string
  failed: boolean
  result: Promise<boolean>
  retryTimer?: ReturnType<typeof setTimeout>
}

const activeTeamCookieWrites = new WeakMap<QueryClient, ActiveTeamCookieWrite>()

/**
 * The switch request each query client's page sent last. A response sets the
 * cookie when it arrives, so two requests on the wire at once could answer in
 * either order and leave the cookie on the team chosen first: each request waits
 * for the one before it to answer.
 */
const activeTeamCookieRequests = new WeakMap<QueryClient, Promise<unknown>>()

/** A failed write is tried this many more times, one second further apart each time. */
const ACTIVE_TEAM_COOKIE_RETRIES = 3

/**
 * A request that never answers would hold back every later one, so it is
 * aborted after this long. The browser discards the response of an aborted
 * request, cookie included, so its late answer cannot overwrite a later choice.
 */
const ACTIVE_TEAM_REQUEST_TIMEOUT_MS = 10_000

function postActiveTeam(teamId: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ACTIVE_TEAM_REQUEST_TIMEOUT_MS)
  return fetch(withBasePath('/api/v1/teams/switch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId }),
    signal: controller.signal
  })
    .then(response => response.ok, error => {
      console.error('Failed to sync team cookie:', error)
      return false
    })
    .finally(() => clearTimeout(timeout))
}

/**
 * Write `teamId` to this session's activeTeamId cookie through the API, or join
 * the write already made or in progress for them. Resolves to whether it
 * succeeded.
 */
function writeActiveTeamCookie(queryClient: QueryClient, sessionKey: string, teamId: string): Promise<boolean> {
  const key = `${sessionKey}:${teamId}`
  const previous = activeTeamCookieWrites.get(queryClient)
  if (previous?.key === key && !previous.failed) return previous.result
  clearTimeout(previous?.retryTimer)

  const write: ActiveTeamCookieWrite = { key, failed: false, result: Promise.resolve(false) }
  const isCurrent = () => activeTeamCookieWrites.get(queryClient) === write
  const attempt = (retry: number): Promise<boolean> => {
    const request = (activeTeamCookieRequests.get(queryClient) ?? Promise.resolve())
      // Replaced while waiting: the newer write sends its own team
      .then(() => (isCurrent() ? postActiveTeam(teamId) : false))
    activeTeamCookieRequests.set(queryClient, request)
    return request.then(ok => {
      // Done, or replaced by a write for another session or team
      if (ok || !isCurrent()) return ok
      if (retry >= ACTIVE_TEAM_COOKIE_RETRIES) {
        write.failed = true
        return false
      }
      return new Promise<boolean>(resolve => {
        write.retryTimer = setTimeout(() => resolve(attempt(retry + 1)), 1000 * (retry + 1))
      })
    })
  }
  activeTeamCookieWrites.set(queryClient, write)
  write.result = attempt(0)
  return write.result
}

/** Drop the write a page made for a session that ended, and any retry it had pending. */
function forgetActiveTeamCookieWrite(queryClient: QueryClient) {
  clearTimeout(activeTeamCookieWrites.get(queryClient)?.retryTimer)
  activeTeamCookieWrites.delete(queryClient)
}

/** Every page the teams API lists is read, up to this many. */
const MAX_TEAM_PAGES = 50

// Fetch function for teams (can be reused for prefetching). It reads every page:
// the team a user joined first, which the server falls back to, need not be on
// the first one.
export async function fetchUserTeams(): Promise<UserTeamMembership[]> {
  const rows: any[] = []
  for (let page = 1; page <= MAX_TEAM_PAGES; page++) {
    const response = await fetch(withBasePath(page === 1 ? '/api/v1/teams' : `/api/v1/teams?page=${page}`))
    const data = await response.json()

    if (!response.ok || !data.data) {
      throw new Error('Failed to fetch teams')
    }

    rows.push(...data.data)
    if (!data.info?.hasNextPage || data.data.length === 0) break
  }

  // A team created while paging can shift the pages and list another twice
  const seen = new Set<string>()
  const uniqueRows: any = rows.filter((t: any) => !seen.has(t.id) && Boolean(seen.add(t.id)))

  // Transform API response to UserTeamMembership format
  return uniqueRows.map((t: any) => ({
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
  const { user, session, isLoading: authLoading } = useAuth()
  // The session the cookie write belongs to (see activeTeamCookieWrites)
  const sessionKey = session?.session?.id ?? user?.id ?? ''
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
    // Per user: the root layout's query client outlives a sign-out that happens
    // while no TeamProvider is mounted, and one user's teams must not reach the next.
    queryKey: [...TEAMS_QUERY_KEY, user?.id ?? null],
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

    // Write the team to this session's activeTeamId cookie, unless this page
    // already did (see activeTeamCookieWrites)
    const syncCookie = (teamId: string) => {
      if (typeof window !== 'undefined') void writeActiveTeamCookie(queryClient, sessionKey, teamId)
    }

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
    if (currentTeam && userTeams.some(t => t.team.id === currentTeam.id)) {
      // The cookie is bound to the session that wrote it, so a new session (a
      // sign-in, a password change that revoked the others) writes it again for
      // the same team.
      syncCookie(currentTeam.id)
      return
    }

    // Determine active team (priority: localStorage > earliest-joined team).
    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('activeTeamId') : null
    // Only use stored team if user is actually a member of it
    const storedTeam = storedTeamId ? userTeams.find(t => t.team.id === storedTeamId) : null
    // #115: falling back to `userTeams[0]` picked whatever order the API
    // response happened to return — for a multi-team user that's effectively
    // random, and since this choice gets written to the server-side cookie
    // below, it silently overrides resolveTeamContext()'s own fallback
    // (dual-auth.ts's getUserDefaultTeamId(): the team with the EARLIEST
    // "joinedAt"). Sorting by the same joinedAt field client-side — already
    // present on every UserTeamMembership — matches that definition exactly,
    // instead of letting the client and server independently improvise two
    // different tie-breaks that can disagree.
    const defaultTeam = storedTeam
      ? undefined
      : [...userTeams].sort(
          (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
        )[0]
    const activeTeam = storedTeam || defaultTeam

    if (activeTeam) {
      setCurrentTeam(activeTeam.team)

      // ALWAYS sync localStorage (critical for getCurrentTeamId())
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeTeamId', activeTeam.team.id)
      }

      // Sync cookie via API for server-side access
      syncCookie(activeTeam.team.id)
    }
  }, [user, userTeams, currentTeam, teamsLoading, queryClient, sessionKey])

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
      forgetActiveTeamCookieWrite(queryClient)
      queryClient.clear()
    }
  }, [user, authLoading, queryClient])

  // Handle modal completion - refresh router and invalidate cache
  const handleSwitchComplete = useCallback(async () => {
    setSwitchModalOpen(false)
    setIsSwitching(false)

    // Reload once the cookie names the new team; reloading earlier renders the
    // page on the server in the previous one
    await activeTeamCookieWrites.get(queryClient)?.result

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

    // Update the team on the server. The sync effect that runs as currentTeam
    // changes joins this same write instead of posting it again.
    if (!(await writeActiveTeamCookie(queryClient, sessionKey, teamId))) {
      console.error('Failed to update team context on server')
    }
  }, [userTeams, currentTeam, queryClient, sessionKey])

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

/**
 * Like useTeamContext(), but returns undefined instead of throwing when no
 * TeamProvider is mounted above. Lets wrappers such as DashboardProviders skip
 * mounting a second TeamProvider when the root layout already provides one.
 */
export function useOptionalTeamContext(): TeamContextValue | undefined {
  return useContext(TeamContext)
}

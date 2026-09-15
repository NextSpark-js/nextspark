'use client'

import { Suspense, useContext } from 'react'
import { QueryClientContext } from '@tanstack/react-query'
import { QueryProvider } from './query-provider'
import { TeamProvider, useOptionalTeamContext } from '../contexts/TeamContext'
import { SubscriptionProvider } from '../contexts/SubscriptionContext'
import { Toaster } from '../components/ui/sonner'

/**
 * DashboardProviders — Client providers needed by authenticated routes.
 *
 * TeamProvider and SubscriptionProvider live here rather than in the root
 * layout, so public pages never fetch a signed-in visitor's teams or
 * subscription, nor re-sync the activeTeamId cookie. The areas that need a
 * team (dashboard, superadmin, devtools) mount them through this component,
 * which also keeps that cookie in sync.
 *
 * What gets mounted depends on the root layout above:
 * - A root layout that provides QueryProvider and Toaster: only the team and
 *   subscription providers, so the app keeps one query cache and toasts are
 *   not shown twice.
 * - An older root layout that already mounts TeamProvider: nothing, since a
 *   second TeamProvider would duplicate the teams fetch, the cookie sync and
 *   the TeamSwitchModal.
 * - A root layout with no providers at all: the full stack, Toaster included.
 *
 * Used by: dashboard/layout.tsx, superadmin/layout.tsx, devtools/layout.tsx
 */
export function DashboardProviders({ children }: { children: React.ReactNode }) {
  const rootTeamContext = useOptionalTeamContext()
  const rootQueryClient = useContext(QueryClientContext)

  if (rootTeamContext) {
    return <>{children}</>
  }

  const teamProviders = (
    <TeamProvider>
      <SubscriptionProvider>{children}</SubscriptionProvider>
    </TeamProvider>
  )

  if (rootQueryClient) {
    return teamProviders
  }

  return (
    <QueryProvider>
      <TeamProvider>
        <SubscriptionProvider>
          {children}
          <Suspense><Toaster position="bottom-left" /></Suspense>
        </SubscriptionProvider>
      </TeamProvider>
    </QueryProvider>
  )
}

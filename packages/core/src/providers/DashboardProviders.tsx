'use client'

import { Suspense } from 'react'
import { QueryProvider } from './query-provider'
import { TeamProvider, useOptionalTeamContext } from '../contexts/TeamContext'
import { SubscriptionProvider } from '../contexts/SubscriptionContext'
import { Toaster } from '../components/ui/sonner'

/**
 * DashboardProviders — Client providers needed by authenticated routes.
 *
 * Since #115 the generated root layout mounts QueryProvider, TeamProvider,
 * SubscriptionProvider and Toaster itself (matching layout.ppr.tsx) so the
 * activeTeamId cookie is synced from any route, not only from the dashboard.
 * When a TeamProvider is already mounted above, this component renders its
 * children as-is: nesting a second TeamProvider would duplicate the teams
 * fetch, the cookie sync and the TeamSwitchModal, and a second Toaster would
 * show every toast twice.
 *
 * The full provider stack is kept as a fallback for apps whose generated root
 * layout predates that change (it originally lived here to keep ~500KB of
 * client JS off public landing pages).
 *
 * Used by: dashboard/layout.tsx, superadmin/layout.tsx, devtools/layout.tsx
 */
export function DashboardProviders({ children }: { children: React.ReactNode }) {
  const rootTeamContext = useOptionalTeamContext()

  if (rootTeamContext) {
    return <>{children}</>
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

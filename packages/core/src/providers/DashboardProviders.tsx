'use client'

import { Suspense } from 'react'
import { QueryProvider } from './query-provider'
import { TeamProvider } from '../contexts/TeamContext'
import { SubscriptionProvider } from '../contexts/SubscriptionContext'
import { Toaster } from '../components/ui/sonner'

/**
 * DashboardProviders — Client providers needed only for authenticated routes.
 *
 * These were moved out of the root layout to avoid loading ~500KB of unused JS
 * (TanStack Query, team context, billing hooks) on public landing pages.
 *
 * Used by: dashboard/layout.tsx, superadmin/layout.tsx, devtools/layout.tsx
 */
export function DashboardProviders({ children }: { children: React.ReactNode }) {
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

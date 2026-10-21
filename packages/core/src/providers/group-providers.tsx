'use client'

import { Suspense, useContext } from 'react'
import { QueryClientContext } from '@tanstack/react-query'
import { QueryProvider } from './query-provider'
import { Toaster } from '../components/ui/sonner'

/**
 * GroupProviders: the app-wide client providers (React Query and the toaster) for a route group that needs them, when
 * the root layout does not mount them (`providers.scope: 'groups'` in app.config).
 *
 * With the root layout's providers above (the default), it renders its children as they are, so wrapping a group in it
 * never creates a second query cache or shows a toast twice. Core's `(auth)` layout, and the dashboard, superadmin and
 * devtools areas (through DashboardProviders), mount it; a project that uses React Query hooks or toasts on a public
 * page wraps that page's layout in it.
 */
export function GroupProviders({ children }: { children: React.ReactNode }) {
  if (useContext(QueryClientContext)) return <>{children}</>

  return (
    <QueryProvider>
      {children}
      <Suspense><Toaster position="bottom-left" /></Suspense>
    </QueryProvider>
  )
}

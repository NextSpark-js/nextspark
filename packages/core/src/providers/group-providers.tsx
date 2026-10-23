'use client'

import { Suspense, useContext } from 'react'
import { QueryClientContext } from '@tanstack/react-query'
import { QueryProvider } from './query-provider'
import { Toaster } from '../components/ui/sonner'
import { GroupToasterContext } from './group-toaster'

/**
 * GroupProviders: the app-wide client providers (React Query and the toaster) for a route group that needs them, when
 * the root layout does not mount them (`providers.scope: 'groups'` in app.config).
 *
 * With the root layout's providers above (the default), it renders its children as they are, so wrapping a group in it
 * never creates a second query cache or shows a toast twice. Under a GroupToaster (core's `(auth)` layout) it adds the
 * query cache and no second toaster. The dashboard, superadmin and devtools areas get both through DashboardProviders;
 * a project that uses React Query hooks or toasts on a public page wraps that page's layout in GroupProviders.
 */
export function GroupProviders({ children }: { children: React.ReactNode }) {
  const toasterAbove = useContext(GroupToasterContext)
  if (useContext(QueryClientContext)) return <>{children}</>

  return (
    <QueryProvider>
      {children}
      {!toasterAbove && <Suspense><Toaster position="bottom-left" /></Suspense>}
    </QueryProvider>
  )
}

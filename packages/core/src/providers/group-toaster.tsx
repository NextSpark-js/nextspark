'use client'

import { createContext, Suspense } from 'react'
import { ROOT_PROVIDERS } from '../lib/config/public-config-client'
import { Toaster } from '../components/ui/sonner'

/** True below a GroupToaster that mounted the group's toaster: GroupProviders then adds none (sonner shows a toast in every toaster). */
export const GroupToasterContext = createContext(false)

/**
 * GroupToaster: the toaster alone, for a route group that shows toasts and needs no React Query (core's `(auth)` layout).
 *
 * With the default scope the root layout already mounts the toaster, so this renders its children as they are and no toast
 * is shown twice; with `providers.scope: 'groups'` it mounts one for the group. A group that also uses React Query hooks
 * wraps its layout in GroupProviders, which mounts no second toaster below this one.
 */
export function GroupToaster({ children }: { children: React.ReactNode }) {
  if (ROOT_PROVIDERS) return <>{children}</>
  return (
    <GroupToasterContext.Provider value>
      {children}
      <Suspense><Toaster position="bottom-left" /></Suspense>
    </GroupToasterContext.Provider>
  )
}

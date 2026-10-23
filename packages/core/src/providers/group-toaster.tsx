'use client'

import { Suspense } from 'react'
import { ROOT_PROVIDERS } from '../lib/config/public-config-client'
import { Toaster } from '../components/ui/sonner'

/**
 * GroupToaster: the toaster alone, for a route group that shows toasts and needs no React Query (core's `(auth)` layout).
 *
 * With the default scope the root layout already mounts the toaster, so this renders its children as they are and no toast
 * is shown twice; with `providers.scope: 'groups'` it mounts one for the group. A group that also uses React Query hooks
 * wraps its layout in GroupProviders instead.
 */
export function GroupToaster({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {!ROOT_PROVIDERS && <Suspense><Toaster position="bottom-left" /></Suspense>}
    </>
  )
}

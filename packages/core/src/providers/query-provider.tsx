'use client'

import { Fragment, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ApiError } from '../lib/api/api-error'
import { registerQueryCache, getQueryCacheEpoch } from '../lib/auth/query-caches'

// NEXT_PUBLIC_RQ_DEVTOOLS is inlined when the app is built. Set to any value other than 'true' (the env template sets false),
// the condition is a constant and the import below does not enter the build; left undefined, the devtools stay an async chunk
// that is never loaded; set to 'true', they load as their own chunk after hydration, never in a route's main JS.
const ReactQueryDevtools =
  process.env.NEXT_PUBLIC_RQ_DEVTOOLS === 'true'
    ? dynamic(() => import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools), { ssr: false })
    : null

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('permissions')
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])

  const handlePermissionDenied = useCallback(() => {
    toast.info(tRef.current('roleChanged'), {
      description: tRef.current('roleChangedDescription'),
    })
    // Reload after a brief delay so the toast is visible
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }, [])

  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false,
        },
      },
      mutationCache: new MutationCache({
        onError: (error) => {
          if (error instanceof ApiError && error.isPermissionDenied()) {
            handlePermissionDenied()
          }
        },
      }),
    })
  // `generation` keys the subtree: a new client needs new observers, which keep the client they were created with.
  const [{ queryClient, generation }, setClient] = useState(() => ({ queryClient: createClient(), generation: 0 }))

  // Signing in empties this cache (useAuthActions), whichever page the sign-in happens on. Cache Components can keep a
  // visited group in <Activity mode="hidden">, which unmounts its effects, registration included, so a sign-in that
  // happens meanwhile does not reach it, and emptying the cache would not either: the hidden observers keep the query
  // they hold. When the group is shown again the layout effect runs (before paint) and, if someone signed in meanwhile,
  // swaps in a new client and remounts the subtree. The registry holds one entry per mounted provider: no growth.
  const seenEpoch = useRef(getQueryCacheEpoch())
  useLayoutEffect(() => {
    if (seenEpoch.current !== getQueryCacheEpoch()) {
      seenEpoch.current = getQueryCacheEpoch()
      queryClient.clear()
      setClient({ queryClient: createClient(), generation: generation + 1 })
      return
    }
    return registerQueryCache(() => {
      queryClient.clear()
      seenEpoch.current = getQueryCacheEpoch()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createClient and generation follow queryClient
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <Fragment key={generation}>{children}</Fragment>
      {ReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ApiError } from '../lib/api/api-error'

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

  const [queryClient] = useState(
    () =>
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
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {ReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
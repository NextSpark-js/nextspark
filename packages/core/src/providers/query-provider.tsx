'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ApiError } from '../lib/api/api-error'

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
        {process.env.NEXT_PUBLIC_RQ_DEVTOOLS === 'true' && (
            <ReactQueryDevtools initialIsOpen={false} />
        )}
    </QueryClientProvider>
  )
}
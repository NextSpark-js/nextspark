'use client'

import { useCallback, useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { withBasePath } from '../lib/base-path'
import { collectHttpUrls, replaceUrls } from '../lib/media/deep-urls'
import { loadCapabilities } from './useMediaUpload'

const MAX_URLS = 50 // the limit of POST /api/v1/media/sign

/**
 * The address to put in an `img`/`video` `src` (or open in a tab) for stored media URLs (#361).
 *
 * With a private bucket (`STORAGE_S3_PRIVATE=true`) the stored URL cannot be loaded by a browser, so the
 * URLs go to `POST /api/v1/media/sign` once per set and each comes back signed; the stored value is never
 * touched. With the mode off (or while the signed URLs load, or for a URL the server does not sign: another
 * origin, another team) it returns the URL it was given, and no request is made.
 */
export function useDisplayUrls(urls: ReadonlyArray<string | null | undefined>): <T extends string | undefined>(url: T) => T {
  const queryClient = useQueryClient()
  const key = useMemo(
    () => [...collectHttpUrls(urls)].sort().slice(0, MAX_URLS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urls.join('\n')]
  )

  // Asked once per QueryClient, shared with the uploads; no answer (e.g. no `media.read`) means no signing
  const mode = useQuery({
    queryKey: ['media', 'private-reads'],
    queryFn: async () => (await loadCapabilities(queryClient))?.privateReads === true,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  const signed = useQuery({
    queryKey: ['media', 'sign', key],
    enabled: mode.data === true && key.length > 0,
    // The URL repeats within half its lifetime, so a refresh on focus after this long costs nothing visible
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await fetch(withBasePath('/api/v1/media/sign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: key }),
      })
      if (!res.ok) throw new Error(`Signing failed with status ${res.status}`)
      return ((await res.json()).data as { signed: Record<string, string> }).signed
    },
  })

  const map = signed.data
  return useCallback(<T extends string | undefined>(url: T): T => (url ? ((map?.[url] ?? url) as T) : url), [map])
}

/** Block props with the stored media URLs swapped for signed ones (the editor canvas renders real blocks). The same object while nothing is signed. */
export function useSignedProps<T>(props: T): T {
  const urls = useMemo(() => [...collectHttpUrls(props)], [props])
  const display = useDisplayUrls(urls)
  return useMemo(() => {
    const map = Object.fromEntries(urls.map((url) => [url, display(url)]).filter(([url, shown]) => url !== shown))
    return Object.keys(map).length > 0 ? replaceUrls(props, map) : props
  }, [props, urls, display])
}

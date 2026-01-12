'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useCallback, useEffect, useRef } from 'react'
import type { HttpMethod } from '../components/devtools/api-tester/types'

export interface UseApiExplorerNavigationOptions {
  /** Base path that precedes the dynamic segments (e.g., '/devtools/api') */
  basePath: string
  /** Optional callback when endpoint changes */
  onEndpointChange?: (method: HttpMethod | null, path: string | null) => void
}

export interface UseApiExplorerNavigationReturn {
  /** Currently selected HTTP method */
  selectedMethod: HttpMethod | null
  /** Currently selected API path (e.g., '/api/v1/customers') */
  selectedPath: string | null
  /** Navigate to an endpoint */
  navigateToEndpoint: (method: HttpMethod, path: string) => void
  /** Clear selection (navigate to base) */
  clearSelection: () => void
}

/**
 * Hook for API Explorer navigation with URL synchronization
 *
 * Provides bidirectional sync between URL pathname and selected endpoint.
 * URL format: {basePath}/{METHOD}/{path}
 *
 * @example
 * ```tsx
 * const {
 *   selectedMethod,
 *   selectedPath,
 *   navigateToEndpoint,
 * } = useApiExplorerNavigation({ basePath: '/devtools/api' })
 *
 * // URL: /devtools/api/GET/api/v1/customers
 * // selectedMethod: 'GET'
 * // selectedPath: '/api/v1/customers'
 * ```
 */
export function useApiExplorerNavigation(
  options: UseApiExplorerNavigationOptions
): UseApiExplorerNavigationReturn {
  const { basePath, onEndpointChange } = options

  const pathname = usePathname()
  const router = useRouter()
  const prevPathnameRef = useRef(pathname)

  // Parse selected endpoint from URL
  const selectedEndpoint = useMemo(() => {
    if (!pathname.startsWith(basePath)) return null
    const relativePath = pathname.slice(basePath.length).replace(/^\//, '')
    if (!relativePath) return null

    const segments = relativePath.split('/')
    if (segments.length < 2) return null

    const method = segments[0] as HttpMethod
    // Validate method
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'].includes(method)) {
      return null
    }

    const path = '/' + segments.slice(1).join('/')
    return { method, path }
  }, [pathname, basePath])

  // Handle URL changes (browser back/forward)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      onEndpointChange?.(selectedEndpoint?.method || null, selectedEndpoint?.path || null)
    }
  }, [pathname, selectedEndpoint, onEndpointChange])

  // Navigate to endpoint
  const navigateToEndpoint = useCallback(
    (method: HttpMethod, path: string) => {
      // Convert /api/v1/customers to api/v1/customers
      const pathSegments = path.replace(/^\//, '')
      const newUrl = `${basePath}/${method}/${pathSegments}`
      router.push(newUrl)
    },
    [basePath, router]
  )

  // Clear selection
  const clearSelection = useCallback(() => {
    router.push(basePath)
  }, [basePath, router])

  return {
    selectedMethod: selectedEndpoint?.method || null,
    selectedPath: selectedEndpoint?.path || null,
    navigateToEndpoint,
    clearSelection,
  }
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Code, Menu, X } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

import { ApiEndpointsSidebar } from './ApiEndpointsSidebar'
import { ApiRequestPanel } from './ApiRequestPanel'
import { ApiResponsePanel } from './ApiResponsePanel'

import { useApiRequest } from '../api-tester/hooks/useApiRequest'
import { useApiExplorerNavigation } from '../../../hooks/useApiExplorerNavigation'
import { extractPathParams, buildUrl } from '../api-tester/utils/url-builder'
import type { ApiRouteEntry, RouteCategory } from '../../../lib/services/api-routes.service'
import type { HttpMethod, AuthType, KeyValuePair, PathParam } from '../api-tester/types'

interface SelectedEndpoint {
  path: string
  method: HttpMethod
  route: ApiRouteEntry
}

interface ApiExplorerProps {
  routes: Record<RouteCategory, ApiRouteEntry[]>
  initialEndpoint?: { method: string; path: string } | null
}

/** Find a route by path in the routes registry */
function findRouteByPath(
  routes: Record<RouteCategory, ApiRouteEntry[]>,
  path: string
): ApiRouteEntry | null {
  for (const category of Object.keys(routes) as RouteCategory[]) {
    const found = routes[category].find((r) => r.path === path)
    if (found) return found
  }
  return null
}

export function ApiExplorer({ routes, initialEndpoint }: ApiExplorerProps) {
  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Selected endpoint
  const [selectedEndpoint, setSelectedEndpoint] = useState<SelectedEndpoint | null>(null)

  // Request form state
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [pathParams, setPathParams] = useState<PathParam[]>([])
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([])
  const [headers, setHeaders] = useState<KeyValuePair[]>([])
  const [authType, setAuthType] = useState<AuthType>('session')
  const [apiKey, setApiKey] = useState('')
  const [bypassMode, setBypassMode] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeTeamId')
    }
    return null
  })
  const [body, setBody] = useState('')

  // Track if we've initialized from URL/initialEndpoint
  const hasInitialized = useRef(false)

  // API request hook
  const { status, response, error, execute, cancel, reset } = useApiRequest()

  // URL navigation hook
  const { selectedMethod: urlMethod, selectedPath: urlPath, navigateToEndpoint } =
    useApiExplorerNavigation({ basePath: '/devtools/api' })

  // Handle endpoint selection - updates URL and local state
  const handleSelectEndpoint = useCallback(
    (path: string, selectedMethod: HttpMethod, route: ApiRouteEntry) => {
      // Reset response when changing endpoints
      reset()

      // Update URL (which will trigger state update via effect)
      navigateToEndpoint(selectedMethod, path)

      // Update local state immediately for responsiveness
      setSelectedEndpoint({ path, method: selectedMethod, route })
      setMethod(selectedMethod)
      setPathParams(extractPathParams(path))
      setQueryParams([])
      setHeaders([])
      setBody('')

      // Close mobile sidebar after selection
      setMobileOpen(false)
    },
    [reset, navigateToEndpoint]
  )

  // Handle send request
  const handleSend = useCallback(async () => {
    if (!selectedEndpoint) return

    const url = buildUrl(selectedEndpoint.path, pathParams, queryParams)
    const fullUrl = (typeof window !== 'undefined' ? window.location.origin : '') + url

    const customHeaders: Record<string, string> = {}

    // Inject bypass header if enabled
    if (bypassMode) {
      customHeaders['x-admin-bypass'] = 'confirm-cross-team-access'
      // In bypass mode, team is optional (for filtering specific team)
      if (selectedTeamId) {
        customHeaders['x-team-id'] = selectedTeamId
      }
    } else {
      // Normal mode: use selected team from dropdown
      if (selectedTeamId) {
        customHeaders['x-team-id'] = selectedTeamId
      }
    }

    // User-defined headers can override the auto-injected ones
    for (const h of headers) {
      if (h.enabled && h.key) {
        customHeaders[h.key] = h.value
      }
    }

    await execute({
      url: fullUrl,
      method,
      headers: customHeaders,
      body: ['POST', 'PATCH', 'PUT'].includes(method) ? body : undefined,
      authType,
      apiKey: authType === 'apiKey' ? apiKey : undefined,
    })
  }, [selectedEndpoint, pathParams, queryParams, headers, method, body, authType, apiKey, bypassMode, selectedTeamId, execute])

  // Sync state from URL changes (browser back/forward)
  useEffect(() => {
    if (urlPath && urlMethod) {
      const route = findRouteByPath(routes, urlPath)
      if (route && (selectedEndpoint?.path !== urlPath || selectedEndpoint?.method !== urlMethod)) {
        // URL changed, update local state
        setSelectedEndpoint({ path: urlPath, method: urlMethod, route })
        setMethod(urlMethod)
        setPathParams(extractPathParams(urlPath))
        setQueryParams([])
        setHeaders([])
        setBody('')
      }
    }
  }, [urlPath, urlMethod, routes, selectedEndpoint])

  // Initialize from URL, initialEndpoint prop, or first endpoint
  useEffect(() => {
    if (hasInitialized.current) return

    // 1. Try URL first (already handled by URL hook)
    if (urlPath && urlMethod) {
      const route = findRouteByPath(routes, urlPath)
      if (route) {
        hasInitialized.current = true
        setSelectedEndpoint({ path: urlPath, method: urlMethod, route })
        setMethod(urlMethod)
        setPathParams(extractPathParams(urlPath))
        return
      }
    }

    // 2. Try initialEndpoint prop (from server-side URL parsing)
    if (initialEndpoint) {
      const route = findRouteByPath(routes, initialEndpoint.path)
      if (route) {
        hasInitialized.current = true
        const endpointMethod = initialEndpoint.method as HttpMethod
        setSelectedEndpoint({ path: initialEndpoint.path, method: endpointMethod, route })
        setMethod(endpointMethod)
        setPathParams(extractPathParams(initialEndpoint.path))
        // Navigate to update URL if not already there
        if (!urlPath) {
          navigateToEndpoint(endpointMethod, initialEndpoint.path)
        }
        return
      }
    }

    // 3. Fall back to first available endpoint
    const categories: RouteCategory[] = ['core', 'entity', 'theme', 'plugin']
    for (const category of categories) {
      const categoryRoutes = routes[category]
      if (categoryRoutes.length > 0) {
        hasInitialized.current = true
        const firstRoute = categoryRoutes[0]
        const firstMethod = (firstRoute.methods[0] || 'GET') as HttpMethod
        setSelectedEndpoint({ path: firstRoute.path, method: firstMethod, route: firstRoute })
        setMethod(firstMethod)
        setPathParams(extractPathParams(firstRoute.path))
        navigateToEndpoint(firstMethod, firstRoute.path)
        break
      }
    }
  }, [routes, initialEndpoint, urlPath, urlMethod, navigateToEndpoint])

  const totalRoutes = Object.values(routes).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden" data-cy={sel('devtools.apiExplorer.container')}>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b flex items-center px-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-cy={sel('devtools.apiExplorer.mobileToggle')}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-violet-600" />
          <span className="font-semibold">API Explorer</span>
        </div>
        {selectedEndpoint && (
          <code className="text-xs text-muted-foreground truncate ml-auto">
            {selectedEndpoint.method} {selectedEndpoint.path}
          </code>
        )}
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed lg:relative z-50 lg:z-auto h-full transition-transform duration-300',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <ApiEndpointsSidebar
          routes={routes}
          selectedEndpoint={
            selectedEndpoint ? { path: selectedEndpoint.path, method: selectedEndpoint.method } : null
          }
          onSelectEndpoint={handleSelectEndpoint}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0 pt-14 lg:pt-0">
        {selectedEndpoint ? (
          <>
            {/* Request Panel - Top on mobile, Left on desktop */}
            <div className="flex-1 lg:flex-[1.2] min-h-0 border-b lg:border-b-0 lg:border-r overflow-hidden">
              <ApiRequestPanel
                route={selectedEndpoint.route}
                basePath={selectedEndpoint.path}
                method={method}
                pathParams={pathParams}
                queryParams={queryParams}
                headers={headers}
                authType={authType}
                apiKey={apiKey}
                bypassMode={bypassMode}
                selectedTeamId={selectedTeamId}
                body={body}
                status={status}
                onMethodChange={setMethod}
                onPathParamsChange={setPathParams}
                onQueryParamsChange={setQueryParams}
                onHeadersChange={setHeaders}
                onAuthTypeChange={setAuthType}
                onApiKeyChange={setApiKey}
                onBypassModeChange={setBypassMode}
                onTeamChange={setSelectedTeamId}
                onBodyChange={setBody}
                onSend={handleSend}
                onCancel={cancel}
              />
            </div>

            {/* Response Panel - Bottom on mobile, Right on desktop */}
            <div className="h-[40vh] lg:h-auto lg:flex-1 min-h-[200px] overflow-hidden">
              <ApiResponsePanel
                status={status}
                response={response}
                error={error}
              />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No endpoint selected</p>
              <p className="text-sm">
                {totalRoutes > 0
                  ? 'Select an endpoint from the sidebar to get started'
                  : 'No API endpoints available'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

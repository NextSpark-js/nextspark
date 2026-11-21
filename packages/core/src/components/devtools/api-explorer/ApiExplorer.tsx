'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Code, Menu, X } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

import { ApiEndpointsSidebar } from './ApiEndpointsSidebar'
import { ApiRequestPanel } from './ApiRequestPanel'
import { ApiResponsePanel } from './ApiResponsePanel'
import { PanelDivider } from './PanelDivider'

import { useApiRequest } from '../api-tester/hooks/useApiRequest'
import { useApiExplorerNavigation } from '../../../hooks/useApiExplorerNavigation'
import { extractPathParams, buildUrl } from '../api-tester/utils/url-builder'
import type { ApiRouteEntry, RouteCategory } from '../../../lib/services/api-routes.service'
import type { HttpMethod, AuthType, KeyValuePair, PathParam } from '../api-tester/types'
import type { ApiPreset } from '../../../types/api-presets'
import { ApiPresetsService } from '../../../lib/services/api-presets.service'
import { ApiDocsService } from '../../../lib/services/api-docs.service'
import { loadState, saveState, draftKey } from './explorer-storage'
import {
  BODY_METHODS,
  buildCurl,
  buildRequestHeaders,
  createEmptyRows,
  defaultMethod,
  initialBody,
  pickDefaultTeamId,
  pushRecent,
  queryToSearch,
  searchToRows,
  type RecentRequest,
  type RequestContext,
} from './explorer-helpers'
import { useUserTeams } from '../../../hooks/teams'
import {
  createPresetPlaceholderValues,
  readPresetRunToken,
  regeneratePresetRunToken,
  resolvePresetPlaceholders,
} from './preset-placeholders'
import { withBasePath } from '../../../lib/base-path'

interface SelectedEndpoint {
  path: string
  method: HttpMethod
  route: ApiRouteEntry
}

/** Per-endpoint request inputs persisted so switching endpoints keeps your work. */
interface EndpointDraft {
  pathParams?: PathParam[]
  queryParams?: KeyValuePair[]
  headers?: KeyValuePair[]
  body?: string
}

interface ApiExplorerProps {
  routes: Record<RouteCategory, ApiRouteEntry[]>
  initialEndpoint?: { method: string; path: string } | null
  /** Required-field JSON for creating each entity, by collection path (built on the server from the entity configs). */
  bodySkeletons?: Record<string, Record<string, unknown>>
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

export function ApiExplorer({ routes, initialEndpoint, bodySkeletons }: ApiExplorerProps) {
  const t = useTranslations('devtools.api')
  // Sidebar state (collapse persisted)
  const [isCollapsed, setIsCollapsed] = useState(() => loadState<boolean>('sidebarCollapsed') ?? false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Selected endpoint
  const [selectedEndpoint, setSelectedEndpoint] = useState<SelectedEndpoint | null>(null)

  // Request form state
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [pathParams, setPathParams] = useState<PathParam[]>([])
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>(() => createEmptyRows())
  const [headers, setHeaders] = useState<KeyValuePair[]>(() => createEmptyRows())
  // Session/auth config is persisted (see effect below) so it survives reloads.
  const [authType, setAuthType] = useState<AuthType>(() => loadState<AuthType>('authType') ?? 'session')
  const [apiKey, setApiKey] = useState(() => loadState<string>('apiKey') ?? '')
  const [bypassMode, setBypassMode] = useState(() => loadState<boolean>('bypassMode') ?? false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    const saved = loadState<string>('selectedTeamId')
    if (saved) return saved
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeTeamId')
    }
    return null
  })
  const [body, setBody] = useState('')
  // Raised by a send with no team, not by loading the screen (see handleSend and the effect below).
  const [teamErrorShown, setTeamErrorShown] = useState(false)
  // Optional act-as-user override for the request (persisted; the server strictly gates it)
  const [actAsUserId, setActAsUserId] = useState(() => loadState<string>('actAsUserId') ?? '')
  // What to show for that id (the user's email), kept with it so the chip and the response can name the user.
  const [actAsLabel, setActAsLabel] = useState(() => loadState<string>('actAsLabel') ?? '')
  const handleActAsChange = useCallback((id: string, label: string) => {
    setActAsUserId(id)
    setActAsLabel(label)
  }, [])
  // How the last request was made, captured at send time (see handleSend).
  const [requestContext, setRequestContext] = useState<RequestContext | null>(null)
  // The last requests sent from this browser (20), and the one in flight, which joins the list when it answers.
  const [recent, setRecent] = useState<RecentRequest[]>(() => loadState<RecentRequest[]>('recent') ?? [])
  const sentRef = useRef<RecentRequest | null>(null)

  // How the request/response split is divided, as a percentage of the row. Persisted, because a
  // layout someone chose for the work they are doing should survive a reload of that same work.
  const [splitPercent, setSplitPercent] = useState(55)
  const splitRowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const saved = loadState<number>('splitPercent')
    if (typeof saved === 'number') setSplitPercent(saved)
  }, [])
  const handleSplitChange = useCallback((percent: number) => {
    setSplitPercent(percent)
    saveState('splitPercent', percent)
  }, [])
  // The split only exists side by side. Below `lg` the panels stack, where a width would mean
  // nothing and a flex-basis would silently become a height. Tracked in JS rather than through a
  // utility class because the value is inline, and an inline style cannot carry a media query.
  const [isSideBySide, setIsSideBySide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsSideBySide(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // Track which tabs were modified by a preset (for visual indicator)
  const [tabsModifiedByPreset, setTabsModifiedByPreset] = useState<Set<'params' | 'headers' | 'body'>>(
    () => new Set()
  )

  // Get presets and docs for selected endpoint
  const endpointPresets = useMemo(() => {
    if (!selectedEndpoint) return undefined
    return ApiPresetsService.getByEndpoint(selectedEndpoint.path)
  }, [selectedEndpoint?.path])

  const endpointDoc = useMemo(() => {
    if (!selectedEndpoint) return undefined
    return ApiDocsService.getByEndpoint(selectedEndpoint.path)
  }, [selectedEndpoint?.path])

  // Track if we've initialized from URL/initialEndpoint
  const hasInitialized = useRef(false)

  // API request hook
  const { status, response, error, execute, cancel, reset } = useApiRequest()

  // URL navigation hook
  const { selectedMethod: urlMethod, selectedPath: urlPath, navigateToEndpoint } =
    useApiExplorerNavigation({ basePath: '/devtools/api' })

  // Load an endpoint's persisted request draft (or sensible defaults) into state.
  // `fromUrl`: the endpoint came from the address bar, so the query string it carries wins over the saved draft.
  const applyEndpointState = useCallback((endpointMethod: HttpMethod, path: string, fromUrl = false) => {
    const draft = loadState<EndpointDraft>(draftKey(endpointMethod, path))
    const urlRows = fromUrl && typeof window !== 'undefined' ? searchToRows(window.location.search) : []
    setPathParams(draft?.pathParams ?? extractPathParams(path))
    setQueryParams(urlRows.length ? [...urlRows, ...createEmptyRows()] : draft?.queryParams ?? createEmptyRows())
    setHeaders(draft?.headers ?? createEmptyRows())
    // An endpoint opened with nothing typed starts from its first preset or its required fields, not blank.
    setBody(
      draft?.body?.trim()
        ? draft.body
        : initialBody(endpointMethod, ApiPresetsService.getByEndpoint(path)?.presets, bodySkeletons?.[path])
    )
    setTabsModifiedByPreset(new Set())
  }, [bodySkeletons])

  // Persist session/auth config so it survives reloads.
  useEffect(() => {
    saveState('authType', authType)
    saveState('apiKey', apiKey)
    saveState('bypassMode', bypassMode)
    saveState('selectedTeamId', selectedTeamId)
    saveState('actAsUserId', actAsUserId)
    saveState('actAsLabel', actAsLabel)
  }, [authType, apiKey, bypassMode, selectedTeamId, actAsUserId, actAsLabel])

  // A team is preselected: the last one used (restored above), else the dashboard's active team, else
  // the user's only team. Read-only for a team already set, and not applied in cross-team mode, where
  // "no team" is a choice.
  const { teams: userTeams, isLoading: teamsLoading } = useUserTeams()
  useEffect(() => {
    if (bypassMode || selectedTeamId || teamsLoading) return
    const active = typeof window !== 'undefined' ? localStorage.getItem('activeTeamId') : null
    const picked = pickDefaultTeamId(userTeams, selectedTeamId, active)
    if (picked) setSelectedTeamId(picked)
  }, [bypassMode, selectedTeamId, teamsLoading, userTeams])
  useEffect(() => {
    if (selectedTeamId || bypassMode) setTeamErrorShown(false)
  }, [selectedTeamId, bypassMode])

  // Persist whether the sidebar is collapsed.
  useEffect(() => {
    saveState('sidebarCollapsed', isCollapsed)
  }, [isCollapsed])

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
      // Restore this endpoint's saved draft (or defaults)
      applyEndpointState(selectedMethod, path)
      saveState('lastEndpoint', { method: selectedMethod, path })

      // Close mobile sidebar after selection
      setMobileOpen(false)
    },
    [reset, navigateToEndpoint, applyEndpointState]
  )

  // Handle send request
  const handleSend = useCallback(async () => {
    if (!selectedEndpoint) return

    const url = buildUrl(selectedEndpoint.path, pathParams, queryParams)
    const fullUrl = (typeof window !== 'undefined' ? window.location.origin : '') + withBasePath(url)

    // Team context is only complained about here, once a request goes out without one.
    setTeamErrorShown(!bypassMode && !selectedTeamId)

    // Bypass (cross-team: the team is then an optional filter), team, and the act-as override (the Core
    // auth layer gates it strictly: developer role + non-prod + flag), then the user's own headers on top.
    const customHeaders = buildRequestHeaders({ bypassMode, selectedTeamId, actAsUserId, headers })
    sentRef.current = {
      method,
      path: selectedEndpoint.path,
      pathParams: Object.fromEntries(pathParams.map((p) => [p.name, p.value])),
      query: queryParams.filter((row) => row.enabled && row.key && row.value).map((row) => ({ key: row.key, value: row.value })),
      body: BODY_METHODS.includes(method) ? body : '',
      status: null,
      at: Date.now(),
    }

    const teamName = selectedTeamId ? userTeams.find((team) => team.id === selectedTeamId)?.name ?? selectedTeamId : null
    setRequestContext({
      auth: authType,
      team: teamName,
      crossTeam: bypassMode,
      actingAs: actAsUserId.trim() ? actAsLabel || actAsUserId.trim() : null,
    })

    await execute({
      url: fullUrl,
      method,
      headers: customHeaders,
      body: BODY_METHODS.includes(method) ? body : undefined,
      authType,
      apiKey: authType === 'apiKey' ? apiKey : undefined,
    })
  }, [selectedEndpoint, pathParams, queryParams, headers, method, body, authType, apiKey, bypassMode, selectedTeamId, actAsUserId, actAsLabel, userTeams, execute])

  // Switching to a method that sends a body on an empty editor fills it the same way opening the endpoint does.
  const handleMethodChange = useCallback(
    (next: HttpMethod) => {
      setMethod(next)
      if (selectedEndpoint && !body.trim()) {
        setBody(initialBody(next, endpointPresets?.presets, bodySkeletons?.[selectedEndpoint.path]))
      }
    },
    [selectedEndpoint, body, endpointPresets, bodySkeletons]
  )

  // A request joins "Recent" when it gets an answer (with its status), or fails with none; a cancel does not.
  useEffect(() => {
    const sent = sentRef.current
    if (!sent || status === 'idle' || status === 'loading') return
    sentRef.current = null
    if (status === 'cancelled') return
    setRecent((prev) => {
      const next = pushRecent(prev, { ...sent, status: status === 'success' ? response?.status ?? null : null })
      saveState('recent', next)
      return next
    })
  }, [status, response])

  const handleClearRecent = useCallback(() => {
    setRecent([])
    saveState('recent', [])
  }, [])

  // Reopen a recent request: its endpoint, then its params and body over the endpoint's own draft.
  const handleOpenRecent = useCallback(
    (item: RecentRequest) => {
      const route = findRouteByPath(routes, item.path)
      if (!route) return
      handleSelectEndpoint(item.path, item.method as HttpMethod, route)
      setPathParams(extractPathParams(item.path).map((p) => ({ ...p, value: item.pathParams[p.name] ?? '' })))
      setQueryParams([
        ...item.query.map((q) => ({ id: crypto.randomUUID(), key: q.key, value: q.value, enabled: true })),
        ...createEmptyRows(),
      ])
      if (item.body) setBody(item.body)
    },
    [routes, handleSelectEndpoint]
  )

  // The request as a cURL command, built from the same inputs a send uses (the API key masked).
  const handleCopyCurl = useCallback(() => {
    const url = selectedEndpoint ? buildUrl(selectedEndpoint.path, pathParams, queryParams) : ''
    return buildCurl({
      method,
      url: (typeof window !== 'undefined' ? window.location.origin : '') + withBasePath(url),
      headers: buildRequestHeaders({ bypassMode, selectedTeamId, actAsUserId, headers }),
      body,
      authType,
      apiKey,
    })
  }, [selectedEndpoint, pathParams, queryParams, method, bypassMode, selectedTeamId, actAsUserId, headers, body, authType, apiKey])

  // The query params live in the address bar too, so a link to this screen reopens the same request. Replaced,
  // not pushed: typing a character is not a page to go back to. The path part is the navigation hook's.
  useEffect(() => {
    if (!selectedEndpoint || typeof window === 'undefined') return
    const next = window.location.pathname + queryToSearch(queryParams) + window.location.hash
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, '', next)
    }
  }, [selectedEndpoint, queryParams])

  // Handle applying a preset
  const handleApplyPreset = useCallback((rawPreset: ApiPreset) => {
    // Placeholders resolve HERE, not on send: the values land in the editor, where they can be
    // read and edited before anything is dispatched. One set of values per apply, so a token
    // used in two fields of the same payload resolves to the same thing in both.
    const values = createPresetPlaceholderValues()
    const preset: ApiPreset = {
      ...rawPreset,
      pathParams: resolvePresetPlaceholders(rawPreset.pathParams, values),
      params: resolvePresetPlaceholders(rawPreset.params, values),
      headers: resolvePresetPlaceholders(rawPreset.headers, values),
      payload: resolvePresetPlaceholders(rawPreset.payload, values),
      sessionConfig: resolvePresetPlaceholders(rawPreset.sessionConfig, values),
    }

    // Track which tabs will be modified
    const modifiedTabs = new Set<'params' | 'headers' | 'body'>()

    // Apply method
    if (preset.method) {
      setMethod(preset.method)
    }

    // Apply path params
    if (preset.pathParams && Object.keys(preset.pathParams).length > 0) {
      setPathParams((prev) =>
        prev.map((p) => ({
          ...p,
          value: preset.pathParams?.[p.name] ?? p.value,
        }))
      )
      modifiedTabs.add('params')
    }

    // Apply query params
    if (preset.params && Object.keys(preset.params).length > 0) {
      const newParams = Object.entries(preset.params).map(([key, value], idx) => ({
        id: `preset-${idx}-${crypto.randomUUID()}`,
        key,
        value: String(value),
        enabled: true,
      }))
      setQueryParams(newParams)
      modifiedTabs.add('params')
    }

    // Apply headers
    if (preset.headers && Object.keys(preset.headers).length > 0) {
      const newHeaders = Object.entries(preset.headers).map(([key, value], idx) => ({
        id: `preset-header-${idx}-${crypto.randomUUID()}`,
        key,
        value,
        enabled: true,
      }))
      setHeaders(newHeaders)
      modifiedTabs.add('headers')
    }

    // Apply body
    if (preset.payload && Object.keys(preset.payload).length > 0) {
      setBody(JSON.stringify(preset.payload, null, 2))
      modifiedTabs.add('body')
    }

    // Apply session config
    if (preset.sessionConfig) {
      if (preset.sessionConfig.crossTeam !== undefined) {
        setBypassMode(preset.sessionConfig.crossTeam)
      }
      if (preset.sessionConfig.teamId) {
        // Already resolved above, along with every other placeholder.
        setSelectedTeamId(preset.sessionConfig.teamId)
      }
      if (preset.sessionConfig.authType) {
        setAuthType(preset.sessionConfig.authType)
      }
    }

    // Update the modified tabs indicator
    setTabsModifiedByPreset(modifiedTabs)
  }, [])

  // Sync state from URL changes (browser back/forward)
  useEffect(() => {
    if (urlPath && urlMethod) {
      const route = findRouteByPath(routes, urlPath)
      if (route && (selectedEndpoint?.path !== urlPath || selectedEndpoint?.method !== urlMethod)) {
        // URL changed, update local state (restoring this endpoint's draft)
        setSelectedEndpoint({ path: urlPath, method: urlMethod, route })
        setMethod(urlMethod)
        applyEndpointState(urlMethod, urlPath, true)
      }
    }
  }, [urlPath, urlMethod, routes, selectedEndpoint, applyEndpointState])

  // Persist the current endpoint's request draft.
  useEffect(() => {
    if (!selectedEndpoint) return
    saveState(draftKey(selectedEndpoint.method, selectedEndpoint.path), {
      pathParams,
      queryParams,
      headers,
      body,
    })
  }, [selectedEndpoint, pathParams, queryParams, headers, body])

  // Initialize from URL, initialEndpoint prop, last-used endpoint, or first endpoint
  useEffect(() => {
    if (hasInitialized.current) return

    // 1. Try URL first (already handled by URL hook)
    if (urlPath && urlMethod) {
      const route = findRouteByPath(routes, urlPath)
      if (route) {
        hasInitialized.current = true
        setSelectedEndpoint({ path: urlPath, method: urlMethod, route })
        setMethod(urlMethod)
        applyEndpointState(urlMethod, urlPath, true)
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
        applyEndpointState(endpointMethod, initialEndpoint.path, true)
        // Navigate to update URL if not already there
        if (!urlPath) {
          navigateToEndpoint(endpointMethod, initialEndpoint.path)
        }
        return
      }
    }

    // 3. Restore the last-used endpoint (persisted) on a fresh visit
    const last = loadState<{ method: string; path: string }>('lastEndpoint')
    if (last) {
      const route = findRouteByPath(routes, last.path)
      if (route) {
        hasInitialized.current = true
        const lastMethod = last.method as HttpMethod
        setSelectedEndpoint({ path: last.path, method: lastMethod, route })
        setMethod(lastMethod)
        applyEndpointState(lastMethod, last.path)
        navigateToEndpoint(lastMethod, last.path)
        return
      }
    }

    // 4. Fall back to first available endpoint
    const categories: RouteCategory[] = ['core', 'entity', 'theme', 'plugin']
    for (const category of categories) {
      const categoryRoutes = routes[category]
      if (categoryRoutes.length > 0) {
        hasInitialized.current = true
        const firstRoute = categoryRoutes[0]
        const firstMethod = defaultMethod(firstRoute.methods)
        setSelectedEndpoint({ path: firstRoute.path, method: firstMethod, route: firstRoute })
        setMethod(firstMethod)
        applyEndpointState(firstMethod, firstRoute.path)
        navigateToEndpoint(firstMethod, firstRoute.path)
        break
      }
    }
  }, [routes, initialEndpoint, urlPath, urlMethod, navigateToEndpoint, applyEndpointState])

  const totalRoutes = Object.values(routes).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="flex h-full w-full overflow-hidden" data-cy={sel('devtools.apiExplorer.container')}>
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
          <span className="font-semibold">{t("title")}</span>
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
      <div ref={splitRowRef} className="flex-1 flex flex-col lg:flex-row min-w-0 pt-14 lg:pt-0">
        {selectedEndpoint ? (
          <>
            {/* Request Panel - Top on mobile, Left on desktop */}
            <div
              className="flex-1 min-h-0 min-w-0 border-b lg:border-b-0 overflow-hidden"
              style={isSideBySide ? { flex: `0 0 ${splitPercent}%` } : undefined}
              data-split-panel="request"
            >
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
                actAsUserId={actAsUserId}
                actAsLabel={actAsLabel}
                showTeamError={teamErrorShown}
                body={body}
                status={status}
                onMethodChange={handleMethodChange}
                onPathParamsChange={setPathParams}
                onQueryParamsChange={setQueryParams}
                onHeadersChange={setHeaders}
                onAuthTypeChange={setAuthType}
                onApiKeyChange={setApiKey}
                onBypassModeChange={setBypassMode}
                onTeamChange={setSelectedTeamId}
                onActAsUserChange={handleActAsChange}
                onBodyChange={setBody}
                onSend={handleSend}
                onCancel={cancel}
                onCopyCurl={handleCopyCurl}
                recentRequests={recent}
                onOpenRecent={handleOpenRecent}
                onClearRecent={handleClearRecent}
                endpointPresets={endpointPresets}
                endpointDoc={endpointDoc}
                onApplyPreset={handleApplyPreset}
                tabsModifiedByPreset={tabsModifiedByPreset}
                onClearPresetIndicator={(tab) => {
                  setTabsModifiedByPreset((prev) => {
                    const next = new Set(prev)
                    next.delete(tab)
                    return next
                  })
                }}
              />
            </div>

            <PanelDivider
              value={splitPercent}
              onChange={handleSplitChange}
              containerRef={splitRowRef}
              label={t('resizePanels')}
            />

            {/* Response Panel - Bottom on mobile, Right on desktop */}
            <div className="h-[40vh] lg:h-auto lg:flex-1 min-h-[200px] min-w-0 overflow-hidden">
              <ApiResponsePanel
                status={status}
                response={response}
                error={error}
                context={requestContext}
              />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">{t('noEndpointSelected')}</p>
              <p className="text-sm">
                {totalRoutes > 0
                  ? t('selectEndpoint')
                  : t('noEndpoints')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { Send, X } from 'lucide-react'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { ScrollArea } from '../../ui/scroll-area'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

import { MethodSelector } from '../api-tester/MethodSelector'
import { PathParamsEditor } from '../api-tester/PathParamsEditor'
import { KeyValueEditor } from '../api-tester/KeyValueEditor'
import { AuthSelector } from '../api-tester/AuthSelector'
import { PayloadEditor } from '../api-tester/PayloadEditor'
import { buildUrl, validatePathParams, validateJsonBody } from '../api-tester/utils/url-builder'
import type { HttpMethod, AuthType, KeyValuePair, PathParam, RequestStatus } from '../api-tester/types'
import type { ApiRouteEntry } from '../../../lib/services/api-routes.service'
import type { ApiEndpointPresets, ApiPreset } from '../../../types/api-presets'
import { PresetsTab } from './PresetsTab'
import { ApiDocsModal } from './ApiDocsModal'

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  PATCH: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
  PUT: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  OPTIONS: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30',
}

interface ApiRequestPanelProps {
  route: ApiRouteEntry
  basePath: string
  method: HttpMethod
  pathParams: PathParam[]
  queryParams: KeyValuePair[]
  headers: KeyValuePair[]
  authType: AuthType
  apiKey: string
  bypassMode: boolean
  selectedTeamId: string | null
  body: string
  status: RequestStatus
  onMethodChange: (method: HttpMethod) => void
  onPathParamsChange: (params: PathParam[]) => void
  onQueryParamsChange: (params: KeyValuePair[]) => void
  onHeadersChange: (headers: KeyValuePair[]) => void
  onAuthTypeChange: (type: AuthType) => void
  onApiKeyChange: (key: string) => void
  onBypassModeChange: (enabled: boolean) => void
  onTeamChange: (teamId: string | null) => void
  onBodyChange: (body: string) => void
  onSend: () => void
  onCancel: () => void
  // Presets & Docs
  endpointPresets?: ApiEndpointPresets | null
  endpointDoc?: { path: string; title: string } | null
  onApplyPreset?: (preset: ApiPreset) => void
  // Preset modification indicators
  tabsModifiedByPreset?: Set<'params' | 'headers' | 'body'>
  onClearPresetIndicator?: (tab: 'params' | 'headers' | 'body') => void
}

export function ApiRequestPanel({
  route,
  basePath,
  method,
  pathParams,
  queryParams,
  headers,
  authType,
  apiKey,
  bypassMode,
  selectedTeamId,
  body,
  status,
  onMethodChange,
  onPathParamsChange,
  onQueryParamsChange,
  onHeadersChange,
  onAuthTypeChange,
  onApiKeyChange,
  onBypassModeChange,
  onTeamChange,
  onBodyChange,
  onSend,
  onCancel,
  endpointPresets,
  endpointDoc,
  onApplyPreset,
  tabsModifiedByPreset,
  onClearPresetIndicator,
}: ApiRequestPanelProps) {
  const t = useTranslations('devtools.apiTester')

  // URL preview
  const previewUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return origin + buildUrl(basePath, pathParams, queryParams)
  }, [basePath, pathParams, queryParams])

  // Validation
  const canSend = useMemo(() => {
    const pathErrors = validatePathParams(pathParams)
    const bodyError = ['POST', 'PATCH', 'PUT'].includes(method) ? validateJsonBody(body) : null
    return pathErrors.length === 0 && !bodyError
  }, [pathParams, method, body])

  const showPayloadEditor = ['POST', 'PATCH', 'PUT'].includes(method)

  // Handlers that clear preset indicators when user modifies manually
  const handlePathParamsChange = (params: PathParam[]) => {
    onPathParamsChange(params)
    onClearPresetIndicator?.('params')
  }

  const handleQueryParamsChange = (params: KeyValuePair[]) => {
    onQueryParamsChange(params)
    onClearPresetIndicator?.('params')
  }

  const handleHeadersChange = (newHeaders: KeyValuePair[]) => {
    onHeadersChange(newHeaders)
    onClearPresetIndicator?.('headers')
  }

  const handleBodyChange = (newBody: string) => {
    onBodyChange(newBody)
    onClearPresetIndicator?.('body')
  }

  return (
    <div className="flex flex-col h-full" data-cy={sel('devtools.apiExplorer.request.panel')}>
      {/* Header: Method + URL */}
      <div className="p-4 border-b space-y-3 bg-muted/30">
        {/* Method Badge + Endpoint Path + Send Button */}
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn('font-mono text-sm px-2 py-1 border', methodColors[method])}
          >
            {method}
          </Badge>
          <code className="font-mono text-sm font-medium flex-1 truncate">{basePath}</code>
          {route.source && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {route.source}
            </Badge>
          )}

          {/* Docs Button */}
          {endpointDoc && (
            <ApiDocsModal docPath={endpointDoc.path} title={endpointDoc.title} />
          )}

          {/* Send Button */}
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={onSend}
              disabled={!canSend || status === 'loading'}
              size="sm"
              data-cy={sel('devtools.apiExplorer.request.sendBtn')}
            >
              <Send className="h-4 w-4 mr-2" />
              {status === 'loading' ? t('sending') : t('sendRequest')}
            </Button>
            {status === 'loading' && (
              <Button variant="outline" size="sm" onClick={onCancel} data-cy={sel('devtools.apiExplorer.request.cancelBtn')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Method Selector */}
        <MethodSelector
          methods={route.methods}
          selected={method}
          onSelect={onMethodChange}
        />

        {/* URL Preview */}
        <div className="bg-background rounded-md border p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
            {t('urlPreview')}
          </p>
          <code className="font-mono text-xs break-all text-foreground">{previewUrl}</code>
        </div>

        {/* Auth Options - Always visible */}
        <AuthSelector
          authType={authType}
          apiKey={apiKey}
          bypassMode={bypassMode}
          selectedTeamId={selectedTeamId}
          onAuthTypeChange={onAuthTypeChange}
          onApiKeyChange={onApiKeyChange}
          onBypassModeChange={onBypassModeChange}
          onTeamChange={onTeamChange}
        />
      </div>

      {/* Tabs for params/headers/body */}
      <div className="flex-1 min-h-0 flex flex-col">
        <Tabs defaultValue="params" className="flex-1 flex flex-col">
          <div className="border-b px-4">
            <TabsList className="h-9 bg-transparent p-0 border-0">
              <TabsTrigger
                value="params"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 pb-2"
                data-cy={sel('devtools.apiExplorer.request.tabParams')}
              >
                {tabsModifiedByPreset?.has('params') && (
                  <span className="w-2 h-2 rounded-full bg-primary mr-1.5" title="Modified by preset" />
                )}
                Params
                {(pathParams.length > 0 || queryParams.length > 0) && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                    {pathParams.length + queryParams.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="headers"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 pb-2"
                data-cy={sel('devtools.apiExplorer.request.tabHeaders')}
              >
                {tabsModifiedByPreset?.has('headers') && (
                  <span className="w-2 h-2 rounded-full bg-primary mr-1.5" title="Modified by preset" />
                )}
                Headers
                {headers.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                    {headers.length}
                  </Badge>
                )}
              </TabsTrigger>
              {showPayloadEditor && (
                <TabsTrigger
                  value="body"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 pb-2"
                  data-cy={sel('devtools.apiExplorer.request.tabBody')}
                >
                  {tabsModifiedByPreset?.has('body') && (
                    <span className="w-2 h-2 rounded-full bg-primary mr-1.5" title="Modified by preset" />
                  )}
                  Body
                </TabsTrigger>
              )}
              {endpointPresets && endpointPresets.presets.length > 0 && (
                <TabsTrigger
                  value="presets"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 pb-2"
                  data-cy={sel('devtools.apiExplorer.request.tabPresets')}
                >
                  Presets
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                    {endpointPresets.presets.length}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="params" className="m-0 p-4 space-y-4">
              {pathParams.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Path Parameters</h4>
                  <PathParamsEditor params={pathParams} onChange={handlePathParamsChange} />
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-2">Query Parameters</h4>
                <KeyValueEditor
                  items={queryParams}
                  onChange={handleQueryParamsChange}
                  dataCyPrefix="api-request-query"
                />
              </div>
            </TabsContent>

            <TabsContent value="headers" className="m-0 p-4">
              <p className="text-xs text-muted-foreground mb-3">
                {t('headersInfo')}
              </p>
              <KeyValueEditor
                items={headers}
                onChange={handleHeadersChange}
                dataCyPrefix="api-request-headers"
              />
            </TabsContent>

            {showPayloadEditor && (
              <TabsContent value="body" className="m-0 p-4">
                <PayloadEditor value={body} onChange={handleBodyChange} />
              </TabsContent>
            )}

            {endpointPresets && endpointPresets.presets.length > 0 && onApplyPreset && (
              <TabsContent value="presets" className="m-0">
                <PresetsTab
                  endpointPresets={endpointPresets}
                  currentMethod={method}
                  onApplyPreset={onApplyPreset}
                />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </div>

    </div>
  )
}

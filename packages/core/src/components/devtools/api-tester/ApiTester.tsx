'use client'

import { useState, useMemo, useCallback } from 'react'
import { ArrowLeft, Send, X, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible'
import { Badge } from '../../ui/badge'
import { useTranslations } from 'next-intl'

import { MethodSelector } from './MethodSelector'
import { PathParamsEditor } from './PathParamsEditor'
import { KeyValueEditor } from './KeyValueEditor'
import { AuthSelector } from './AuthSelector'
import { PayloadEditor } from './PayloadEditor'
import { ResponseViewer } from './ResponseViewer'
import { useApiRequest } from './hooks/useApiRequest'
import { extractPathParams, buildUrl, validatePathParams, validateJsonBody } from './utils/url-builder'
import type { ApiTesterProps, HttpMethod, AuthType, KeyValuePair, PathParam } from './types'

export function ApiTester({ route, basePath }: ApiTesterProps) {
  const t = useTranslations('devtools.apiTester')

  // Estado del formulario
  const [method, setMethod] = useState<HttpMethod>(
    (route.methods.includes('GET') ? 'GET' : route.methods[0]) as HttpMethod
  )
  const [pathParams, setPathParams] = useState<PathParam[]>(() => extractPathParams(basePath))
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([])
  const [headers, setHeaders] = useState<KeyValuePair[]>([])
  const [authType, setAuthType] = useState<AuthType>('session')
  const [apiKey, setApiKey] = useState('')
  const [body, setBody] = useState('')
  const [bypassMode, setBypassMode] = useState(false)

  // Hook de request
  const { status, response, error, execute, cancel } = useApiRequest()

  // URL preview
  const previewUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return origin + buildUrl(basePath, pathParams, queryParams)
  }, [basePath, pathParams, queryParams])

  // Validacion
  const canSend = useMemo(() => {
    const pathErrors = validatePathParams(pathParams)
    const bodyError = ['POST', 'PATCH', 'PUT'].includes(method) ? validateJsonBody(body) : null
    return pathErrors.length === 0 && !bodyError
  }, [pathParams, method, body])

  // Mostrar payload editor solo para metodos que lo soportan
  const showPayloadEditor = ['POST', 'PATCH', 'PUT'].includes(method)

  // Enviar request
  const handleSend = useCallback(async () => {
    const url = buildUrl(basePath, pathParams, queryParams)
    const fullUrl = (typeof window !== 'undefined' ? window.location.origin : '') + url

    const customHeaders: Record<string, string> = {}

    // Auto-inject x-team-id from active team context (unless bypass mode without team)
    if (typeof window !== 'undefined' && !bypassMode) {
      const activeTeamId = localStorage.getItem('activeTeamId')
      if (activeTeamId) {
        customHeaders['x-team-id'] = activeTeamId
      }
    }

    // Auto-inject x-admin-bypass header if bypass mode is enabled
    if (bypassMode) {
      customHeaders['x-admin-bypass'] = 'confirm-cross-team-access'
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
      body: showPayloadEditor ? body : undefined,
      authType,
      apiKey: authType === 'apiKey' ? apiKey : undefined,
    })
  }, [basePath, pathParams, queryParams, headers, method, body, authType, apiKey, bypassMode, showPayloadEditor, execute])

  return (
    <div className="space-y-6" data-cy="api-tester">
      {/* Header con back button */}
      <div className="flex items-center gap-4">
        <Link href="/devtools/api">
          <Button variant="ghost" size="sm" data-cy="api-tester-back-btn">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToList')}
          </Button>
        </Link>
      </div>

      {/* Endpoint info */}
      <Card data-cy="api-tester-endpoint-info">
        <CardHeader>
          <CardTitle className="font-mono text-lg">{basePath}</CardTitle>
          {route.source && (
            <CardDescription>
              Source: {route.source}
              {route.subcategory && ` | Category: ${route.subcategory}`}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Method Selector */}
      <Card data-cy="api-tester-method-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('method')}</CardTitle>
        </CardHeader>
        <CardContent>
          <MethodSelector
            methods={route.methods}
            selected={method}
            onSelect={setMethod}
          />
        </CardContent>
      </Card>

      {/* URL Preview */}
      <Card data-cy="api-tester-url-preview">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground mb-1">{t('urlPreview')}</p>
          <code className="block font-mono text-sm break-all bg-muted p-2 rounded">
            {previewUrl}
          </code>
        </CardContent>
      </Card>

      {/* Path Parameters */}
      {pathParams.length > 0 && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t('pathParams')}</CardTitle>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <PathParamsEditor params={pathParams} onChange={setPathParams} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Query Parameters */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {t('queryParams')}
                  {queryParams.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {queryParams.length}
                    </Badge>
                  )}
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <KeyValueEditor
                items={queryParams}
                onChange={setQueryParams}
                dataCyPrefix="api-tester-query"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Headers */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {t('headers')}
                  {headers.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {headers.length}
                    </Badge>
                  )}
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="mb-3 text-xs text-muted-foreground">
                {t('headersInfo')}
              </div>
              <KeyValueEditor
                items={headers}
                onChange={setHeaders}
                dataCyPrefix="api-tester-headers"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Authentication */}
      <Collapsible defaultOpen>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('authentication')}</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <AuthSelector
                authType={authType}
                apiKey={apiKey}
                bypassMode={bypassMode}
                onAuthTypeChange={setAuthType}
                onApiKeyChange={setApiKey}
                onBypassModeChange={setBypassMode}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Request Body */}
      {showPayloadEditor && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t('requestBody')}</CardTitle>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <PayloadEditor value={body} onChange={setBody} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Send Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleSend}
          disabled={!canSend || status === 'loading'}
          className="flex-1"
          data-cy="api-tester-send-btn"
        >
          <Send className="h-4 w-4 mr-2" />
          {status === 'loading' ? t('sending') : t('sendRequest')}
        </Button>
        {status === 'loading' && (
          <Button
            variant="outline"
            onClick={cancel}
            data-cy="api-tester-cancel-btn"
          >
            <X className="h-4 w-4 mr-2" />
            {t('cancel')}
          </Button>
        )}
      </div>

      {/* Response */}
      <ResponseViewer status={status} response={response} error={error} />
    </div>
  )
}

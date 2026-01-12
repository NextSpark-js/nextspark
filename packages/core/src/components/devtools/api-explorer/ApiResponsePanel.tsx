'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { JsonViewerWithControls } from './JsonViewer'
import type { ApiResponse, RequestStatus } from '../api-tester/types'

interface ApiResponsePanelProps {
  status: RequestStatus
  response: ApiResponse | null
  error: string | null
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
  if (status >= 300 && status < 400) return 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
  if (status >= 400 && status < 500) return 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
  return 'bg-red-500/20 text-red-600 dark:text-red-400'
}

export function ApiResponsePanel({ status, response, error }: ApiResponsePanelProps) {
  const t = useTranslations('devtools.apiTester')

  // Idle state
  if (status === 'idle') {
    return (
      <div className="flex flex-col h-full" data-cy={sel('devtools.apiExplorer.response.panelIdle')}>
        <div className="p-3 border-b bg-muted/30">
          <h3 className="text-sm font-medium">Response</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {t('responseStates.idle')}
        </div>
      </div>
    )
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex flex-col h-full" data-cy={sel('devtools.apiExplorer.response.panelLoading')}>
        <div className="p-3 border-b bg-muted/30">
          <h3 className="text-sm font-medium">Response</h3>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground text-sm">{t('responseStates.loading')}</span>
        </div>
      </div>
    )
  }

  // Error state
  if (status === 'error' || status === 'cancelled') {
    return (
      <div className="flex flex-col h-full" data-cy={sel('devtools.apiExplorer.response.panelError')}>
        <div className="p-3 border-b bg-muted/30">
          <h3 className="text-sm font-medium">Response</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-destructive text-sm p-4 text-center">
          {error || t('responseStates.error')}
        </div>
      </div>
    )
  }

  // No response
  if (!response) return null

  return (
    <div className="flex flex-col h-full" data-cy={sel('devtools.apiExplorer.response.panel')}>
      {/* Header with status */}
      <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
        <h3 className="text-sm font-medium">Response</h3>
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className={cn('font-mono text-xs', getStatusColor(response.status))}
            data-cy={sel('devtools.apiExplorer.response.status')}
          >
            {response.status} {response.statusText}
          </Badge>
          <span className="text-xs text-muted-foreground" data-cy={sel('devtools.apiExplorer.response.time')}>
            {response.timing}ms
          </span>
          {response.size && (
            <span className="text-xs text-muted-foreground">
              {response.size > 1024
                ? `${(response.size / 1024).toFixed(1)} KB`
                : `${response.size} B`}
            </span>
          )}
        </div>
      </div>

      {/* Tabs: Body / Headers */}
      <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
        <div className="border-b px-3">
          <TabsList className="h-8 bg-transparent p-0 border-0">
            <TabsTrigger
              value="body"
              className="text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 pb-1.5"
              data-cy={sel('devtools.apiExplorer.response.tabBody')}
            >
              Body
            </TabsTrigger>
            <TabsTrigger
              value="headers"
              className="text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 pb-1.5"
              data-cy={sel('devtools.apiExplorer.response.tabHeaders')}
            >
              Headers ({Object.keys(response.headers).length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="body" className="flex-1 m-0 min-h-0 flex flex-col">
          <div className="flex-1 overflow-auto p-3" data-cy={sel('devtools.apiExplorer.response.body')}>
            {typeof response.body === 'object' && response.body !== null ? (
              <JsonViewerWithControls
                data={response.body as Record<string, unknown> | unknown[]}
                initialExpanded={2}
                showControls
              />
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap">{String(response.body)}</pre>
            )}
          </div>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-1" data-cy={sel('devtools.apiExplorer.response.headers')}>
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="font-mono text-xs">
                  <span className="text-primary">{key}:</span>{' '}
                  <span className="text-muted-foreground">{value}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

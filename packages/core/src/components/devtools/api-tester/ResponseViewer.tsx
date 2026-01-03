'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import type { ApiResponse, RequestStatus } from './types'

interface ResponseViewerProps {
  status: RequestStatus
  response: ApiResponse | null
  error: string | null
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
  if (status >= 300 && status < 400) return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
  if (status >= 400 && status < 500) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
  return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
}

export function ResponseViewer({ status, response, error }: ResponseViewerProps) {
  const t = useTranslations('devtools.apiTester')

  if (status === 'idle') {
    return (
      <Card data-cy="api-tester-response-idle">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            {t('responseStates.idle')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'loading') {
    return (
      <Card data-cy="api-tester-response-loading">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground">{t('responseStates.loading')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error' || status === 'cancelled') {
    return (
      <Card data-cy="api-tester-response-error">
        <CardContent className="pt-6">
          <p className="text-center text-destructive">
            {error || t('responseStates.error')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!response) return null

  return (
    <Card data-cy="api-tester-response">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('response')}</CardTitle>
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className={cn('font-mono', getStatusColor(response.status))}
              data-cy="api-tester-response-status"
            >
              {response.status} {response.statusText}
            </Badge>
            <span className="text-sm text-muted-foreground" data-cy="api-tester-response-time">
              {response.timing}ms
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="body" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="body" data-cy="api-tester-response-tab-body">{t('responseBody')}</TabsTrigger>
            <TabsTrigger value="headers" data-cy="api-tester-response-tab-headers">
              {t('responseHeaders')} ({Object.keys(response.headers).length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="body" className="mt-4">
            <ScrollArea className="h-[300px] rounded-md border">
              <pre className="p-4 text-sm font-mono" data-cy="api-tester-response-body">
                {typeof response.body === 'object'
                  ? JSON.stringify(response.body, null, 2)
                  : String(response.body)}
              </pre>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="headers" className="mt-4">
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-4 space-y-1" data-cy="api-tester-response-headers">
                {Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} className="font-mono text-sm">
                    <span className="text-primary">{key}:</span>{' '}
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

/**
 * Scheduled Actions Table Component
 * Clean, readable table design with improved spacing
 */

'use client'

import { useTranslations } from 'next-intl'
import { Fragment, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '../../ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table'
import { Button } from '../../ui/button'
import { ChevronDownIcon, ChevronRightIcon, RotateCcwIcon, PlayIcon } from 'lucide-react'
import { sel } from '../../../lib/test'
import type { ScheduledAction } from '../../../lib/scheduled-actions/types'
import { toast } from 'sonner'

interface ActionsTableProps {
  actions: ScheduledAction[]
}

async function retryAction(actionId: string): Promise<{ newActionId: string }> {
  const response = await fetch('/api/v1/devtools/scheduled-actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actionId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to retry action')
  }

  const data = await response.json()
  return data.data
}

async function runAction(actionId: string): Promise<{ success: boolean }> {
  const response = await fetch('/api/v1/devtools/scheduled-actions/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actionId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to run action')
  }

  const data = await response.json()
  return data.data
}

export function ActionsTable({ actions }: ActionsTableProps) {
  const t = useTranslations('devtools.scheduledActions')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: retryAction,
    onSuccess: () => {
      toast.success(t('retry.success'))
      queryClient.invalidateQueries({ queryKey: ['scheduled-actions'] })
    },
    onError: (error: Error) => {
      toast.error(t('retry.error', { message: error.message }))
    },
  })

  // Run mutation
  const runMutation = useMutation({
    mutationFn: runAction,
    onSuccess: () => {
      toast.success(t('run.success'))
      queryClient.invalidateQueries({ queryKey: ['scheduled-actions'] })
    },
    onError: (error: Error) => {
      toast.error(t('run.error', { message: error.message }))
    },
  })

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getStatusBadge = (status: ScheduledAction['status']) => {
    const variants = {
      pending: { variant: 'secondary' as const, cy: sel('devtools.scheduledActions.statusPending') },
      running: { variant: 'default' as const, cy: sel('devtools.scheduledActions.statusRunning') },
      completed: { variant: 'outline' as const, cy: sel('devtools.scheduledActions.statusCompleted') },
      failed: { variant: 'destructive' as const, cy: sel('devtools.scheduledActions.statusFailed') },
    }

    const config = variants[status]

    return (
      <Badge variant={config.variant} data-cy={config.cy} className="font-medium">
        {t(`status.${status}`)}
      </Badge>
    )
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const calculateDuration = (startedAt: Date | null, completedAt: Date | null) => {
    if (!startedAt || !completedAt) return null
    const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  if (actions.length === 0) {
    return (
      <div
        className="text-center py-16 text-muted-foreground"
        data-cy={sel('devtools.scheduledActions.emptyState')}
      >
        <p className="text-lg font-medium">{t('empty')}</p>
        <p className="text-sm mt-2">{t('emptyDescription')}</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden" data-cy={sel('devtools.scheduledActions.table')}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="font-semibold" data-cy={sel('devtools.scheduledActions.cellType')}>
              {t('table.type')}
            </TableHead>
            <TableHead className="font-semibold" data-cy={sel('devtools.scheduledActions.cellStatus')}>
              {t('table.status')}
            </TableHead>
            <TableHead className="font-semibold" data-cy={sel('devtools.scheduledActions.cellAttempts')}>
              {t('table.attempts')}
            </TableHead>
            <TableHead className="font-semibold" data-cy={sel('devtools.scheduledActions.cellScheduledAt')}>
              {t('table.scheduledAt')}
            </TableHead>
            <TableHead className="font-semibold" data-cy={sel('devtools.scheduledActions.cellStartedAt')}>
              {t('table.startedAt')}
            </TableHead>
            <TableHead className="font-semibold" data-cy={sel('devtools.scheduledActions.cellCompletedAt')}>
              {t('table.completedAt')}
            </TableHead>
            <TableHead className="font-semibold" data-cy={sel('devtools.scheduledActions.cellTeam')}>
              {t('table.team')}
            </TableHead>
            <TableHead className="font-semibold text-right" data-cy={sel('devtools.scheduledActions.cellActions')}>
              {t('table.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => {
            const isExpanded = expandedRows.has(action.id)
            const duration = calculateDuration(action.startedAt, action.completedAt)

            return (
              <Fragment key={action.id}>
                <TableRow
                  className="hover:bg-muted/50 transition-colors"
                  data-cy={sel('devtools.scheduledActions.row', { id: action.id })}
                >
                  <TableCell className="py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => toggleRow(action.id)}
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-sm py-4">
                    {action.actionType}
                  </TableCell>
                  <TableCell className="py-4">{getStatusBadge(action.status)}</TableCell>
                  <TableCell className="text-sm font-medium py-4">
                    {action.status === 'failed' ? (
                      <span className="text-destructive">
                        {action.attempts}/{action.maxRetries}
                      </span>
                    ) : action.status === 'completed' && action.attempts > 1 ? (
                      <span className="text-green-600 dark:text-green-500">
                        {action.attempts}/{action.maxRetries}
                      </span>
                    ) : action.status === 'running' ? (
                      <span className="text-blue-600 dark:text-blue-500">
                        {action.attempts}/{action.maxRetries}
                      </span>
                    ) : action.status === 'pending' && action.attempts > 0 ? (
                      <span className="text-amber-600 dark:text-amber-500">
                        {action.attempts}/{action.maxRetries}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm py-4 whitespace-nowrap">
                    {formatDate(action.scheduledAt)}
                  </TableCell>
                  <TableCell className="text-sm py-4 whitespace-nowrap">
                    {action.startedAt ? (
                      formatDate(action.startedAt)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm py-4 whitespace-nowrap">
                    {action.completedAt ? (
                      <div className="space-y-1">
                        <div>{formatDate(action.completedAt)}</div>
                        {duration && (
                          <div className="text-xs text-muted-foreground">({duration})</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm py-4">
                    {action.teamId ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {action.teamId.slice(0, 8)}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">{t('table.noTeam')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="flex items-center justify-end gap-2">
                      {action.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryMutation.mutate(action.id)}
                          disabled={retryMutation.isPending}
                          data-cy={sel('devtools.scheduledActions.retryBtn', { id: action.id })}
                        >
                          <RotateCcwIcon className="h-3.5 w-3.5 mr-1.5" />
                          {t('retry.button')}
                        </Button>
                      )}
                      {action.status === 'pending' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => runMutation.mutate(action.id)}
                          disabled={runMutation.isPending}
                          data-cy={sel('devtools.scheduledActions.runBtn', { id: action.id })}
                        >
                          <PlayIcon className="h-3.5 w-3.5 mr-1.5" />
                          {t('run.button')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-muted/30 py-6">
                      <div className="space-y-4 max-w-5xl">
                        {/* ID */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">ID</p>
                          <code className="text-xs font-mono bg-background px-2 py-1 rounded border">
                            {action.id}
                          </code>
                        </div>

                        {/* Payload */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            {t('table.payload')}
                          </p>
                          <pre className="text-xs bg-background p-4 rounded border overflow-auto max-h-64 font-mono">
                            {JSON.stringify(action.payload, null, 2)}
                          </pre>
                        </div>

                        {/* Error */}
                        {action.errorMessage && (
                          <div>
                            <p className="text-xs font-semibold text-destructive mb-2">
                              {t('table.error')}
                            </p>
                            <div className="bg-destructive/10 border border-destructive/20 rounded p-4">
                              <code className="text-sm text-destructive font-mono break-all">
                                {action.errorMessage}
                              </code>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

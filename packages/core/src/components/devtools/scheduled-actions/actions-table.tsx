/**
 * Scheduled Actions Table Component
 */

'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { sel } from '../../../lib/test'
import type { ScheduledAction } from '../../../lib/scheduled-actions/types'

interface ActionsTableProps {
  actions: ScheduledAction[]
}

export function ActionsTable({ actions }: ActionsTableProps) {
  const t = useTranslations('dev.scheduledActions')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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
      <Badge variant={config.variant} data-cy={config.cy}>
        {t(`status.${status}`)}
      </Badge>
    )
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  if (actions.length === 0) {
    return (
      <div
        className="text-center py-12 text-muted-foreground"
        data-cy={sel('devtools.scheduledActions.emptyState')}
      >
        <p className="text-lg font-medium">{t('empty')}</p>
        <p className="text-sm mt-1">{t('emptyDescription')}</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg" data-cy={sel('devtools.scheduledActions.table')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead data-cy={sel('devtools.scheduledActions.cellType')}>
              {t('table.type')}
            </TableHead>
            <TableHead data-cy={sel('devtools.scheduledActions.cellStatus')}>
              {t('table.status')}
            </TableHead>
            <TableHead data-cy={sel('devtools.scheduledActions.cellScheduledAt')}>
              {t('table.scheduledAt')}
            </TableHead>
            <TableHead data-cy={sel('devtools.scheduledActions.cellTeam')}>
              {t('table.team')}
            </TableHead>
            <TableHead data-cy={sel('devtools.scheduledActions.cellPayload')}>
              {t('table.payload')}
            </TableHead>
            <TableHead data-cy={sel('devtools.scheduledActions.cellError')}>
              {t('table.error')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => {
            const isExpanded = expandedRows.has(action.id)

            return (
              <TableRow
                key={action.id}
                data-cy={sel('devtools.scheduledActions.row', { id: action.id })}
              >
                <TableCell>
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
                <TableCell className="font-mono text-sm">
                  {action.actionType}
                </TableCell>
                <TableCell>{getStatusBadge(action.status)}</TableCell>
                <TableCell className="text-sm">
                  {formatDate(action.scheduledAt)}
                </TableCell>
                <TableCell className="text-sm">
                  {action.teamId ? (
                    <code className="text-xs">{action.teamId.slice(0, 8)}...</code>
                  ) : (
                    <span className="text-muted-foreground">{t('table.noTeam')}</span>
                  )}
                </TableCell>
                <TableCell>
                  {isExpanded ? (
                    <pre className="text-xs bg-muted p-2 rounded max-w-md overflow-auto">
                      {JSON.stringify(action.payload, null, 2)}
                    </pre>
                  ) : (
                    <code className="text-xs text-muted-foreground">
                      {JSON.stringify(action.payload).slice(0, 50)}...
                    </code>
                  )}
                </TableCell>
                <TableCell>
                  {action.errorMessage ? (
                    <code className="text-xs text-destructive">
                      {isExpanded ? action.errorMessage : `${action.errorMessage.slice(0, 30)}...`}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

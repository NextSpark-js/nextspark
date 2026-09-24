'use client'

import { useTranslations } from 'next-intl'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nextsparkjs/core/components/ui/table'
import type { Trace } from '../../types/observability.types'
import { TraceStatusBadge } from './TraceStatusBadge'

interface TracesTableProps {
  traces: Trace[]
  onSelect: (traceId: string) => void
  className?: string
}

export function TracesTable({ traces, onSelect, className = '' }: TracesTableProps) {
  const t = useTranslations('observability')

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTokens = (tokens: number) => {
    if (tokens === 0) return '-'
    return tokens.toLocaleString()
  }

  const truncateTraceId = (traceId: string) => {
    return `${traceId.substring(0, 8)}...${traceId.substring(traceId.length - 4)}`
  }

  const truncateInput = (input: string, maxLength = 60) => {
    if (!input) return '-'
    if (input.length <= maxLength) return input
    return `${input.substring(0, maxLength)}...`
  }

  if (traces.length === 0) {
    return (
      <div className="text-center py-12" data-cy="traces-table-empty">
        <p className="text-muted-foreground">{t('table.empty')}</p>
      </div>
    )
  }

  return (
    <div className={className} data-cy="traces-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.traceId')}</TableHead>
            <TableHead className="min-w-[200px]">{t('table.input')}</TableHead>
            <TableHead>{t('table.agent')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead>{t('table.duration')}</TableHead>
            <TableHead>{t('table.tokens')}</TableHead>
            <TableHead>{t('table.startedAt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {traces.map((trace) => (
            <TableRow
              key={trace.traceId}
              onClick={() => onSelect(trace.traceId)}
              className="cursor-pointer hover:bg-muted/50"
              data-cy="trace-row"
              data-trace-id={trace.traceId}
            >
              <TableCell className="font-mono text-xs" data-cy="trace-id">
                {truncateTraceId(trace.traceId)}
              </TableCell>
              <TableCell className="text-sm max-w-[300px]" data-cy="trace-input" title={trace.input}>
                {truncateInput(trace.input)}
              </TableCell>
              <TableCell data-cy="trace-agent">{trace.agentName}</TableCell>
              <TableCell data-cy="trace-status">
                <TraceStatusBadge status={trace.status} />
              </TableCell>
              <TableCell data-cy="trace-duration">{formatDuration(trace.durationMs)}</TableCell>
              <TableCell data-cy="trace-tokens">{formatTokens(trace.totalTokens)}</TableCell>
              <TableCell className="text-sm text-muted-foreground" data-cy="trace-started-at">
                {new Date(trace.startedAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

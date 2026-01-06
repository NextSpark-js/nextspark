'use client'

import { useTranslations } from 'next-intl'
import type { TraceStatus } from '../../types/observability.types'

interface TraceStatusBadgeProps {
  status: TraceStatus
  className?: string
}

export function TraceStatusBadge({ status, className = '' }: TraceStatusBadgeProps) {
  const t = useTranslations('observability')

  const statusConfig = {
    running: {
      label: t('status.running'),
      className: 'bg-muted text-muted-foreground border-border',
    },
    success: {
      label: t('status.success'),
      className: 'bg-muted text-foreground border-border',
    },
    error: {
      label: t('status.error'),
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
  }

  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${config.className} ${className}`}
      data-cy={`trace-status-${status}`}
    >
      {config.label}
    </span>
  )
}

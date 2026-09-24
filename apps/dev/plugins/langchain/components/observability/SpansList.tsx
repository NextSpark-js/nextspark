'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@nextsparkjs/core/components/ui/button'
import type { Span } from '../../types/observability.types'
import { TraceStatusBadge } from './TraceStatusBadge'

// Internal chain patterns to filter (LangChain infrastructure noise)
const INTERNAL_CHAIN_PATTERNS = [
  /^Chain:\s*(Runnable|Channel|Compiled)/i,
  /^RunnableSequence$/i,
  /^RunnableLambda$/i,
  /^ChannelWrite$/i,
  /^ChannelRead$/i,
]

interface SpansListProps {
  spans: Span[]
  className?: string
}

export function SpansList({ spans, className = '' }: SpansListProps) {
  const t = useTranslations('observability')
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set())
  const [showInternalChains, setShowInternalChains] = useState(false)

  // Filter internal chain spans
  const { displaySpans, hiddenCount } = useMemo(() => {
    if (showInternalChains) {
      return { displaySpans: spans, hiddenCount: 0 }
    }

    const filtered = spans.filter((span) => {
      // Always show non-chain spans
      if (span.type !== 'chain') return true
      // Always show chains with errors
      if (span.error) return true
      // Filter internal chains by pattern
      return !INTERNAL_CHAIN_PATTERNS.some((pattern) => pattern.test(span.name))
    })

    return {
      displaySpans: filtered,
      hiddenCount: spans.length - filtered.length,
    }
  }, [spans, showInternalChains])

  const toggleSpan = (spanId: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTokens = (input?: number, output?: number) => {
    if (!input && !output) return null
    return `${input || 0}/${output || 0} tokens`
  }

  const getSpanTypeLabel = (type: string) => {
    return type.toUpperCase()
  }

  if (spans.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-cy="spans-list-empty">
        {t('detail.noSpans')}
      </div>
    )
  }

  return (
    <div className={className} data-cy="spans-list">
      {/* Filter toggle */}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-between mb-3 p-2 bg-muted/50 rounded-lg" data-cy="spans-filter-info">
          <span className="text-sm text-muted-foreground">
            {t('detail.hiddenSpans', { count: hiddenCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInternalChains(!showInternalChains)}
            data-cy="toggle-internal-chains"
          >
            {showInternalChains ? t('detail.hideInternalChains') : t('detail.showInternalChains')}
          </Button>
        </div>
      )}
      {showInternalChains && hiddenCount > 0 && (
        <div className="flex justify-end mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInternalChains(false)}
            data-cy="hide-internal-chains"
          >
            {t('detail.hideInternalChains')}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {displaySpans.map((span) => {
        const isExpanded = expandedSpans.has(span.spanId)
        const hasDetails =
          (span.toolInput !== undefined && span.toolInput !== null) ||
          (span.toolOutput !== undefined && span.toolOutput !== null) ||
          !!span.error

        return (
          <div
            key={span.spanId}
            className="border border-border rounded-lg p-3 bg-card"
            data-cy={`span-item-${span.spanId}`}
            style={{ marginLeft: `${span.depth * 24}px` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded" data-cy="span-type">
                    {getSpanTypeLabel(span.type)}
                  </span>
                  <span className="font-medium text-foreground" data-cy="span-name">
                    {span.name}
                  </span>
                  <TraceStatusBadge status={span.status} />
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {span.provider && (
                    <span data-cy="span-provider">
                      {span.provider} / {span.model}
                    </span>
                  )}

                  {span.toolName && <span data-cy="span-tool-name">{span.toolName}</span>}

                  <span data-cy="span-duration">{formatDuration(span.durationMs)}</span>

                  {formatTokens(span.inputTokens, span.outputTokens) && (
                    <span data-cy="span-tokens">{formatTokens(span.inputTokens, span.outputTokens)}</span>
                  )}
                </div>

                {hasDetails && (
                  <button
                    onClick={() => toggleSpan(span.spanId)}
                    className="mt-2 text-sm text-primary hover:underline"
                    data-cy={`span-toggle-${span.spanId}`}
                  >
                    {isExpanded ? t('detail.hideDetails') : t('detail.showDetails')}
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-3 space-y-2" data-cy={`span-details-${span.spanId}`}>
                    {span.toolInput !== undefined && span.toolInput !== null && (
                      <div>
                        <div className="text-sm font-medium text-foreground mb-1">
                          {t('detail.toolInput')}
                        </div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(span.toolInput, null, 2)}
                        </pre>
                      </div>
                    )}

                    {span.toolOutput !== undefined && span.toolOutput !== null && (
                      <div>
                        <div className="text-sm font-medium text-foreground mb-1">
                          {t('detail.toolOutput')}
                        </div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(span.toolOutput, null, 2)}
                        </pre>
                      </div>
                    )}

                    {span.error && (
                      <div>
                        <div className="text-sm font-medium text-destructive mb-1">{t('detail.error')}</div>
                        <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-x-auto">
                          {span.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

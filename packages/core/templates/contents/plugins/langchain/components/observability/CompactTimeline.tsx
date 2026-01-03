'use client'

import type { Span } from '../../types/observability.types'

interface CompactTimelineProps {
  spans: Span[]
  className?: string
}

/**
 * Compact horizontal timeline showing execution flow with icons.
 * Shows: User → LLM → Tool (name) ✓/✗ → LLM → Response
 */
export function CompactTimeline({ spans, className = '' }: CompactTimelineProps) {
  // Filter to show only meaningful spans (LLM and tool)
  const meaningfulSpans = spans.filter(
    (span) => span.type === 'llm' || span.type === 'tool'
  )

  if (meaningfulSpans.length === 0) {
    return null
  }

  const getSpanIcon = (span: Span) => {
    if (span.type === 'llm') return '🧠'
    if (span.type === 'tool') return '🔧'
    return '📦'
  }

  const getStatusIcon = (status: string) => {
    if (status === 'success') return '✓'
    if (status === 'error') return '✗'
    return '...'
  }

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'text-green-600 dark:text-green-400'
    if (status === 'error') return 'text-red-600 dark:text-red-400'
    return 'text-yellow-600 dark:text-yellow-400'
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 text-sm ${className}`} data-cy="compact-timeline">
      {/* User icon at start */}
      <span className="text-base" title="User input">👤</span>
      <span className="text-muted-foreground">→</span>

      {meaningfulSpans.map((span, index) => (
        <div key={span.spanId} className="flex items-center gap-1">
          <span className="text-base" title={span.name}>
            {getSpanIcon(span)}
          </span>

          {span.type === 'tool' && span.toolName && (
            <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
              {span.toolName}
            </span>
          )}

          <span className={`text-xs font-bold ${getStatusColor(span.status)}`}>
            {getStatusIcon(span.status)}
          </span>

          {index < meaningfulSpans.length - 1 && (
            <span className="text-muted-foreground ml-1">→</span>
          )}
        </div>
      ))}

      {/* Response icon at end */}
      <span className="text-muted-foreground">→</span>
      <span className="text-base" title="AI Response">🤖</span>
    </div>
  )
}

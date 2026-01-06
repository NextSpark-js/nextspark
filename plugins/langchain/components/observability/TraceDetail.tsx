'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@nextsparkjs/core/components/ui/accordion'
import type { Trace, Span } from '../../types/observability.types'
import { TraceStatusBadge } from './TraceStatusBadge'
import { SpansList } from './SpansList'
import { ConversationFlow } from './ConversationFlow'
import { CompactTimeline } from './CompactTimeline'

interface ParentTraceInfo {
  traceId: string
  agentName: string
}

interface TraceDetailProps {
  trace: Trace
  spans: Span[]
  childTraces?: Trace[]
  childSpansMap?: Record<string, Span[]>
  parentTrace?: ParentTraceInfo
  onBack: () => void
  onSelectChildTrace?: (traceId: string) => void
  onSelectParentTrace?: (traceId: string) => void
  className?: string
}

export function TraceDetail({ trace, spans, childTraces = [], childSpansMap = {}, parentTrace, onBack, onSelectChildTrace, onSelectParentTrace, className = '' }: TraceDetailProps) {
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

  // Extract unique tools used in this trace
  const toolsUsed = useMemo(() => {
    return [...new Set(
      spans
        .filter((s) => s.type === 'tool' && s.toolName)
        .map((s) => s.toolName!)
    )]
  }, [spans])

  // Extract model info from LLM spans
  const modelInfo = useMemo(() => {
    const llmSpan = spans.find((s) => s.type === 'llm' && s.model)
    if (!llmSpan) return null
    return {
      model: llmSpan.model,
      provider: llmSpan.provider,
    }
  }, [spans])

  return (
    <div className={className} data-cy="trace-detail">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" onClick={onBack} data-cy="trace-back-button">
            ← {t('detail.back')}
          </Button>
          {parentTrace && onSelectParentTrace && (
            <>
              <span className="text-muted-foreground">/</span>
              <Button
                variant="link"
                onClick={() => onSelectParentTrace(parentTrace.traceId)}
                className="text-primary hover:underline p-0 h-auto font-medium"
                data-cy="parent-trace-link"
              >
                {parentTrace.agentName}
              </Button>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{trace.agentName}</span>
            </>
          )}
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('detail.title')}</h2>
            <p className="text-sm text-muted-foreground font-mono">{trace.traceId}</p>
          </div>
          <TraceStatusBadge status={trace.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.agent')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold" data-cy="trace-agent">
              {trace.agentName}
            </p>
            {trace.agentType && (
              <p className="text-sm text-muted-foreground">{trace.agentType}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.model')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold" data-cy="trace-model">
              {modelInfo?.model || '-'}
            </p>
            {modelInfo?.provider && (
              <p className="text-sm text-muted-foreground" data-cy="trace-provider">
                {modelInfo.provider}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.duration')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold" data-cy="trace-duration">
              {formatDuration(trace.durationMs)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.tokens')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold" data-cy="trace-tokens">
              {formatTokens(trace.totalTokens)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTokens(trace.inputTokens)} in / {formatTokens(trace.outputTokens)} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.calls')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold" data-cy="trace-calls">
              {trace.llmCalls} LLM / {trace.toolCalls} {t('detail.tools')}
            </p>
            {toolsUsed.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1" data-cy="trace-tools-used">
                {toolsUsed.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Error box - shown first when there's an error */}
        {trace.error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">{t('detail.error')}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre
                className="text-sm bg-destructive/10 text-destructive p-4 rounded-lg overflow-x-auto whitespace-pre-wrap"
                data-cy="trace-error"
              >
                {trace.error}
              </pre>
              {trace.errorStack && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    {t('detail.stackTrace')}
                  </summary>
                  <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded overflow-x-auto">
                    {trace.errorStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('detail.input')}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap"
              data-cy="trace-input"
            >
              {trace.input}
            </pre>
          </CardContent>
        </Card>

        {/* Conversation Flow - Human-readable execution view */}
        <ConversationFlow trace={trace} spans={spans} />

        {/* Child Traces - Sub-agent invocations with accordion */}
        {childTraces.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.childTraces')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full" data-cy="child-traces-list">
                {childTraces.map((child) => (
                  <AccordionItem
                    key={child.traceId}
                    value={child.traceId}
                    className="border rounded-lg mb-3 last:mb-0"
                    data-cy={`child-trace-${child.agentName}`}
                  >
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <TraceStatusBadge status={child.status} />
                          <div className="text-left">
                            <p className="font-medium">{child.agentName}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {child.traceId.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p>{formatDuration(child.durationMs)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTokens(child.totalTokens)} tokens
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4">
                      <div className="space-y-4 pt-2">
                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="bg-muted/50 rounded p-2">
                            <p className="text-muted-foreground text-xs">{t('detail.duration')}</p>
                            <p className="font-medium">{formatDuration(child.durationMs)}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <p className="text-muted-foreground text-xs">{t('detail.tokens')}</p>
                            <p className="font-medium">
                              {formatTokens(child.inputTokens)} / {formatTokens(child.outputTokens)}
                            </p>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <p className="text-muted-foreground text-xs">{t('detail.calls')}</p>
                            <p className="font-medium">
                              {child.llmCalls} LLM / {child.toolCalls} tools
                            </p>
                          </div>
                        </div>

                        {/* Compact Timeline - execution flow visualization */}
                        {childSpansMap[child.traceId] && childSpansMap[child.traceId].length > 0 && (
                          <div className="bg-muted/30 rounded-lg p-3">
                            <CompactTimeline spans={childSpansMap[child.traceId]} />
                          </div>
                        )}

                        {/* Error if exists */}
                        {child.error && (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-destructive mb-1">{t('detail.error')}</p>
                            <pre className="text-xs text-destructive whitespace-pre-wrap">
                              {child.error}
                            </pre>
                          </div>
                        )}

                        {/* Input */}
                        <div>
                          <p className="text-sm font-medium mb-2">{t('detail.input')}</p>
                          <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {child.input}
                          </pre>
                        </div>

                        {/* Output */}
                        {child.output && (
                          <div>
                            <p className="text-sm font-medium mb-2">{t('detail.output')}</p>
                            <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                              {child.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('detail.spans')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SpansList spans={spans} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

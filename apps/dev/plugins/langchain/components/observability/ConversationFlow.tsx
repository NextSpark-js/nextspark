'use client'

/**
 * ConversationFlow Component
 *
 * Displays a human-readable view of the agent execution flow,
 * showing tool calls, their inputs/outputs, and LLM responses
 * in a chronological conversation format.
 */

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import type { Span, Trace } from '../../types/observability.types'
import { CollapsibleJson } from './CollapsibleJson'

interface ConversationFlowProps {
  trace: Trace
  spans: Span[]
}

interface FlowStep {
  id: string
  type: 'user' | 'llm' | 'tool_call' | 'tool_result' | 'assistant'
  timestamp: string
  content: string
  rawData?: unknown  // For JSON data (tool inputs/outputs)
  metadata?: {
    model?: string
    provider?: string
    toolName?: string
    duration?: number
    tokens?: { input?: number; output?: number }
  }
  status?: 'success' | 'error' | 'running'
}

function formatJson(data: unknown): string {
  if (!data) return ''
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return data
    }
  }
  return JSON.stringify(data, null, 2)
}

function truncateContent(content: string, maxLength = 500): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '...'
}

export function ConversationFlow({ trace, spans }: ConversationFlowProps) {
  const t = useTranslations('observability')

  // Transform spans into a chronological flow
  const flowSteps = useMemo(() => {
    const steps: FlowStep[] = []

    // 1. User message (from trace input)
    steps.push({
      id: 'user-input',
      type: 'user',
      timestamp: trace.startedAt,
      content: trace.input,
    })

    // 2. Process spans in order
    const sortedSpans = [...spans].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    )

    for (const span of sortedSpans) {
      if (span.type === 'llm') {
        // LLM call
        steps.push({
          id: `llm-${span.spanId}`,
          type: 'llm',
          timestamp: span.startedAt,
          content: span.model || span.name,
          metadata: {
            model: span.model,
            provider: span.provider,
            duration: span.durationMs,
            tokens: {
              input: span.inputTokens,
              output: span.outputTokens,
            },
          },
          status: span.status,
        })
      } else if (span.type === 'tool') {
        // Tool call with input
        const toolInput = span.toolInput || span.input
        if (toolInput) {
          steps.push({
            id: `tool-call-${span.spanId}`,
            type: 'tool_call',
            timestamp: span.startedAt,
            content: formatJson(toolInput),
            rawData: toolInput,
            metadata: {
              toolName: span.toolName || span.name.replace('Tool: ', ''),
              duration: span.durationMs,
            },
            status: span.status,
          })
        }

        // Tool result
        const toolOutput = span.toolOutput || span.output
        if (toolOutput) {
          steps.push({
            id: `tool-result-${span.spanId}`,
            type: 'tool_result',
            timestamp: span.endedAt || span.startedAt,
            content: formatJson(toolOutput),
            rawData: toolOutput,
            metadata: {
              toolName: span.toolName || span.name.replace('Tool: ', ''),
            },
            status: span.status,
          })
        }
      }
    }

    // 3. Final assistant response (from trace output)
    if (trace.output) {
      steps.push({
        id: 'assistant-output',
        type: 'assistant',
        timestamp: trace.endedAt || trace.startedAt,
        content: trace.output,
      })
    }

    return steps
  }, [trace, spans])

  const getStepLabel = (step: FlowStep) => {
    switch (step.type) {
      case 'user':
        return t('flow.userMessage')
      case 'llm':
        return step.metadata?.provider
          ? `${step.metadata.provider} / ${step.metadata?.model || 'unknown'}`
          : `LLM: ${step.metadata?.model || 'unknown'}`
      case 'tool_call':
        return `${t('flow.toolCall')}: ${step.metadata?.toolName}`
      case 'tool_result':
        return `${t('flow.toolResult')}: ${step.metadata?.toolName}`
      case 'assistant':
        return t('flow.assistantResponse')
      default:
        return step.type
    }
  }

  const getStepStyles = (type: FlowStep['type']) => {
    // Use semantic theme colors with subtle differentiation
    switch (type) {
      case 'user':
        return 'bg-muted/50 border-border'
      case 'llm':
        return 'bg-muted/30 border-border'
      case 'tool_call':
        return 'bg-card border-border'
      case 'tool_result':
        return 'bg-card border-border'
      case 'assistant':
        return 'bg-muted/50 border-border'
      default:
        return 'bg-muted border-border'
    }
  }

  const getStepTypeLabel = (type: FlowStep['type']) => {
    const labels: Record<FlowStep['type'], string> = {
      user: 'USER',
      llm: 'LLM',
      tool_call: 'CALL',
      tool_result: 'RESULT',
      assistant: 'ASSISTANT',
    }
    return labels[type] || type
  }

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch {
      return ''
    }
  }

  return (
    <Card data-cy="conversation-flow">
      <CardHeader>
        <CardTitle>{t('flow.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {flowSteps.map((step, index) => (
            <div
              key={step.id}
              className={`relative rounded-lg border p-4 ${getStepStyles(step.type)}`}
              data-cy={`flow-step-${step.type}`}
            >
              {/* Connection line */}
              {index < flowSteps.length - 1 && (
                <div className="absolute left-6 top-full h-3 w-0.5 bg-border" />
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {getStepTypeLabel(step.type)}
                  </span>
                  <span className="font-medium text-sm">{getStepLabel(step)}</span>
                  {step.status === 'error' && (
                    <Badge variant="destructive" className="text-xs">
                      Error
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {step.metadata?.duration && (
                    <span>{step.metadata.duration}ms</span>
                  )}
                  {step.metadata?.tokens?.input !== undefined && (
                    <span>
                      {step.metadata.tokens.input}/{step.metadata.tokens.output} tokens
                    </span>
                  )}
                  <span>{formatTime(step.timestamp)}</span>
                </div>
              </div>

              {/* Content */}
              <div className="mt-2">
                {step.type === 'user' || step.type === 'assistant' ? (
                  <p className="text-sm whitespace-pre-wrap">{step.content}</p>
                ) : step.type === 'llm' ? (
                  <p className="text-sm text-muted-foreground">{step.content}</p>
                ) : step.rawData ? (
                  <CollapsibleJson data={step.rawData} maxPreviewLength={150} />
                ) : (
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                    {truncateContent(step.content, 1000)}
                  </pre>
                )}
              </div>
            </div>
          ))}

          {flowSteps.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {t('flow.noSteps')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

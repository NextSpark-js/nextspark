/**
 * LangChain Tracer Service
 *
 * Core tracing service for LangChain agent observability.
 * Tracks traces (agent invocations) and spans (individual operations).
 */

import { randomUUID } from 'crypto'
import { queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import type {
  ObservabilityConfig,
  TraceContext,
  SpanContext,
  StartTraceOptions,
  EndTraceOptions,
  StartSpanOptions,
  EndSpanOptions,
  ContentType,
} from '../types/observability.types'

/**
 * Tracer service singleton
 */
class Tracer {
  private config: ObservabilityConfig | null = null

  /**
   * Initialize tracer with configuration
   * MUST be called by theme before using tracer
   */
  init(config: ObservabilityConfig): void {
    this.config = config
  }

  /**
   * Check if tracer has been initialized
   */
  isInitialized(): boolean {
    return this.config !== null
  }

  /**
   * Check if tracing should occur based on configuration
   * Considers enabled flag and sampling rate
   */
  shouldTrace(isError = false): boolean {
    if (!this.config) {
      return false
    }

    if (!this.config.enabled) {
      return false
    }

    // Always trace errors if configured
    if (isError && this.config.sampling.alwaysTraceErrors) {
      return true
    }

    // Apply sampling rate
    return Math.random() < this.config.sampling.rate
  }

  /**
   * Start a new trace
   */
  async startTrace(
    context: { userId: string; teamId: string },
    agentName: string,
    input: string,
    options?: StartTraceOptions
  ): Promise<TraceContext | null> {
    if (!this.shouldTrace()) {
      return null
    }

    const traceId = randomUUID()
    const processedInput = this.processContent(input, 'input')

    try {
      await mutateWithRLS(
        `INSERT INTO public."langchain_traces" (
          "traceId",
          "userId",
          "teamId",
          "sessionId",
          "agentName",
          "agentType",
          "parentId",
          input,
          status,
          metadata,
          tags,
          "startedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
        [
          traceId,
          context.userId,
          context.teamId,
          options?.sessionId || null,
          agentName,
          options?.agentType || null,
          options?.parentId || null,
          processedInput,
          'running',
          JSON.stringify(options?.metadata || {}),
          options?.tags || [],
        ],
        context.userId
      )

      return {
        traceId,
        userId: context.userId,
        teamId: context.teamId,
        sessionId: options?.sessionId,
        agentName,
      }
    } catch (error) {
      console.error('[Tracer] Failed to start trace:', error)
      return null
    }
  }

  /**
   * End a trace
   */
  async endTrace(
    context: { userId: string; teamId: string },
    traceId: string,
    options: EndTraceOptions
  ): Promise<void> {
    try {
      const status = options.error ? 'error' : 'success'
      const processedOutput = options.output
        ? this.processContent(options.output, 'output')
        : null

      // Extract error details
      let errorMessage: string | null = null
      let errorType: string | null = null
      let errorStack: string | null = null

      if (options.error) {
        if (options.error instanceof Error) {
          errorMessage = options.error.message
          errorType = options.error.name
          errorStack = options.error.stack || null
        } else {
          errorMessage = String(options.error)
        }
      }

      await mutateWithRLS(
        `UPDATE public."langchain_traces"
         SET
           output = $1,
           status = $2,
           error = $3,
           "errorType" = $4,
           "errorStack" = $5,
           "endedAt" = now(),
           "durationMs" = EXTRACT(EPOCH FROM (now() - "startedAt")) * 1000,
           "inputTokens" = $6,
           "outputTokens" = $7,
           "totalTokens" = $8,
           "totalCost" = $9,
           "llmCalls" = $10,
           "toolCalls" = $11,
           metadata = COALESCE(metadata, '{}'::jsonb) || $12::jsonb
         WHERE "traceId" = $13`,
        [
          processedOutput,
          status,
          errorMessage,
          errorType,
          errorStack,
          options.tokens?.input || 0,
          options.tokens?.output || 0,
          options.tokens?.total || 0,
          options.cost || 0,
          options.llmCalls || 0,
          options.toolCalls || 0,
          JSON.stringify(options.metadata || {}),
          traceId,
        ],
        context.userId
      )
    } catch (error) {
      console.error('[Tracer] Failed to end trace:', error)
    }
  }

  /**
   * Start a span within a trace
   */
  async startSpan(
    context: { userId: string; teamId: string },
    traceId: string,
    options: StartSpanOptions
  ): Promise<SpanContext | null> {
    if (!this.config?.enabled) {
      return null
    }

    const spanId = randomUUID()
    const depth = options.depth || 0

    try {
      await mutateWithRLS(
        `INSERT INTO public."langchain_spans" (
          "spanId",
          "traceId",
          "parentSpanId",
          name,
          type,
          provider,
          model,
          "toolName",
          input,
          status,
          depth,
          "startedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
        [
          spanId,
          traceId,
          options.parentSpanId || null,
          options.name,
          options.type,
          options.provider || null,
          options.model || null,
          options.toolName || null,
          options.input ? JSON.stringify(options.input) : null,
          'running',
          depth,
        ],
        context.userId
      )

      return {
        spanId,
        traceId,
        parentSpanId: options.parentSpanId,
        name: options.name,
        type: options.type,
        depth,
        startedAt: new Date(),
      }
    } catch (error) {
      console.error('[Tracer] Failed to start span:', error)
      return null
    }
  }

  /**
   * End a span
   */
  async endSpan(
    context: { userId: string; teamId: string },
    traceId: string,
    spanId: string,
    options: EndSpanOptions
  ): Promise<void> {
    try {
      const status = options.error ? 'error' : 'success'
      const errorMessage = options.error
        ? options.error instanceof Error
          ? options.error.message
          : String(options.error)
        : null

      await mutateWithRLS(
        `UPDATE public."langchain_spans"
         SET
           output = $1,
           "toolInput" = $2,
           "toolOutput" = $3,
           status = $4,
           error = $5,
           "inputTokens" = $6,
           "outputTokens" = $7,
           "endedAt" = now(),
           "durationMs" = EXTRACT(EPOCH FROM (now() - "startedAt")) * 1000
         WHERE "traceId" = $8 AND "spanId" = $9`,
        [
          options.output ? JSON.stringify(options.output) : null,
          options.toolInput ? JSON.stringify(options.toolInput) : null,
          options.toolOutput ? JSON.stringify(options.toolOutput) : null,
          status,
          errorMessage,
          options.tokens?.input || null,
          options.tokens?.output || null,
          traceId,
          spanId,
        ],
        context.userId
      )
    } catch (error) {
      console.error('[Tracer] Failed to end span:', error)
    }
  }

  /**
   * Process content for storage: truncate and optionally mask PII
   */
  processContent(content: string, type: ContentType): string {
    if (!this.config) {
      return content.slice(0, 10000) // Default truncation
    }

    const { pii } = this.config

    // Apply PII masking if configured
    let processed = content
    if (
      (type === 'input' && pii.maskInputs) ||
      (type === 'output' && pii.maskOutputs)
    ) {
      // Simple PII masking patterns
      // Email addresses
      processed = processed.replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL]'
      )
      // Phone numbers (various formats)
      processed = processed.replace(
        /\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        '[PHONE]'
      )
      // Credit card numbers (basic pattern)
      processed = processed.replace(
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        '[CARD]'
      )
      // SSN (US format)
      processed = processed.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    }

    // Truncate to configured length
    if (processed.length > pii.truncateAt) {
      processed = processed.slice(0, pii.truncateAt) + '...[truncated]'
    }

    return processed
  }
}

// Export singleton instance
export const tracer = new Tracer()

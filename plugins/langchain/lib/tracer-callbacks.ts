/**
 * LangChain Tracing Callback Handler
 *
 * Captures LangChain events (LLM calls, tool executions, chain steps)
 * and creates spans for observability.
 */

import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Serialized } from '@langchain/core/load/serializable'
import { tracer } from './tracer'
import type { SpanContext } from '../types/observability.types'

interface TracingCallbackHandlerOptions {
  context: { userId: string; teamId: string }
  traceId: string
  /** Model name to use when LangChain doesn't provide it in callbacks */
  modelName?: string
}

/**
 * Callback handler that creates spans for LangChain events
 */
export class TracingCallbackHandler extends BaseCallbackHandler {
  name = 'tracing_callback_handler'

  private context: { userId: string; teamId: string }
  private traceId: string
  private spans: Map<string, SpanContext>
  private parentSpans: Map<string, string>
  private modelName?: string

  // Counters for LLM and tool calls
  private _llmCallCount = 0
  private _toolCallCount = 0

  // Track pending async operations to ensure all callbacks complete
  private pendingOperations: Promise<void>[] = []

  constructor(options: TracingCallbackHandlerOptions) {
    super()
    this.context = options.context
    this.traceId = options.traceId
    this.modelName = options.modelName
    this.spans = new Map()
    this.parentSpans = new Map()
  }

  /**
   * Track an async operation for later flushing
   */
  private trackOperation(promise: Promise<void>): void {
    this.pendingOperations.push(promise)
    // Clean up completed promises periodically
    promise.finally(() => {
      const index = this.pendingOperations.indexOf(promise)
      if (index > -1) {
        this.pendingOperations.splice(index, 1)
      }
    })
  }

  /**
   * Wait for all pending operations to complete
   * Call this before getCounts() to ensure accurate counts
   */
  async flush(): Promise<void> {
    // Wait for all pending operations with a timeout
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000))
    await Promise.race([
      Promise.all(this.pendingOperations),
      timeout,
    ])
  }

  /**
   * Get the count of LLM and tool calls
   */
  getCounts(): { llmCalls: number; toolCalls: number } {
    return {
      llmCalls: this._llmCallCount,
      toolCalls: this._toolCallCount,
    }
  }

  /**
   * LLM Events
   */

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    const operation = (async () => {
      try {
        const provider = llm.id?.[llm.id.length - 1] || 'unknown'
        // Extract model name from various possible locations (expanded for Ollama compatibility)
        const llmAny = llm as any

        const model =
          // Standard locations
          llmAny.kwargs?.model ||
          llmAny.kwargs?.model_name ||
          llmAny.kwargs?.modelName ||
          llmAny.kwargs?.model_id ||
          llmAny.model ||
          llmAny.model_name ||
          llmAny.modelName ||
          // Ollama-specific locations
          llmAny.kwargs?.configuration?.model ||
          llmAny.kwargs?.options?.model ||
          llmAny.lc_kwargs?.model ||
          // ChatOllama specific
          llmAny.kwargs?.base_url && llmAny.kwargs?.model ||
          // Last resort: try to extract from id array
          (Array.isArray(llm.id) && llm.id.find((id: string) => id.includes(':') || id.includes('-'))) ||
          // Use model name passed from config (fallback for providers like Ollama)
          this.modelName ||
          'unknown'
        const depth = parentRunId ? (this.spans.get(parentRunId)?.depth || 0) + 1 : 0

        const spanContext = await tracer.startSpan(this.context, this.traceId, {
          name: `LLM: ${model}`,
          type: 'llm',
          provider,
          model,
          parentSpanId: parentRunId ? this.parentSpans.get(parentRunId) : undefined,
          depth,
          input: { prompts },
        })

        if (spanContext) {
          this.spans.set(runId, spanContext)
          if (parentRunId) {
            this.parentSpans.set(runId, spanContext.spanId)
          }
        }
      } catch (error) {
        console.error('[TracingCallbackHandler] handleLLMStart error:', error)
      }
    })()
    this.trackOperation(operation)
    await operation
  }

  async handleLLMEnd(output: any, runId: string): Promise<void> {
    // Increment counter immediately (synchronously) to avoid race condition
    this._llmCallCount++

    const operation = (async () => {
      try {
        const spanContext = this.spans.get(runId)
        if (!spanContext) return

        // Extract token usage from output
        const usage = output.llmOutput?.tokenUsage || {}
        const tokens = {
          input: usage.promptTokens || usage.input_tokens || 0,
          output: usage.completionTokens || usage.output_tokens || 0,
        }

        await tracer.endSpan(this.context, this.traceId, spanContext.spanId, {
          output: {
            generations: output.generations?.map((gen: any) => gen.text || gen.message?.content),
          },
          tokens: tokens.input || tokens.output ? tokens : undefined,
        })

        this.spans.delete(runId)
        this.parentSpans.delete(runId)
      } catch (error) {
        console.error('[TracingCallbackHandler] handleLLMEnd error:', error)
      }
    })()
    this.trackOperation(operation)
  }

  async handleLLMError(error: Error, runId: string): Promise<void> {
    try {
      const spanContext = this.spans.get(runId)
      if (!spanContext) return

      await tracer.endSpan(this.context, this.traceId, spanContext.spanId, {
        error,
      })

      this.spans.delete(runId)
      this.parentSpans.delete(runId)
    } catch (err) {
      console.error('[TracingCallbackHandler] handleLLMError error:', err)
    }
  }

  /**
   * Tool Events
   */

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    try {
      const toolName = tool.id?.[tool.id.length - 1] || 'unknown'
      const depth = parentRunId ? (this.spans.get(parentRunId)?.depth || 0) + 1 : 0

      const spanContext = await tracer.startSpan(this.context, this.traceId, {
        name: `Tool: ${toolName}`,
        type: 'tool',
        toolName,
        parentSpanId: parentRunId ? this.parentSpans.get(parentRunId) : undefined,
        depth,
        input: { toolInput: input },
      })

      if (spanContext) {
        this.spans.set(runId, spanContext)
        if (parentRunId) {
          this.parentSpans.set(runId, spanContext.spanId)
        }
      }
    } catch (error) {
      console.error('[TracingCallbackHandler] handleToolStart error:', error)
    }
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    // Increment counter immediately (synchronously) to avoid race condition
    this._toolCallCount++

    const operation = (async () => {
      try {
        const spanContext = this.spans.get(runId)
        if (!spanContext) return

        await tracer.endSpan(this.context, this.traceId, spanContext.spanId, {
          toolOutput: output,
        })

        this.spans.delete(runId)
        this.parentSpans.delete(runId)
      } catch (error) {
        console.error('[TracingCallbackHandler] handleToolEnd error:', error)
      }
    })()
    this.trackOperation(operation)
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    try {
      const spanContext = this.spans.get(runId)
      if (!spanContext) return

      await tracer.endSpan(this.context, this.traceId, spanContext.spanId, {
        error,
      })

      this.spans.delete(runId)
      this.parentSpans.delete(runId)
    } catch (err) {
      console.error('[TracingCallbackHandler] handleToolError error:', err)
    }
  }

  /**
   * Chain Events
   */

  async handleChainStart(
    chain: Serialized,
    inputs: Record<string, unknown>,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    try {
      const chainName = chain.id?.[chain.id.length - 1] || 'unknown'
      const depth = parentRunId ? (this.spans.get(parentRunId)?.depth || 0) + 1 : 0

      const spanContext = await tracer.startSpan(this.context, this.traceId, {
        name: `Chain: ${chainName}`,
        type: 'chain',
        parentSpanId: parentRunId ? this.parentSpans.get(parentRunId) : undefined,
        depth,
        input: inputs,
      })

      if (spanContext) {
        this.spans.set(runId, spanContext)
        if (parentRunId) {
          this.parentSpans.set(runId, spanContext.spanId)
        }
      }
    } catch (error) {
      console.error('[TracingCallbackHandler] handleChainStart error:', error)
    }
  }

  async handleChainEnd(outputs: Record<string, unknown>, runId: string): Promise<void> {
    try {
      const spanContext = this.spans.get(runId)
      if (!spanContext) return

      await tracer.endSpan(this.context, this.traceId, spanContext.spanId, {
        output: outputs,
      })

      this.spans.delete(runId)
      this.parentSpans.delete(runId)
    } catch (error) {
      console.error('[TracingCallbackHandler] handleChainEnd error:', error)
    }
  }

  async handleChainError(error: Error, runId: string): Promise<void> {
    try {
      const spanContext = this.spans.get(runId)
      if (!spanContext) return

      await tracer.endSpan(this.context, this.traceId, spanContext.spanId, {
        error,
      })

      this.spans.delete(runId)
      this.parentSpans.delete(runId)
    } catch (err) {
      console.error('[TracingCallbackHandler] handleChainError error:', err)
    }
  }
}

/**
 * Factory function to create tracing callbacks
 */
export function createTracingCallbacks(
  context: { userId: string; teamId: string },
  traceId: string,
  modelName?: string
): TracingCallbackHandler {
  return new TracingCallbackHandler({ context, traceId, modelName })
}

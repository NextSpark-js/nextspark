/**
 * LangChain Observability Types
 *
 * Type definitions for trace and span tracking in LangChain agents.
 */

/**
 * Trace status
 */
export type TraceStatus = 'running' | 'success' | 'error'

/**
 * Span type
 */
export type SpanType = 'llm' | 'tool' | 'chain' | 'retriever'

/**
 * Full trace record with all observability data
 */
export interface Trace {
  /** Unique trace identifier */
  traceId: string
  /** User who triggered the invocation */
  userId: string
  /** Team context */
  teamId: string
  /** Optional session identifier */
  sessionId?: string
  /** Name of the agent */
  agentName: string
  /** Type/category of agent */
  agentType?: string
  /** Parent trace ID for nested calls */
  parentId?: string
  /** Agent input (truncated) */
  input: string
  /** Agent output (truncated) */
  output?: string
  /** Trace status */
  status: TraceStatus
  /** Error message if failed */
  error?: string
  /** Error type/category */
  errorType?: string
  /** Error stack trace */
  errorStack?: string
  /** Trace start timestamp */
  startedAt: string
  /** Trace end timestamp */
  endedAt?: string
  /** Total duration in milliseconds */
  durationMs?: number
  /** Total input tokens */
  inputTokens: number
  /** Total output tokens */
  outputTokens: number
  /** Total tokens (input + output) */
  totalTokens: number
  /** Total cost in USD */
  totalCost: number
  /** Number of LLM calls */
  llmCalls: number
  /** Number of tool calls */
  toolCalls: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Tags for filtering */
  tags?: string[]
  /** Record creation timestamp */
  createdAt: string
}

/**
 * Individual operation (span) within a trace
 */
export interface Span {
  /** Unique span identifier */
  spanId: string
  /** Parent trace identifier */
  traceId: string
  /** Parent span ID for nested operations */
  parentSpanId?: string
  /** Span name/description */
  name: string
  /** Span type */
  type: SpanType
  /** LLM provider (openai, anthropic, etc) */
  provider?: string
  /** LLM model name */
  model?: string
  /** Input tokens (LLM spans) */
  inputTokens?: number
  /** Output tokens (LLM spans) */
  outputTokens?: number
  /** Tool name (tool spans) */
  toolName?: string
  /** Tool input data (tool spans) */
  toolInput?: unknown
  /** Tool output data (tool spans) */
  toolOutput?: unknown
  /** Generic span input */
  input?: unknown
  /** Generic span output */
  output?: unknown
  /** Span status */
  status: TraceStatus
  /** Error message if failed */
  error?: string
  /** Span start timestamp */
  startedAt: string
  /** Span end timestamp */
  endedAt?: string
  /** Span duration in milliseconds */
  durationMs?: number
  /** Nesting depth in span tree */
  depth: number
  /** Record creation timestamp */
  createdAt: string
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  /** Whether observability is enabled */
  enabled: boolean
  /** Data retention settings */
  retention: {
    /** Days to keep trace data */
    traces: number
  }
  /** Sampling configuration */
  sampling: {
    /** Sample rate (0.0-1.0) */
    rate: number
    /** Always trace errors regardless of sample rate */
    alwaysTraceErrors: boolean
  }
  /** PII and content processing */
  pii: {
    /** Mask inputs for PII */
    maskInputs: boolean
    /** Mask outputs for PII */
    maskOutputs: boolean
    /** Truncate content at this length */
    truncateAt: number
  }
}

/**
 * Runtime trace context
 */
export interface TraceContext {
  /** Trace identifier */
  traceId: string
  /** User ID */
  userId: string
  /** Team ID */
  teamId: string
  /** Optional session ID */
  sessionId?: string
  /** Agent name */
  agentName: string
}

/**
 * Runtime span context
 */
export interface SpanContext {
  /** Span identifier */
  spanId: string
  /** Parent trace ID */
  traceId: string
  /** Parent span ID (if nested) */
  parentSpanId?: string
  /** Span name */
  name: string
  /** Span type */
  type: SpanType
  /** Nesting depth */
  depth: number
  /** Start timestamp */
  startedAt: Date
}

/**
 * Options for starting a trace
 */
export interface StartTraceOptions {
  /** Agent type/category */
  agentType?: string
  /** Parent trace ID for nested calls */
  parentId?: string
  /** Session ID */
  sessionId?: string
  /** Initial metadata */
  metadata?: Record<string, unknown>
  /** Initial tags */
  tags?: string[]
}

/**
 * Options for ending a trace
 */
export interface EndTraceOptions {
  /** Output content */
  output?: string
  /** Error if trace failed */
  error?: Error | string
  /** Token usage */
  tokens?: {
    input: number
    output: number
    total: number
  }
  /** Cost in USD */
  cost?: number
  /** LLM call count */
  llmCalls?: number
  /** Tool call count */
  toolCalls?: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Options for starting a span
 */
export interface StartSpanOptions {
  /** Span name */
  name: string
  /** Span type */
  type: SpanType
  /** Parent span ID (if nested) */
  parentSpanId?: string
  /** Nesting depth */
  depth?: number
  /** LLM provider */
  provider?: string
  /** LLM model */
  model?: string
  /** Tool name */
  toolName?: string
  /** Span input */
  input?: unknown
}

/**
 * Options for ending a span
 */
export interface EndSpanOptions {
  /** Span output */
  output?: unknown
  /** Error if span failed */
  error?: Error | string
  /** Token usage (LLM spans) */
  tokens?: {
    input: number
    output: number
  }
  /** Tool input (tool spans) */
  toolInput?: unknown
  /** Tool output (tool spans) */
  toolOutput?: unknown
}

/**
 * Content type for processing
 */
export type ContentType = 'input' | 'output'

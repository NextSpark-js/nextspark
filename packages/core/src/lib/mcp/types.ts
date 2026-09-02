/**
 * MCP Engine — shared types.
 *
 * The engine is registry-driven: it reads the entity registry passed into
 * createMcpEngine() and never imports theme files directly. Theme extensions
 * (overrides, extra tools, translations) are injected via McpEngineOptions,
 * which the default route template assembles from the generated
 * MCP_OVERRIDES registry.
 */

import type { z } from 'zod'
import type { EntityConfig } from '../entities/types'

export type McpOperation = 'list' | 'get' | 'create' | 'update' | 'delete'

/**
 * Mutable shape used while building tool input schemas. Assignable to the
 * SDK's ZodRawShape (zod 4 declares it Readonly<Record<string, $ZodType>>).
 */
export type McpShape = Record<string, z.ZodTypeAny>

export const MUTATION_OPERATIONS: McpOperation[] = ['create', 'update', 'delete']

/** Resolved per-request identity, injected into every tool handler. */
export interface ToolExecutionContext {
  userId: string
  userRole: string
  teamId: string
  /** Raw Authorization header, forwarded verbatim to in-process handlers. */
  authHeader: string
  /** api_key.id of the caller — required for audit logging. */
  apiKeyId: string | null
  scopes: string[]
}

export interface McpToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface McpToolResultContent {
  type: 'text'
  text: string
}

export interface McpToolResult {
  content: McpToolResultContent[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export interface McpToolDefinition {
  name: string
  title: string
  description: string
  /** Raw shape passed to the SDK for tools/list JSON Schema generation. */
  inputSchema: McpShape
  /**
   * Strict validator run inside the handler before executing. The SDK builds
   * a non-strict object from inputSchema; this one rejects unknown keys and
   * enforces cross-field rules (e.g. from/to require dateField).
   */
  strictSchema: z.ZodTypeAny
  annotations?: McpToolAnnotations
  handler: (args: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<McpToolResult>
  /** Metadata for audit entries. */
  meta?: { entitySlug?: string; operation?: McpOperation | 'workflow' }
}

/** Thrown by overrides/handlers to short-circuit with an actionable message. */
export class McpToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'McpToolError'
  }
}

/** Result of an in-process entity API invocation. */
export interface EntityApiResult {
  status: number
  body: {
    success: boolean
    data?: unknown
    info?: Record<string, unknown>
    error?: string
    code?: string
    details?: unknown
  }
}

export interface ExecuteEntityArgs {
  slug: string
  operation: McpOperation
  id?: string
  query?: Record<string, string>
  body?: unknown
}

export type EntityExecutor = (
  args: ExecuteEntityArgs,
  ctx: ToolExecutionContext
) => Promise<EntityApiResult>

/**
 * API handed to override extraTools factories.
 *
 * `execute` and `entitySchemas` are the ENGINE's own wired versions: output
 * normalization (dates, transformOutput) and schema context (i18n option
 * labels, overrides) are applied there, so a workflow tool behaves exactly
 * like a generated one. Building schemas or calling handlers directly from an
 * override would silently skip both.
 */
export interface EngineApi {
  execute: EntityExecutor
  /** Schemas for an entity, built with the engine's i18n + override context. */
  entitySchemas: (slug: string) => { createShape: McpShape; updateShape: McpShape }
  toolPrefix: string
  defaultTimezone: string
  registry: Record<string, EntityConfig>
  translateApiError: (
    result: EntityApiResult,
    context: { slug: string; operation: string; hints?: string[] }
  ) => string
}

export interface McpEntityOverride {
  /** Hide the whole entity from the MCP surface. */
  exclude?: boolean
  /** Hide specific generated tools. First-class security mechanism. */
  excludeOperations?: McpOperation[]
  /** Field names that become optional in the MCP input schema even if the API requires them (pair with transformInput enforcement). */
  relaxRequired?: string[]
  describe?: {
    entity?: string
    fields?: Record<string, string>
    tools?: Partial<Record<McpOperation, string>>
  }
  /** Appended to 500-with-no-code errors (core swallows CHECK violations). */
  errorHints?: string[]
  /** May throw McpToolError to reject with an actionable message. */
  transformInput?: (
    operation: McpOperation,
    input: Record<string, unknown>,
    ctx: ToolExecutionContext
  ) => Record<string, unknown> | Promise<Record<string, unknown>>
  transformOutput?: (operation: McpOperation, output: unknown) => unknown
  extraTools?: (api: EngineApi) => McpToolDefinition[]
}

export interface AuditEntry {
  apiKeyId: string | null
  userId: string
  tool: string
  entitySlug?: string
  operation?: string
  recordId?: string
  teamId: string
  statusCode: number
  requestSummary: Record<string, unknown>
  responseTimeMs: number
}

export interface EntityPresetInfo {
  summary?: string
  presets: Array<{
    id: string
    title?: string
    method?: string
    description?: string
    params?: Record<string, unknown>
    payload?: Record<string, unknown>
  }>
}

export interface McpEngineOptions {
  /** e.g. 'acme' → acme_list_customers. Comes from app/theme config. */
  toolPrefix: string
  serverInfo?: { name: string; version: string }
  /** Core/reserved slugs never exposed (e.g. 'patterns'). */
  excludeSlugs?: string[]
  /** Operations generated by default for every entity. */
  defaultOperations?: McpOperation[]
  overrides?: Record<string, McpEntityOverride>
  /**
   * Per-entity description material harvested from api/presets.ts
   * (summary → entity description, presets → few-shot examples).
   */
  presets?: Record<string, EntityPresetInfo>
  /** Resolve the localized label of a select option ("dairy" → "Lácteos"). */
  translateOption?: (slug: string, fieldName: string, value: string) => string | undefined
  /** IANA timezone used to resolve relative dates ("this_week"). */
  defaultTimezone?: string
  /** Extra tools not attached to an entity (e.g. list_team_members). */
  utilityTools?: (api: EngineApi) => McpToolDefinition[]
  /** Injectable for tests. Defaults to the api_audit_log writer. */
  audit?: (entry: AuditEntry) => Promise<void>
  /** Injectable for tests. Defaults to the in-process executor. */
  executor?: EntityExecutor
}

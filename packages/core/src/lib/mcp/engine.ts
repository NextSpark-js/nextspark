/**
 * MCP Engine — registry-driven server factory.
 *
 * createMcpEngine(registry, options) builds the full tool set from the entity
 * registry (entities with access.api, minus reserved slugs) plus injected
 * overrides and utility tools. The engine NEVER imports theme files: overrides
 * and translations arrive via options — the default route template assembles
 * them from the generated MCP_OVERRIDES registry.
 *
 * Stateless per request: handleJsonRpc creates an ephemeral McpServer bound
 * to the request's ToolExecutionContext, processes the message(s), and tears
 * everything down. A tool call that reaches its handler is audited, best effort (lib/mcp/audit).
 *
 * No separate authorization layer runs here: every generated tool's executor
 * round-trips in-process through the real generic entity handlers, which
 * already enforce scope + team-role permission + ownership/field guards for
 * API-key auth (see tool-generator.ts). A hand-written tool (extraTools,
 * utilityTools) runs its own handler and is bound by them only for the API
 * handlers it calls through `api.execute`.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { JSONRPCMessageSchema, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import type { EntityConfig } from '../entities/types'
import { StatelessJsonRpcTransport } from './transport'
import { errorResult, errorStatusOf, generateEntityTools, normalizeDateFields } from './tool-generator'
import { buildEntitySchemas } from './schema-builder'
import { executeEntityOperation } from './executor'
import { auditToolCall } from './audit'
import { translateApiError } from './errors'
import { DEFAULT_TIMEZONE, exposedEntities, handWrittenToolFactories, scopesOfToolMeta, toolScopesOf } from './exposure'
import type {
  EngineApi,
  EntityExecutor,
  McpEngineOptions,
  McpOperation,
  McpToolDefinition,
  McpToolResult,
  ToolExecutionContext,
} from './types'

export interface McpEngine {
  tools: McpToolDefinition[]
  handleJsonRpc: (
    body: unknown,
    ctx: ToolExecutionContext
  ) => Promise<JSONRPCMessage | JSONRPCMessage[] | null>
  api: EngineApi
  /** The scopes a call to a tool needs before it runs: an entity tool's own, or the ones a tool declares in `meta.requiredScopes`. */
  requiredScopesFor: (toolName: string) => string[]
  /** Every scope some tool of this server needs. */
  toolScopes: string[]
  /** Tries to record, best effort, the tool calls of a body refused for missing scopes; `granted` is what the credential has. */
  auditRefused: (body: unknown, ctx: ToolExecutionContext, granted: readonly string[]) => Promise<void>
}

export function createMcpEngine(
  registry: Record<string, EntityConfig>,
  options: McpEngineOptions
): McpEngine {
  const executor = options.executor ?? executeEntityOperation
  const audit = options.audit ?? auditToolCall
  const overrides = options.overrides ?? {}

  /**
   * Single normalization point for every entity read/write, whatever calls it
   * (generated tool or workflow tool): DATE columns are trimmed to YYYY-MM-DD
   * (the core serializes them as timestamptz) and the entity's transformOutput
   * runs. Doing this in the executor instead of the tool generator is what
   * keeps workflow tools consistent — they bypassed both before.
   */
  const normalizingExecutor: EntityExecutor = async (args, ctx) => {
    const result = await executor(args, ctx)
    if (!result.body.success || result.body.data === undefined) return result

    const entityConfig = registry[args.slug]
    const dateFields =
      entityConfig?.fields?.filter((f) => f.type === 'date').map((f) => f.name) ?? []
    const override = overrides[args.slug]

    const normalizeRow = (row: unknown) => normalizeDateFields(row, dateFields)
    let data = Array.isArray(result.body.data)
      ? result.body.data.map(normalizeRow)
      : normalizeRow(result.body.data)
    if (override?.transformOutput) data = override.transformOutput(args.operation, data)

    return { ...result, body: { ...result.body, data } }
  }

  const api: EngineApi = {
    execute: normalizingExecutor,
    entitySchemas: (slug: string) => {
      const entityConfig = registry[slug]
      if (!entityConfig) throw new Error(`Unknown entity for MCP schemas: ${slug}`)
      return buildEntitySchemas(entityConfig, {
        translateOption: options.translateOption,
        override: overrides[slug],
      })
    },
    toolPrefix: options.toolPrefix,
    defaultTimezone: options.defaultTimezone ?? DEFAULT_TIMEZONE,
    registry,
    translateApiError,
  }

  const tools: McpToolDefinition[] = []

  // Which entities and operations get a tool is decided in ./exposure, shared with MCP browser sign-in: the scopes
  // it publishes, offers and grants are the ones these tools need.
  for (const { slug, entityConfig, override, operations } of exposedEntities(registry, options)) {
    tools.push(
      ...generateEntityTools(entityConfig, operations, override, {
        executor: normalizingExecutor,
        toolPrefix: options.toolPrefix,
        translateOption: options.translateOption,
        presets: options.presets?.[slug],
      })
    )
  }

  // A hand-written tool that needs a scope no generated tool uses and no override declares still works with an
  // API key, but MCP browser sign-in publishes and grants only the declared scopes, so no connection of it could
  // ever hold that one. Said once, when the tool is built, where the project can see it.
  const declaredScopes = new Set(toolScopesOf(registry, options))
  for (const factory of handWrittenToolFactories(options)) {
    for (const tool of factory(api)) {
      const undeclared = scopesOfToolMeta(tool.meta).filter(scope => !declaredScopes.has(scope))
      if (undeclared.length) {
        console.warn(
          `[mcp] The tool "${tool.name}" needs ${undeclared.join(', ')}, which no generated tool uses and no override declares. ` +
            'Add it to `extraToolScopes` in the entity\'s mcp.ts (or `utilityToolScopes`): until then no MCP browser sign-in connection can be granted it.'
        )
      }
      tools.push(tool)
    }
  }

  assertUniqueNames(tools)

  async function handleJsonRpc(
    body: unknown,
    ctx: ToolExecutionContext
  ): Promise<JSONRPCMessage | JSONRPCMessage[] | null> {
    const server = new McpServer(
      options.serverInfo ?? { name: `${options.toolPrefix}-mcp`, version: '1.0.0' }
    )

    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          // A strict ZodObject (not the raw shape): the SDK parses arguments
          // with it and emits additionalProperties:false in tools/list, so a
          // misspelled parameter is an error instead of being dropped
          // silently. Cross-field rules still live in tool.strictSchema,
          // which the handler applies.
          inputSchema: z.object(tool.inputSchema).strict(),
          annotations: tool.annotations,
        },
        (async (args: Record<string, unknown>) => {
          const startedAt = Date.now()
          let result: McpToolResult
          try {
            result = await tool.handler(args ?? {}, ctx)
          } catch (error) {
            result = errorResult(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`, 500)
          }
          await audit({
            apiKeyId: ctx.apiKeyId,
            oauth: ctx.principal?.oauth,
            userId: ctx.userId,
            tool: tool.name,
            entitySlug: tool.meta?.entitySlug,
            operation: tool.meta?.operation,
            recordId: typeof args?.id === 'string' ? args.id : undefined,
            teamId: ctx.teamId,
            // An API error keeps its status (403, 404, 409...); 400 is an error that never reached the API
            statusCode: result.isError ? (errorStatusOf(result) ?? 400) : 200,
            requestSummary: (args ?? {}) as Record<string, unknown>,
            responseTimeMs: Date.now() - startedAt,
          })
          return result
        }) as never
      )
    }

    const transport = new StatelessJsonRpcTransport()
    await server.connect(transport)
    // A message that is not a JSON-RPC envelope is answered -32600 right away: the SDK never replies to it, so the
    // transport would otherwise hold the connection until its timeout.
    const handleOne = async (message: unknown): Promise<JSONRPCMessage | null> => {
      if (!JSONRPCMessageSchema.safeParse(message).success) {
        const id = (message as { id?: unknown } | null)?.id
        return {
          jsonrpc: '2.0',
          id: typeof id === 'string' || typeof id === 'number' ? id : null,
          error: { code: -32600, message: 'Invalid Request' },
        } as unknown as JSONRPCMessage
      }
      return transport.handleMessage(message as JSONRPCMessage)
    }
    try {
      if (Array.isArray(body)) {
        const responses: JSONRPCMessage[] = []
        for (const message of body) {
          const response = await handleOne(message)
          if (response) responses.push(response)
        }
        return responses.length ? responses : null
      }
      return await handleOne(body)
    } finally {
      await transport.close()
    }
  }

  /**
   * The scopes a call to `toolName` needs before it runs. A generated entity tool: `<slug>:read|write|delete`, as
   * the API handler it runs declares it. A tool that makes several calls (a workflow, an extra or utility tool)
   * says so in `meta.requiredScopes`; one that does not is checked call by call where it makes them. None for an
   * unknown name.
   */
  function requiredScopesFor(toolName: string): string[] {
    return scopesOfToolMeta(tools.find(tool => tool.name === toolName)?.meta)
  }

  /**
   * Records, best effort, the tool calls of a body that was refused before anything ran because the credential
   * lacks scopes: for each well-formed call of a known tool it tries to write a row with status 403 and what that
   * call was missing (a failed write is logged, lib/mcp/audit). An attempt to do what was not granted is the part
   * of an agent's activity most worth being able to reconstruct.
   */
  async function auditRefused(body: unknown, ctx: ToolExecutionContext, granted: readonly string[]): Promise<void> {
    for (const message of Array.isArray(body) ? body : [body]) {
      const call = message as { jsonrpc?: unknown; method?: unknown; params?: { name?: unknown; arguments?: unknown } } | null
      if (call?.jsonrpc !== '2.0' || call.method !== 'tools/call' || typeof call.params?.name !== 'string') continue
      const tool = tools.find(candidate => candidate.name === call.params!.name)
      if (!tool) continue
      const args = (call.params.arguments && typeof call.params.arguments === 'object' ? call.params.arguments : {}) as Record<string, unknown>
      await audit({
        apiKeyId: ctx.apiKeyId,
        oauth: ctx.principal?.oauth,
        userId: ctx.userId,
        tool: tool.name,
        entitySlug: tool.meta?.entitySlug,
        operation: tool.meta?.operation,
        recordId: typeof args.id === 'string' ? args.id : undefined,
        teamId: ctx.teamId,
        statusCode: 403,
        requestSummary: args,
        responseTimeMs: 0,
        missingScopes: requiredScopesFor(tool.name).filter(scope => !granted.includes(scope)),
      })
    }
  }

  /** Every scope some tool needs, for telling a client what there is to ask for. */
  const toolScopes = [...new Set(tools.flatMap(tool => requiredScopesFor(tool.name)))].sort()

  return { tools, handleJsonRpc, api, requiredScopesFor, toolScopes, auditRefused }
}

function assertUniqueNames(tools: McpToolDefinition[]): void {
  const seen = new Set<string>()
  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw new Error(`Duplicate MCP tool name: ${tool.name}`)
    }
    seen.add(tool.name)
  }
}

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
 * everything down. Every tool call is audited.
 *
 * No separate authorization layer runs here: every generated tool's executor
 * round-trips in-process through the real generic entity handlers, which
 * already enforce scope + team-role permission + ownership/field guards for
 * API-key auth (see tool-generator.ts).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { EntityConfig } from '../entities/types'
import { StatelessJsonRpcTransport } from './transport'
import { generateEntityTools, normalizeDateFields } from './tool-generator'
import { buildEntitySchemas } from './schema-builder'
import { executeEntityOperation } from './executor'
import { auditToolCall } from './audit'
import { translateApiError } from './errors'
import type {
  EngineApi,
  EntityExecutor,
  McpEngineOptions,
  McpOperation,
  McpToolDefinition,
  McpToolResult,
  ToolExecutionContext,
} from './types'

const DEFAULT_OPERATIONS: McpOperation[] = ['list', 'get', 'create', 'update', 'delete']
const DEFAULT_EXCLUDED_SLUGS = ['patterns']
const DEFAULT_TIMEZONE = 'UTC'

export interface McpEngine {
  tools: McpToolDefinition[]
  handleJsonRpc: (
    body: unknown,
    ctx: ToolExecutionContext
  ) => Promise<JSONRPCMessage | JSONRPCMessage[] | null>
  api: EngineApi
}

export function createMcpEngine(
  registry: Record<string, EntityConfig>,
  options: McpEngineOptions
): McpEngine {
  const executor = options.executor ?? executeEntityOperation
  const audit = options.audit ?? auditToolCall
  const excluded = new Set(options.excludeSlugs ?? DEFAULT_EXCLUDED_SLUGS)
  const defaultOperations = options.defaultOperations ?? DEFAULT_OPERATIONS
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

  for (const [slug, entityConfig] of Object.entries(registry)) {
    if (excluded.has(slug)) continue
    if (!entityConfig?.enabled) continue
    if (!entityConfig.access?.api) continue

    const override = overrides[slug]
    if (override?.exclude) continue

    const operations = defaultOperations.filter(
      (op) => !override?.excludeOperations?.includes(op)
    )
    if (!operations.length) continue

    tools.push(
      ...generateEntityTools(entityConfig, operations, override, {
        executor: normalizingExecutor,
        toolPrefix: options.toolPrefix,
        translateOption: options.translateOption,
        presets: options.presets?.[slug],
      })
    )
  }

  for (const [slug, override] of Object.entries(overrides)) {
    if (!override.extraTools) continue
    if (excluded.has(slug)) continue
    tools.push(...override.extraTools(api))
  }

  if (options.utilityTools) {
    tools.push(...options.utilityTools(api))
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
            result = {
              content: [
                {
                  type: 'text',
                  text: `Error inesperado: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            }
          }
          await audit({
            apiKeyId: ctx.apiKeyId,
            userId: ctx.userId,
            tool: tool.name,
            entitySlug: tool.meta?.entitySlug,
            operation: tool.meta?.operation,
            recordId: typeof args?.id === 'string' ? args.id : undefined,
            teamId: ctx.teamId,
            statusCode: result.isError ? 400 : 200,
            requestSummary: (args ?? {}) as Record<string, unknown>,
            responseTimeMs: Date.now() - startedAt,
          })
          return result
        }) as never
      )
    }

    const transport = new StatelessJsonRpcTransport()
    await server.connect(transport)
    try {
      if (Array.isArray(body)) {
        const responses: JSONRPCMessage[] = []
        for (const message of body) {
          const response = await transport.handleMessage(message as JSONRPCMessage)
          if (response) responses.push(response)
        }
        return responses.length ? responses : null
      }
      return await transport.handleMessage(body as JSONRPCMessage)
    } finally {
      await transport.close()
    }
  }

  return { tools, handleJsonRpc, api }
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

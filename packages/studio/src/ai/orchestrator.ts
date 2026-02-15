/**
 * Studio Orchestrator
 *
 * Main conversation loop that manages Claude API calls, tool execution,
 * and result collection. This is the core engine of NextSpark Studio.
 *
 * Flow:
 * 1. Send user prompt to Claude with system prompt + tools
 * 2. Claude calls tools (analyze_requirement, configure_project, define_entity)
 * 3. We execute tools and send results back
 * 4. Repeat until Claude responds with text (no more tool calls)
 * 5. Return collected StudioResult
 */

import type Anthropic from '@anthropic-ai/sdk'
import { getClient, STUDIO_MODEL, MAX_TOKENS } from './client'
import { SYSTEM_PROMPT } from './system-prompt'
import { STUDIO_TOOLS } from './tools/index'
import type { StudioToolName } from './tools/index'
import { executeTool } from './tool-executor'
import type { StudioResult, StudioEvent, StudioEventHandler } from '../types'

type Message = Anthropic.MessageParam
type ContentBlock = Anthropic.ContentBlock
type ToolUseBlock = Anthropic.ToolUseBlock
type Tool = Anthropic.Tool

/**
 * Convert our Zod-based tool definitions to Anthropic API format
 */
function buildAnthropicTools(): Tool[] {
  return STUDIO_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: zodToJsonSchema(tool.schema),
  }))
}

/**
 * Simple Zod-to-JSON-Schema converter for our tool schemas.
 * Handles the subset of Zod types we use in tools.
 */
function zodToJsonSchema(schema: unknown): Anthropic.Tool.InputSchema {
  // Use Zod's built-in JSON schema generation if available,
  // otherwise fall back to manual conversion
  const zodSchema = schema as { _def?: { shape?: () => Record<string, unknown> }; shape?: Record<string, unknown> }

  // For our use case, we use zod-to-json-schema at build time
  // At runtime, we serialize the Zod schema to JSON Schema
  try {
    // Zod v3.24+ has built-in JSON Schema support
    if (typeof (schema as { toJsonSchema?: () => unknown }).toJsonSchema === 'function') {
      return (schema as { toJsonSchema: () => Anthropic.Tool.InputSchema }).toJsonSchema()
    }
  } catch {
    // Fall through to manual conversion
  }

  // Manual extraction from Zod shape
  return extractJsonSchema(schema)
}

/**
 * Extract JSON Schema from a Zod object schema by inspecting its internal structure.
 */
function extractJsonSchema(zodObj: unknown): Anthropic.Tool.InputSchema {
  const z = zodObj as {
    _def: {
      typeName: string
      shape?: () => Record<string, unknown>
    }
    shape?: Record<string, unknown>
  }

  // Get shape from Zod object
  const shape = typeof z._def?.shape === 'function' ? z._def.shape() : (z.shape || {})
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const field = fieldSchema as {
      _def: {
        typeName: string
        innerType?: unknown
        defaultValue?: () => unknown
        checks?: Array<{ kind: string; value?: unknown; regex?: RegExp }>
        values?: string[]
        type?: unknown
        description?: string
        options?: unknown[]
        minLength?: { value: number }
      }
      description?: string
    }

    const prop = zodFieldToJsonSchema(field)
    properties[key] = prop

    // Check if required (not optional, not default)
    const typeName = field._def?.typeName
    if (typeName !== 'ZodOptional' && typeName !== 'ZodDefault') {
      required.push(key)
    }
  }

  return {
    type: 'object' as const,
    properties,
    required: required.length > 0 ? required : undefined,
  }
}

function zodFieldToJsonSchema(field: unknown): Record<string, unknown> {
  const f = field as {
    _def: {
      typeName: string
      innerType?: unknown
      defaultValue?: () => unknown
      checks?: Array<{ kind: string; value?: unknown; regex?: RegExp }>
      values?: string[]
      type?: unknown
      description?: string
      options?: unknown[]
      minLength?: { value: number }
    }
    description?: string
  }

  const typeName = f._def?.typeName
  const description = f.description || f._def?.description

  // Unwrap Default and Optional
  if (typeName === 'ZodDefault' || typeName === 'ZodOptional') {
    const inner = zodFieldToJsonSchema(f._def.innerType)
    if (description) inner.description = description
    if (typeName === 'ZodDefault' && f._def.defaultValue) {
      try { inner.default = f._def.defaultValue() } catch { /* skip */ }
    }
    return inner
  }

  // Basic types
  if (typeName === 'ZodString') {
    const result: Record<string, unknown> = { type: 'string' }
    if (description) result.description = description
    // Check for regex pattern
    const regexCheck = f._def?.checks?.find((c: { kind: string }) => c.kind === 'regex')
    if (regexCheck && 'regex' in regexCheck) {
      result.pattern = (regexCheck as { regex: RegExp }).regex.source
    }
    return result
  }

  if (typeName === 'ZodNumber') {
    const result: Record<string, unknown> = { type: 'number' }
    if (description) result.description = description
    const minCheck = f._def?.checks?.find((c: { kind: string }) => c.kind === 'min')
    const maxCheck = f._def?.checks?.find((c: { kind: string }) => c.kind === 'max')
    if (minCheck && 'value' in minCheck) result.minimum = minCheck.value
    if (maxCheck && 'value' in maxCheck) result.maximum = maxCheck.value
    return result
  }

  if (typeName === 'ZodBoolean') {
    const result: Record<string, unknown> = { type: 'boolean' }
    if (description) result.description = description
    return result
  }

  if (typeName === 'ZodEnum') {
    const result: Record<string, unknown> = {
      type: 'string',
      enum: f._def.values,
    }
    if (description) result.description = description
    return result
  }

  if (typeName === 'ZodArray') {
    const items = zodFieldToJsonSchema(f._def.type)
    const result: Record<string, unknown> = { type: 'array', items }
    if (description) result.description = description
    if (f._def.minLength) result.minItems = f._def.minLength.value
    return result
  }

  if (typeName === 'ZodObject') {
    const inner = extractJsonSchema(f)
    if (description) inner.description = description
    return inner
  }

  // Fallback
  const result: Record<string, unknown> = { type: 'string' }
  if (description) result.description = description
  return result
}

/**
 * Run a complete Studio conversation.
 *
 * Takes a user prompt, calls Claude with tools, executes tool calls,
 * and returns the collected configuration.
 */
export async function runStudio(
  userPrompt: string,
  onEvent?: StudioEventHandler
): Promise<StudioResult> {
  const client = getClient()
  const tools = buildAnthropicTools()
  const result: StudioResult = {}

  const emit = (event: StudioEvent) => {
    if (onEvent) onEvent(event)
  }

  const messages: Message[] = [
    { role: 'user', content: userPrompt }
  ]

  let iterations = 0
  const MAX_ITERATIONS = 15 // Safety limit

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await client.messages.create({
      model: STUDIO_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })

    // Process response content blocks
    const textBlocks: string[] = []
    const toolUseBlocks: ToolUseBlock[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text)
        emit({ type: 'text', content: block.text })
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block)
      }
    }

    // If no tool calls, conversation is complete
    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      break
    }

    // Execute all tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolBlock of toolUseBlocks) {
      const toolName = toolBlock.name as StudioToolName

      emit({ type: 'tool_start', toolName, content: `Executing ${toolName}...` })

      try {
        const execResult = executeTool(toolName, toolBlock.input, result)

        emit({
          type: 'tool_result',
          toolName,
          content: execResult.message,
          data: execResult.data,
        })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: execResult.message,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        emit({ type: 'error', toolName, content: errorMsg })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: `Error: ${errorMsg}`,
          is_error: true,
        })
      }
    }

    // Add assistant response and tool results to conversation
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  if (iterations >= MAX_ITERATIONS) {
    emit({ type: 'error', content: 'Max iterations reached. The conversation was too long.' })
  }

  return result
}

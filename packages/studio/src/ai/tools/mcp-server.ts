/**
 * Studio MCP Server
 *
 * Creates an in-process MCP server for the Agent SDK using our existing
 * Zod schemas and tool executor. The Agent SDK manages the conversation
 * loop and tool dispatch automatically.
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { ANALYZE_REQUIREMENT_TOOL, analyzeRequirementSchema } from './analyze-requirement'
import { CONFIGURE_PROJECT_TOOL, configureProjectSchema } from './configure-project'
import { DEFINE_ENTITY_TOOL, defineEntitySchema } from './define-entity'
import { DEFINE_PAGE_TOOL, definePageSchema } from './define-page'
import { executeTool } from '../tool-executor'
import type { StudioResult, StudioEventHandler } from '../../types'

/**
 * Create the Studio MCP server with all 4 tools.
 * Tool handlers call executeTool() to mutate the shared result object.
 */
export function createStudioMcpServer(result: StudioResult, onEvent?: StudioEventHandler) {
  return createSdkMcpServer({
    name: 'studio',
    version: '1.0.0',
    tools: [
      tool(
        'analyze_requirement',
        ANALYZE_REQUIREMENT_TOOL.description,
        analyzeRequirementSchema.shape,
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'analyze_requirement', content: 'Analyzing requirement...' })
          const execResult = executeTool('analyze_requirement', args, result)
          onEvent?.({ type: 'tool_result', toolName: 'analyze_requirement', content: execResult.message, data: execResult.data })
          return { content: [{ type: 'text' as const, text: execResult.message }] }
        }
      ),
      tool(
        'configure_project',
        CONFIGURE_PROJECT_TOOL.description,
        configureProjectSchema.shape,
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'configure_project', content: 'Configuring project...' })
          const execResult = executeTool('configure_project', args, result)
          onEvent?.({ type: 'tool_result', toolName: 'configure_project', content: execResult.message, data: execResult.data })
          return { content: [{ type: 'text' as const, text: execResult.message }] }
        }
      ),
      tool(
        'define_entity',
        DEFINE_ENTITY_TOOL.description,
        defineEntitySchema.shape,
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'define_entity', content: 'Defining entity...' })
          const execResult = executeTool('define_entity', args, result)
          onEvent?.({ type: 'tool_result', toolName: 'define_entity', content: execResult.message, data: execResult.data })
          return { content: [{ type: 'text' as const, text: execResult.message }] }
        }
      ),
      tool(
        'define_page',
        DEFINE_PAGE_TOOL.description,
        definePageSchema.shape,
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'define_page', content: 'Defining page...' })
          const execResult = executeTool('define_page', args, result)
          onEvent?.({ type: 'tool_result', toolName: 'define_page', content: execResult.message, data: execResult.data })
          return { content: [{ type: 'text' as const, text: execResult.message }] }
        }
      ),
    ],
  })
}

/**
 * MCP tool names as they appear to the Agent SDK (mcp__<server>__<tool>).
 * Used for allowedTools to restrict Claude to only our tools.
 */
export const STUDIO_MCP_TOOL_NAMES = [
  'mcp__studio__analyze_requirement',
  'mcp__studio__configure_project',
  'mcp__studio__define_entity',
  'mcp__studio__define_page',
] as const

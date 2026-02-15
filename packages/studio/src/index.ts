/**
 * @nextsparkjs/studio
 *
 * AI-powered SaaS app builder for NextSpark.
 * Translates natural language descriptions into complete project configurations.
 */

export { runStudio } from './ai/orchestrator'
export { createStudioMcpServer, STUDIO_MCP_TOOL_NAMES } from './ai/tools/mcp-server'
export { SYSTEM_PROMPT } from './ai/system-prompt'

export type {
  StudioResult,
  StudioEvent,
  StudioEventHandler,
  WizardConfig,
  EntityDefinition,
  EntityFieldDefinition,
  StudioAnalysis,
  PageDefinition,
  BlockInstance,
} from './types'

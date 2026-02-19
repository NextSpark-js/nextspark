/**
 * @nextsparkjs/studio
 *
 * AI-powered SaaS app builder for NextSpark.
 * Translates natural language descriptions into complete project configurations.
 */

export { runStudio } from './ai/orchestrator'
export { runChat } from './ai/chat-orchestrator'
export type { ChatMessage, ChatOptions } from './ai/chat-orchestrator'
export { createStudioMcpServer, STUDIO_MCP_TOOL_NAMES } from './ai/tools/mcp-server'
export { createChatMcpServer, CHAT_MCP_TOOL_NAMES } from './ai/tools/chat-tools'
export { SYSTEM_PROMPT } from './ai/system-prompt'
export { buildChatSystemPrompt } from './ai/chat-system-prompt'
export { generatePageTemplate, generateAllPageTemplates, getTemplateFilePath } from './lib/page-template-generator'

export type {
  StudioResult,
  StudioEvent,
  StudioEventHandler,
  WizardConfig,
  EntityDefinition,
  EntityFieldDefinition,
  EntityFieldType,
  EntityAccessMode,
  StudioAnalysis,
  PageDefinition,
  BlockInstance,
} from './types'

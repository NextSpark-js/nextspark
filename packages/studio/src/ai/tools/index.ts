/**
 * Studio Tool Definitions
 *
 * Exports Zod schemas and tool descriptions for external consumers.
 * The STUDIO_TOOLS array is replaced by the MCP server in mcp-server.ts.
 */

export { ANALYZE_REQUIREMENT_TOOL, analyzeRequirementSchema } from './analyze-requirement'
export type { AnalyzeRequirementInput } from './analyze-requirement'

export { CONFIGURE_PROJECT_TOOL, configureProjectSchema } from './configure-project'
export type { ConfigureProjectInput } from './configure-project'

export { DEFINE_ENTITY_TOOL, defineEntitySchema } from './define-entity'
export type { DefineEntityInput } from './define-entity'

export { DEFINE_PAGE_TOOL, definePageSchema } from './define-page'
export type { DefinePageInput } from './define-page'

export { createStudioMcpServer, STUDIO_MCP_TOOL_NAMES } from './mcp-server'

/**
 * Tool names used by the tool executor (short names without MCP prefix).
 */
export type StudioToolName =
  | 'analyze_requirement'
  | 'configure_project'
  | 'define_entity'
  | 'define_page'

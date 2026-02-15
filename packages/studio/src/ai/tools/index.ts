/**
 * Studio Tool Definitions
 *
 * All tools available to Claude for configuring NextSpark projects.
 * Tools use Zod schemas for type-safe validation.
 */

export { ANALYZE_REQUIREMENT_TOOL, analyzeRequirementSchema } from './analyze-requirement'
export type { AnalyzeRequirementInput } from './analyze-requirement'

export { CONFIGURE_PROJECT_TOOL, configureProjectSchema } from './configure-project'
export type { ConfigureProjectInput } from './configure-project'

export { DEFINE_ENTITY_TOOL, defineEntitySchema } from './define-entity'
export type { DefineEntityInput } from './define-entity'

export { DEFINE_PAGE_TOOL, definePageSchema } from './define-page'
export type { DefinePageInput } from './define-page'

import { ANALYZE_REQUIREMENT_TOOL } from './analyze-requirement'
import { CONFIGURE_PROJECT_TOOL } from './configure-project'
import { DEFINE_ENTITY_TOOL } from './define-entity'
import { DEFINE_PAGE_TOOL } from './define-page'

/**
 * All studio tools in execution order
 */
export const STUDIO_TOOLS = [
  ANALYZE_REQUIREMENT_TOOL,
  CONFIGURE_PROJECT_TOOL,
  DEFINE_ENTITY_TOOL,
  DEFINE_PAGE_TOOL,
] as const

export type StudioToolName = typeof STUDIO_TOOLS[number]['name']

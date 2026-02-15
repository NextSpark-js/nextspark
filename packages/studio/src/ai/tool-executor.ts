/**
 * Tool Executor
 *
 * Executes tool calls from Claude and collects results.
 * Tools don't have side effects in Phase 1 - they validate and store configs.
 *
 * IMPORTANT: All inputs are parsed through Zod schemas to apply defaults.
 * Claude may omit optional fields, so we need .parse() to fill in defaults
 * like projectType='web', teamRoles=['owner',...], currency='usd', etc.
 */

import type { StudioResult, StudioAnalysis, EntityDefinition } from '../types'
import { analyzeRequirementSchema, type AnalyzeRequirementInput } from './tools/analyze-requirement'
import { configureProjectSchema, type ConfigureProjectInput } from './tools/configure-project'
import { defineEntitySchema, type DefineEntityInput } from './tools/define-entity'
import type { StudioToolName } from './tools/index'

export interface ToolExecutionResult {
  success: boolean
  data: unknown
  message: string
}

/**
 * Execute a tool call and update the collected studio result.
 * Parses input through Zod to validate and apply defaults.
 */
export function executeTool(
  toolName: StudioToolName,
  input: unknown,
  result: StudioResult
): ToolExecutionResult {
  switch (toolName) {
    case 'analyze_requirement':
      return executeAnalyzeRequirement(analyzeRequirementSchema.parse(input), result)
    case 'configure_project':
      return executeConfigureProject(configureProjectSchema.parse(input), result)
    case 'define_entity':
      return executeDefineEntity(defineEntitySchema.parse(input), result)
    default:
      return {
        success: false,
        data: null,
        message: `Unknown tool: ${toolName}`,
      }
  }
}

function executeAnalyzeRequirement(
  input: AnalyzeRequirementInput,
  result: StudioResult
): ToolExecutionResult {
  const analysis: StudioAnalysis = {
    preset: input.preset,
    confidence: input.confidence,
    reasoning: input.reasoning,
    detectedFeatures: input.detectedFeatures,
    detectedEntities: input.detectedEntities,
    suggestedTeamMode: input.suggestedTeamMode,
    suggestedBilling: input.suggestedBilling,
  }

  result.analysis = analysis

  return {
    success: true,
    data: analysis,
    message: `Analysis complete. Preset: ${input.preset} (confidence: ${(input.confidence * 100).toFixed(0)}%). Detected ${input.detectedEntities.length} entities: ${input.detectedEntities.map(e => e.name).join(', ')}.`,
  }
}

function executeConfigureProject(
  input: ConfigureProjectInput,
  result: StudioResult
): ToolExecutionResult {
  // Map the input to WizardConfig format
  result.wizardConfig = {
    projectName: input.projectName,
    projectSlug: input.projectSlug,
    projectDescription: input.projectDescription,
    projectType: input.projectType,
    teamMode: input.teamMode,
    teamRoles: input.teamRoles,
    defaultLocale: input.defaultLocale,
    supportedLocales: input.supportedLocales,
    billingModel: input.billingModel,
    currency: input.currency,
    features: input.features,
    contentFeatures: input.contentFeatures,
    auth: input.auth,
    dashboard: input.dashboard,
    dev: input.dev,
  }
  result.theme = input.theme
  result.plugins = input.plugins

  return {
    success: true,
    data: result.wizardConfig,
    message: `Project configured: "${input.projectName}" (${input.projectSlug}) using ${input.teamMode} mode with ${input.billingModel} billing. Theme: ${input.theme}. Plugins: ${input.plugins.length > 0 ? input.plugins.join(', ') : 'none'}.`,
  }
}

function executeDefineEntity(
  input: DefineEntityInput,
  result: StudioResult
): ToolExecutionResult {
  const entity: EntityDefinition = {
    slug: input.slug,
    names: input.names,
    description: input.description,
    accessMode: input.accessMode,
    fields: input.fields.map(f => ({
      name: f.name,
      type: f.type,
      required: f.required,
      description: f.description,
      options: f.options,
      relation: f.relation,
    })),
    features: input.features,
  }

  if (!result.entities) {
    result.entities = []
  }
  result.entities.push(entity)

  return {
    success: true,
    data: entity,
    message: `Entity "${input.names.plural}" (${input.slug}) defined with ${input.fields.length} fields: ${input.fields.map(f => f.name).join(', ')}.`,
  }
}

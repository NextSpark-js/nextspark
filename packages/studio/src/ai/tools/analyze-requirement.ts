/**
 * Tool: analyze_requirement
 *
 * Classifies a user's natural language project description into a NextSpark preset
 * and identifies key features, entities, team mode, and billing model.
 *
 * This is always called FIRST in the conversation flow.
 */

import { z } from 'zod'

export const analyzeRequirementSchema = z.object({
  description: z.string().describe(
    'The user\'s original project description, summarized in English for internal processing'
  ),
  preset: z.enum(['saas', 'blog', 'crm']).describe(
    'Best matching NextSpark preset. "saas" for multi-tenant apps with subscriptions. "blog" for content sites. "crm" for internal tools and single-tenant apps.'
  ),
  confidence: z.number().min(0).max(1).describe(
    'Confidence in preset selection (0.0-1.0). Below 0.7 means the user should confirm.'
  ),
  reasoning: z.string().describe(
    'Brief explanation of why this preset was chosen, in the user\'s language'
  ),
  detectedFeatures: z.array(z.string()).describe(
    'List of features detected from the description (e.g., "authentication", "payments", "team management", "blog", "analytics")'
  ),
  detectedEntities: z.array(z.object({
    name: z.string().describe('Entity name in English lowercase plural (e.g., "customers", "memberships")'),
    description: z.string().describe('What this entity represents'),
    estimatedFields: z.number().describe('Estimated number of fields (3-15)')
  })).describe(
    'Business entities detected from the description. Each will become a database table with CRUD API.'
  ),
  suggestedTeamMode: z.enum(['multi-tenant', 'single-tenant', 'single-user']).describe(
    '"multi-tenant" for SaaS where each customer has their own team/workspace. "single-tenant" for a single organization. "single-user" for personal apps.'
  ),
  suggestedBilling: z.enum(['free', 'freemium', 'paid']).describe(
    '"free" for no billing. "freemium" for free tier + paid plans. "paid" for subscription-only.'
  ),
})

export type AnalyzeRequirementInput = z.infer<typeof analyzeRequirementSchema>

export const ANALYZE_REQUIREMENT_TOOL = {
  name: 'analyze_requirement' as const,
  description: 'Analyze a user\'s project description and determine the best NextSpark preset, project type, and key features needed. This identifies the closest matching template (saas, blog, or crm), detects business entities that will need database tables and CRUD APIs, and suggests team mode and billing model. Call this FIRST when a user describes what they want to build. Always respond in the user\'s language for reasoning.',
  schema: analyzeRequirementSchema,
}

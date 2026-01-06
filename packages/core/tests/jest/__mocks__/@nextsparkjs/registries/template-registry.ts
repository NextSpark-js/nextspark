/**
 * Mock Template Registry for Jest tests
 */

export const TEMPLATE_REGISTRY: Record<string, any> = {}

export interface TemplateOverride {
  name: string
  path: string
  source: string
}

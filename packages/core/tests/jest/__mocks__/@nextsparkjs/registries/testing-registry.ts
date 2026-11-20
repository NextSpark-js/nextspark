/**
 * Mock Testing Registry for Jest tests (tests that need entries mock the module with their own).
 */

export const TAGS_REGISTRY: Record<string, Record<string, unknown>> = {}
export const FEATURE_REGISTRY: Record<string, unknown> = {}
export const FLOW_REGISTRY: Record<string, unknown> = {}
export const COVERAGE_SUMMARY = {
  theme: 'test',
  generatedAt: '',
  tags: { testFiles: 0 },
  features: { total: 0, withTests: 0, withoutTests: 0 },
  flows: { total: 0, withTests: 0, withoutTests: 0 },
}

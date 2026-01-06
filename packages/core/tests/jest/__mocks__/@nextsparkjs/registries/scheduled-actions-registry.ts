/**
 * Mock Scheduled Actions Registry for Jest tests
 */

export const SCHEDULED_ACTIONS_REGISTRY: Record<string, any> = {}

export const SCHEDULED_ACTIONS_METADATA = {
  generated: new Date().toISOString(),
  totalActions: 0,
}

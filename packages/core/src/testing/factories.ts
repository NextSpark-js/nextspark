import { mockUser, mockBillingPlan } from './mocks'

let userCounter = 0
let teamCounter = 0

export function createTestUser(overrides: Record<string, unknown> = {}) {
  userCounter++
  return mockUser({
    id: `test-user-${userCounter}`,
    email: `test-user-${userCounter}@example.com`,
    ...overrides,
  })
}

export function createTestTeam(overrides: Record<string, unknown> = {}) {
  teamCounter++
  return {
    id: `test-team-${teamCounter}`,
    name: `Test Team ${teamCounter}`,
    slug: `test-team-${teamCounter}`,
    createdAt: new Date(),
    ...overrides,
  }
}

export function createTestSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: `sub-${Date.now()}`,
    ...mockBillingPlan(),
    ...overrides,
  }
}

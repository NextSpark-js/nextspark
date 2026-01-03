export interface MockUser {
  id: string
  email: string
  name: string
  image: string | null
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export function mockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: `user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    image: null,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function mockAuthSession(overrides: Record<string, unknown> = {}) {
  const user = mockUser(overrides.user as Partial<MockUser>)
  return {
    user,
    session: {
      id: `session-${Date.now()}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...(overrides.session as Record<string, unknown>),
    },
    isAuthenticated: true,
  }
}

export function mockTeamContext(overrides: Record<string, unknown> = {}) {
  return {
    teamId: `team-${Date.now()}`,
    teamName: 'Test Team',
    role: 'owner' as const,
    permissions: ['*'],
    ...overrides,
  }
}

export function mockBillingPlan(overrides: Record<string, unknown> = {}) {
  return {
    planId: 'pro',
    planName: 'Pro',
    status: 'active' as const,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  }
}

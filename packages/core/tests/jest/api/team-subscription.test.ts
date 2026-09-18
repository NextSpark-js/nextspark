import { jest } from '@jest/globals'
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  validateAndAuthenticateRequest: jest.fn(),
  createApiResponse: jest.fn((data) => ({ status: 200, json: async () => ({ success: true, data }) })),
  createApiError: jest.fn((error, status) => ({ status, json: async () => ({ success: false, error }) })),
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
}))

jest.mock('@nextsparkjs/core/lib/services', () => ({
  SubscriptionService: { getActive: jest.fn() },
  MembershipService: { get: jest.fn() },
}))

import { validateAndAuthenticateRequest } from '@nextsparkjs/core/lib/api/helpers'
import { MembershipService, SubscriptionService } from '@nextsparkjs/core/lib/services'
import { GET } from '@/app/api/v1/teams/[teamId]/subscription/route'

const mockValidateAndAuthenticateRequest = jest.mocked(validateAndAuthenticateRequest)
const mockGetMembership = jest.mocked(MembershipService.get)
const mockGetActiveSubscription = jest.mocked(SubscriptionService.getActive)

describe('GET /api/v1/teams/:teamId/subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateAndAuthenticateRequest.mockResolvedValue({
      auth: { userId: 'user-1' },
      rateLimitResponse: null,
      errorResponse: null,
    } as never)
    mockGetMembership.mockResolvedValue({
      canPerformAction: () => ({ allowed: true }),
    } as never)
  })

  it('returns an explicit null subscription for a team without one', async () => {
    mockGetActiveSubscription.mockResolvedValue(null)

    const response = await GET(
      new NextRequest('http://localhost/api/v1/teams/team-1/subscription'),
      { params: Promise.resolve({ teamId: 'team-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { subscription: null },
    })
  })
})

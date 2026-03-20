/**
 * Billing Portal API Route Tests
 *
 * POST /api/v1/billing/portal
 * Creates a billing portal session for self-service billing management.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuthenticateRequest = jest.fn()
const mockCreateAuthError = jest.fn(
  (msg: string, status: number) => NextResponse.json({ success: false, error: msg }, { status })
)
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: any[]) => mockAuthenticateRequest(...args),
  createAuthError: (...args: any[]) => mockCreateAuthError(...args),
}))

const mockMembershipGet = jest.fn()
const mockSubscriptionGetActive = jest.fn()
jest.mock('@nextsparkjs/core/lib/services', () => ({
  MembershipService: { get: (...args: any[]) => mockMembershipGet(...args) },
  SubscriptionService: { getActive: (...args: any[]) => mockSubscriptionGetActive(...args) },
}))

const mockBillingGateway = {
  createPortalSession: jest.fn(),
}
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({
  getBillingGateway: () => mockBillingGateway,
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: any) => handler,
}))

import { POST } from '../../../../../../apps/dev/app/api/v1/billing/portal/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/v1/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  }) as any
}

const fakeUser = { id: 'user-1', email: 'admin@test.com', defaultTeamId: 'team-1' }

function authSuccess() {
  mockAuthenticateRequest.mockResolvedValue({ success: true, user: fakeUser })
}

function membershipAllowed() {
  mockMembershipGet.mockResolvedValue({
    canPerformAction: () => ({ allowed: true }),
  })
}

function membershipDenied(msg = 'Not allowed', reason = 'role') {
  mockMembershipGet.mockResolvedValue({
    canPerformAction: () => ({ allowed: false, message: msg, reason, meta: {} }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/portal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:5173'
  })

  // --- Auth ---
  test('returns 401 if not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false })
    const res = await POST(createRequest())
    expect(res.status).toBe(401)
  })

  // --- Team context ---
  test('returns 400 if no team context', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { ...fakeUser, defaultTeamId: null },
    })
    const res = await POST(createRequest())
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/team/i)
  })

  // --- Permission ---
  test('returns 403 if permission denied', async () => {
    authSuccess()
    membershipDenied()
    const res = await POST(createRequest())
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.reason).toBe('role')
  })

  // --- No subscription ---
  test('returns 400 if no billing account (no subscription)', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue(null)

    const res = await POST(createRequest())
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/no billing account/i)
  })

  test('returns 400 if subscription has no external customer ID', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      id: 'sub-1',
      externalCustomerId: null,
    })

    const res = await POST(createRequest())
    expect(res.status).toBe(400)
  })

  // --- Happy path ---
  test('returns portal URL', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      id: 'sub-1',
      externalCustomerId: 'cus_stripe_abc',
    })
    mockBillingGateway.createPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/abc',
    })

    const res = await POST(createRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.url).toBe('https://billing.stripe.com/session/abc')
  })

  test('passes correct customerId and returnUrl to gateway', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      id: 'sub-1',
      externalCustomerId: 'cus_abc',
    })
    mockBillingGateway.createPortalSession.mockResolvedValue({ url: 'https://portal.url' })

    await POST(createRequest())

    expect(mockBillingGateway.createPortalSession).toHaveBeenCalledWith({
      customerId: 'cus_abc',
      returnUrl: 'http://localhost:5173/dashboard/settings/billing',
    })
  })

  // --- Uses x-team-id header ---
  test('uses x-team-id header for team context', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      id: 'sub-1',
      externalCustomerId: 'cus_abc',
    })
    mockBillingGateway.createPortalSession.mockResolvedValue({ url: 'https://portal.url' })

    await POST(createRequest({ 'x-team-id': 'team-override' }))

    expect(mockMembershipGet).toHaveBeenCalledWith('user-1', 'team-override')
    expect(mockSubscriptionGetActive).toHaveBeenCalledWith('team-override')
  })

  // --- Gateway error ---
  test('returns 500 on gateway portal session error', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      id: 'sub-1',
      externalCustomerId: 'cus_abc',
    })
    mockBillingGateway.createPortalSession.mockRejectedValue(new Error('Stripe down'))

    const res = await POST(createRequest())
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toMatch(/stripe down/i)
  })
})

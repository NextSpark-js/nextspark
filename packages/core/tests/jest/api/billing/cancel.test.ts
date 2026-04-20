/**
 * Billing Cancel API Route Tests
 *
 * POST /api/v1/billing/cancel
 * Cancel or reactivate team subscription.
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
  cancelSubscriptionAtPeriodEnd: jest.fn(),
  cancelSubscriptionImmediately: jest.fn(),
  reactivateSubscription: jest.fn(),
}
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({
  getBillingGateway: () => mockBillingGateway,
}))

const mockQueryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryWithRLS: (...args: any[]) => mockQueryWithRLS(...args),
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: any) => handler,
}))

import { POST } from '../../../../../../apps/dev/app/api/v1/billing/cancel/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body?: any, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/v1/billing/cancel', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

const activeSubscription = {
  id: 'sub-1',
  externalSubscriptionId: 'sub_stripe_abc',
  externalCustomerId: 'cus_stripe_xyz',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date('2025-12-31T23:59:59Z'),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // --- Auth ---
  test('returns 401 if not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false })
    const res = await POST(createRequest({}))
    expect(res.status).toBe(401)
  })

  // --- Team context ---
  test('returns 400 if no team context', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { ...fakeUser, defaultTeamId: null },
    })
    const res = await POST(createRequest({}))
    expect(res.status).toBe(400)
  })

  // --- Permission ---
  test('returns 403 if permission denied', async () => {
    authSuccess()
    membershipDenied()
    const res = await POST(createRequest({}))
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.reason).toBe('role')
  })

  // --- Invalid JSON ---
  test('returns 400 for invalid JSON body', async () => {
    authSuccess()
    membershipAllowed()
    const req = new NextRequest('http://localhost:3000/api/v1/billing/cancel', {
      method: 'POST',
      body: 'not-json{{',
      headers: { 'Content-Type': 'application/json' },
    }) as any
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  // --- No active subscription ---
  test('returns 404 if no active subscription', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue(null)

    const res = await POST(createRequest({ immediate: false }))
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toMatch(/no active subscription/i)
  })

  test('returns 404 if subscription has no external ID', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({ id: 'sub-1', externalSubscriptionId: null })

    const res = await POST(createRequest({ immediate: false }))
    expect(res.status).toBe(404)
  })

  // --- Soft cancel (cancelAtPeriodEnd) ---
  test('soft cancels subscription (cancel at period end)', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue(activeSubscription)
    mockBillingGateway.cancelSubscriptionAtPeriodEnd.mockResolvedValue(undefined)
    mockQueryWithRLS.mockResolvedValue(undefined)

    const res = await POST(createRequest({ immediate: false, reason: 'Too expensive' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.cancelAtPeriodEnd).toBe(true)
    expect(json.data.canceledAt).toBeNull()
    expect(json.data.periodEnd).toBe('2025-12-31T23:59:59.000Z')

    expect(mockBillingGateway.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('sub_stripe_abc')
    expect(mockBillingGateway.cancelSubscriptionImmediately).not.toHaveBeenCalled()
  })

  // --- Hard cancel (immediate) ---
  test('hard cancels subscription immediately', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue(activeSubscription)
    mockBillingGateway.cancelSubscriptionImmediately.mockResolvedValue(undefined)
    mockQueryWithRLS.mockResolvedValue(undefined)

    const res = await POST(createRequest({ immediate: true }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.cancelAtPeriodEnd).toBe(false)
    expect(json.data.canceledAt).toBeDefined()
    expect(json.data.message).toMatch(/immediately/i)

    expect(mockBillingGateway.cancelSubscriptionImmediately).toHaveBeenCalledWith('sub_stripe_abc')
  })

  // --- Reactivation ---
  test('reactivates subscription scheduled for cancellation', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      ...activeSubscription,
      cancelAtPeriodEnd: true,
    })
    mockBillingGateway.reactivateSubscription.mockResolvedValue(undefined)
    mockQueryWithRLS.mockResolvedValue(undefined)

    const res = await POST(createRequest({ action: 'reactivate' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.reactivated).toBe(true)
  })

  test('returns 404 on reactivation if no active subscription', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue(null)

    const res = await POST(createRequest({ action: 'reactivate' }))
    expect(res.status).toBe(404)
  })

  test('returns 400 on reactivation if not scheduled for cancellation', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      ...activeSubscription,
      cancelAtPeriodEnd: false,
    })

    const res = await POST(createRequest({ action: 'reactivate' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/not scheduled for cancellation/i)
  })

  // --- Gateway error ---
  test('returns 500 on gateway cancel error', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue(activeSubscription)
    mockBillingGateway.cancelSubscriptionAtPeriodEnd.mockRejectedValue(new Error('Gateway timeout'))

    const res = await POST(createRequest({ immediate: false }))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toMatch(/gateway timeout/i)
  })

  test('returns 500 on gateway reactivation error', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue({
      ...activeSubscription,
      cancelAtPeriodEnd: true,
    })
    mockBillingGateway.reactivateSubscription.mockRejectedValue(new Error('Stripe error'))

    const res = await POST(createRequest({ action: 'reactivate' }))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toMatch(/stripe error/i)
  })

  // --- Default behavior (no immediate flag) ---
  test('defaults to soft cancel when immediate is not specified', async () => {
    authSuccess()
    membershipAllowed()
    mockSubscriptionGetActive.mockResolvedValue(activeSubscription)
    mockBillingGateway.cancelSubscriptionAtPeriodEnd.mockResolvedValue(undefined)
    mockQueryWithRLS.mockResolvedValue(undefined)

    const res = await POST(createRequest({}))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.cancelAtPeriodEnd).toBe(true)
  })
})

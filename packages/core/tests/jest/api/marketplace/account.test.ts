/**
 * Marketplace Account API Route Tests
 *
 * GET /api/v1/marketplace/account
 * Retrieves the connected account status for the current team.
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
jest.mock('@nextsparkjs/core/lib/services', () => ({
  MembershipService: { get: (...args: any[]) => mockMembershipGet(...args) },
}))

const mockQueryOne = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryOne: (...args: any[]) => mockQueryOne(...args),
}))

const mockGateway = {
  createDashboardLink: jest.fn(),
  getAccountBalance: jest.fn(),
}
jest.mock('@nextsparkjs/core/lib/marketplace', () => ({
  getMarketplaceGateway: () => mockGateway,
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: any) => handler,
}))

import { GET } from '../../../../../../apps/dev/app/api/v1/marketplace/account/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/v1/marketplace/account', {
    method: 'GET',
    headers: { ...headers },
  }) as any
}

const fakeUser = { id: 'user-1', email: 'test@test.com', defaultTeamId: 'team-1' }

function authSuccess() {
  mockAuthenticateRequest.mockResolvedValue({ success: true, user: fakeUser })
}

function membershipAllowed() {
  mockMembershipGet.mockResolvedValue({
    canPerformAction: () => ({ allowed: true }),
  })
}

function membershipDenied(msg = 'Not allowed') {
  mockMembershipGet.mockResolvedValue({
    canPerformAction: () => ({ allowed: false, message: msg }),
  })
}

const fullAccount = {
  id: 'acct-1',
  provider: 'stripe_connect',
  externalAccountId: 'acct_stripe_789',
  email: 'biz@test.com',
  businessName: 'My Business',
  country: 'US',
  currency: 'usd',
  onboardingStatus: 'active',
  chargesEnabled: true,
  payoutsEnabled: true,
  commissionRate: 0.15,
  fixedFee: 0,
  payoutSchedule: 'daily',
  createdAt: '2025-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/marketplace/account', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // --- Auth ---
  test('returns 401 if not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false })
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  // --- Team context ---
  test('returns 400 if no team context', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { ...fakeUser, defaultTeamId: null },
    })
    const res = await GET(createRequest())
    expect(res.status).toBe(400)
  })

  // --- Permission ---
  test('returns 403 if permission denied', async () => {
    authSuccess()
    membershipDenied()
    const res = await GET(createRequest())
    expect(res.status).toBe(403)
  })

  // --- No account ---
  test('returns connected:false if no account found', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue(null)

    const res = await GET(createRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.connected).toBe(false)
    expect(json.data.account).toBeNull()
  })

  // --- Account with charges disabled ---
  test('returns account data without dashboard/balance when charges not enabled', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue({ ...fullAccount, chargesEnabled: false })

    const res = await GET(createRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.connected).toBe(true)
    expect(json.data.account.dashboardUrl).toBeNull()
    expect(json.data.account.balance).toBeNull()
    expect(mockGateway.createDashboardLink).not.toHaveBeenCalled()
  })

  // --- Happy path with full data ---
  test('returns full account data with dashboard URL and balance', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue(fullAccount)
    mockGateway.createDashboardLink.mockResolvedValue({ url: 'https://dashboard.stripe.com/login' })
    mockGateway.getAccountBalance.mockResolvedValue({ available: 50000, pending: 12000 })

    const res = await GET(createRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.connected).toBe(true)
    expect(json.data.account.id).toBe('acct-1')
    expect(json.data.account.dashboardUrl).toBe('https://dashboard.stripe.com/login')
    expect(json.data.account.balance).toEqual({ available: 50000, pending: 12000 })
    expect(json.data.account.commissionRate).toBe(0.15)
  })

  // --- Provider data fetch error (graceful degradation) ---
  test('returns account data even if provider calls fail', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue(fullAccount)
    mockGateway.createDashboardLink.mockRejectedValue(new Error('Stripe timeout'))
    mockGateway.getAccountBalance.mockRejectedValue(new Error('Stripe timeout'))

    const res = await GET(createRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.connected).toBe(true)
    // Dashboard and balance should be null due to error
    expect(json.data.account.dashboardUrl).toBeNull()
    expect(json.data.account.balance).toBeNull()
  })

  // --- Uses x-team-id header ---
  test('uses x-team-id header for team context', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue(null)

    await GET(createRequest({ 'x-team-id': 'team-override' }))

    expect(mockMembershipGet).toHaveBeenCalledWith('user-1', 'team-override')
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.any(String),
      ['team-override']
    )
  })
})

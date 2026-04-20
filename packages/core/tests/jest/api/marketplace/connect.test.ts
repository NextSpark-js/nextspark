/**
 * Marketplace Connect API Route Tests
 *
 * POST /api/v1/marketplace/connect
 * Creates a connected account and returns an onboarding link.
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

const mockQuery = jest.fn()
const mockQueryOne = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  queryOne: (...args: any[]) => mockQueryOne(...args),
}))

const mockGateway = {
  provider: 'stripe_connect',
  createConnectedAccount: jest.fn(),
  createOnboardingLink: jest.fn(),
}
jest.mock('@nextsparkjs/core/lib/marketplace', () => ({
  getMarketplaceGateway: () => mockGateway,
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: any) => handler,
}))

// Must import AFTER mocks
import { POST } from '../../../../../../apps/dev/app/api/v1/marketplace/connect/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body?: any, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/v1/marketplace/connect', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...headers },
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

function membershipDenied(msg = 'Not allowed', reason = 'role') {
  mockMembershipGet.mockResolvedValue({
    canPerformAction: () => ({ allowed: false, message: msg, reason }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/marketplace/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:5173'
  })

  // --- Auth ---
  test('returns 401 if not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false })
    const res = await POST(createRequest({ country: 'US' }))
    expect(res.status).toBe(401)
  })

  // --- Team context ---
  test('returns 400 if no team context', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { ...fakeUser, defaultTeamId: null },
    })
    const res = await POST(createRequest({ country: 'US' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/team/i)
  })

  // --- Permission ---
  test('returns 403 if permission denied', async () => {
    authSuccess()
    membershipDenied()
    const res = await POST(createRequest({ country: 'US' }))
    expect(res.status).toBe(403)
  })

  // --- Validation ---
  test('returns 400 for invalid body (missing country)', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue(null) // no existing account
    const res = await POST(createRequest({}))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/validation/i)
  })

  test('returns 400 for invalid country code', async () => {
    authSuccess()
    membershipAllowed()
    const res = await POST(createRequest({ country: 'USA' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.details).toBeDefined()
  })

  test('returns 400 for invalid JSON body', async () => {
    authSuccess()
    membershipAllowed()
    // Create a request whose .json() throws
    const req = new NextRequest('http://localhost:3000/api/v1/marketplace/connect', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    }) as any
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/invalid json/i)
  })

  // --- 409: already active ---
  test('returns 409 if team already has active account', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue({
      id: 'acct-1',
      onboardingStatus: 'active',
      externalAccountId: 'ext-1',
    })

    const res = await POST(createRequest({ country: 'US' }))
    const json = await res.json()
    expect(res.status).toBe(409)
    expect(json.error).toMatch(/already has an active/i)
  })

  // --- Resume onboarding ---
  test('resumes onboarding if account exists but incomplete', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue({
      id: 'acct-1',
      onboardingStatus: 'pending',
      externalAccountId: 'ext-1',
    })
    mockQuery.mockResolvedValue(undefined)
    mockGateway.createOnboardingLink.mockResolvedValue({ url: 'https://onboarding.example.com' })

    const res = await POST(createRequest({ country: 'US' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.isResuming).toBe(true)
    expect(json.data.onboardingUrl).toBe('https://onboarding.example.com')
  })

  test('returns 500 if resume onboarding link fails', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue({
      id: 'acct-1',
      onboardingStatus: 'pending',
      externalAccountId: 'ext-1',
    })
    mockQuery.mockResolvedValue(undefined)
    mockGateway.createOnboardingLink.mockRejectedValue(new Error('Gateway error'))

    const res = await POST(createRequest({ country: 'US' }))
    expect(res.status).toBe(500)
  })

  // --- Happy path: new account ---
  test('creates new connected account and returns onboarding URL', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne
      .mockResolvedValueOnce(null) // no existing account
      .mockResolvedValueOnce({ id: 'new-acct-1' }) // INSERT RETURNING
    mockGateway.createConnectedAccount.mockResolvedValue({
      id: 'acct_stripe_123',
      email: 'test@test.com',
      onboardingStatus: 'pending',
      chargesEnabled: false,
      payoutsEnabled: false,
    })
    mockGateway.createOnboardingLink.mockResolvedValue({ url: 'https://stripe.com/onboard' })

    const res = await POST(createRequest({ country: 'US', businessName: 'My Biz' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.onboardingUrl).toBe('https://stripe.com/onboard')
    expect(json.data.accountId).toBe('new-acct-1')
    expect(json.data.externalAccountId).toBe('acct_stripe_123')
  })

  // --- 500: gateway error on creation ---
  test('returns 500 on gateway error during account creation', async () => {
    authSuccess()
    membershipAllowed()
    mockQueryOne.mockResolvedValue(null)
    mockGateway.createConnectedAccount.mockRejectedValue(new Error('Stripe down'))

    const res = await POST(createRequest({ country: 'US' }))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toMatch(/stripe down/i)
  })
})

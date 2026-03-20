/**
 * Marketplace Checkout API Route Tests
 *
 * POST /api/v1/marketplace/checkout
 * Creates a checkout session for a marketplace payment.
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

const mockQuery = jest.fn()
const mockQueryOne = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  queryOne: (...args: any[]) => mockQueryOne(...args),
}))

const mockGateway = {
  provider: 'stripe_connect',
  createMarketplaceCheckout: jest.fn(),
}
const mockCalculateFee = jest.fn((amount: number) => Math.round(amount * 0.15))
jest.mock('@nextsparkjs/core/lib/marketplace', () => ({
  getMarketplaceGateway: () => mockGateway,
  calculateFee: (...args: any[]) => mockCalculateFee(...args),
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: any) => handler,
}))

import { POST } from '../../../../../../apps/dev/app/api/v1/marketplace/checkout/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body?: any) {
  return new NextRequest('http://localhost:3000/api/v1/marketplace/checkout', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

const fakeUser = { id: 'user-1', email: 'buyer@test.com', defaultTeamId: 'team-1' }

function authSuccess() {
  mockAuthenticateRequest.mockResolvedValue({ success: true, user: fakeUser })
}

const validBody = {
  connectedAccountId: 'acct-1',
  amount: 10000,
  currency: 'usd',
  referenceId: 'booking-123',
  referenceType: 'booking',
  description: 'Booking for service',
}

const connectedAccount = {
  id: 'acct-1',
  teamId: 'team-seller',
  externalAccountId: 'acct_stripe_456',
  commissionRate: 0.15,
  fixedFee: 0,
  chargesEnabled: true,
  onboardingStatus: 'active',
  provider: 'stripe_connect',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/marketplace/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:5173'
  })

  // --- Auth ---
  test('returns 401 if not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false })
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(401)
  })

  // --- Validation ---
  test('returns 400 for invalid JSON body', async () => {
    authSuccess()
    const req = new NextRequest('http://localhost:3000/api/v1/marketplace/checkout', {
      method: 'POST',
      body: '{bad',
      headers: { 'Content-Type': 'application/json' },
    }) as any
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/invalid json/i)
  })

  test('returns 400 for missing required fields', async () => {
    authSuccess()
    const res = await POST(createRequest({ amount: 100 }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/validation/i)
  })

  test('returns 400 for negative amount', async () => {
    authSuccess()
    const res = await POST(createRequest({ ...validBody, amount: -100 }))
    expect(res.status).toBe(400)
  })

  // --- 404: account not found ---
  test('returns 404 if connected account not found', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue(null)
    const res = await POST(createRequest(validBody))
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toMatch(/not found/i)
  })

  // --- 400: charges not enabled ---
  test('returns 400 if charges not enabled on account', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue({ ...connectedAccount, chargesEnabled: false })
    const res = await POST(createRequest(validBody))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/cannot accept payments/i)
  })

  // --- Happy path ---
  test('creates checkout session and returns URL with fee breakdown', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue(connectedAccount)
    mockCalculateFee.mockReturnValue(1500)
    mockGateway.createMarketplaceCheckout.mockResolvedValue({
      id: 'pi_abc123',
      url: 'https://checkout.stripe.com/session',
    })
    mockQuery.mockResolvedValue(undefined) // INSERT payment record

    const res = await POST(createRequest(validBody))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.url).toBe('https://checkout.stripe.com/session')
    expect(json.data.paymentId).toBe('pi_abc123')
    expect(json.data.amount).toBe(10000)
    expect(json.data.applicationFee).toBe(1500)
    expect(json.data.businessAmount).toBe(8500)
    expect(json.data.currency).toBe('usd')
  })

  test('calculates commission correctly', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue(connectedAccount)
    mockCalculateFee.mockReturnValue(1500)
    mockGateway.createMarketplaceCheckout.mockResolvedValue({ id: 'pi_1', url: 'https://example.com' })
    mockQuery.mockResolvedValue(undefined)

    await POST(createRequest(validBody))

    expect(mockCalculateFee).toHaveBeenCalledWith(
      10000,
      expect.objectContaining({ rate: 0.15 })
    )
  })

  test('records payment in database', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue(connectedAccount)
    mockCalculateFee.mockReturnValue(1500)
    mockGateway.createMarketplaceCheckout.mockResolvedValue({ id: 'pi_1', url: 'https://example.com' })
    mockQuery.mockResolvedValue(undefined)

    await POST(createRequest(validBody))

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "marketplacePayments"'),
      expect.arrayContaining(['acct-1', 'team-seller', 'booking-123'])
    )
  })

  // --- 500: gateway error ---
  test('returns 500 on gateway checkout error', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue(connectedAccount)
    mockCalculateFee.mockReturnValue(1500)
    mockGateway.createMarketplaceCheckout.mockRejectedValue(new Error('Stripe error'))

    const res = await POST(createRequest(validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toMatch(/stripe error/i)
  })
})

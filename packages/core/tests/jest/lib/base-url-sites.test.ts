/**
 * The links and callbacks that use the app URL (#315): invitation email, billing return URLs.
 * With NEXT_PUBLIC_APP_URL set they are unchanged; without it a preview uses VERCEL_URL and
 * production falls back to localhost.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'

const mockQueryOneWithRLS = jest.fn()
const mockMutateWithRLS = jest.fn()
const mockSendInvitationEmail = jest.fn()
const mockCreateCheckoutSession = jest.fn()
const mockCreatePortalSession = jest.fn()

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: (...args: unknown[]) => mockQueryOneWithRLS(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, resetTime: 0 }),
  withRateLimitTier: (handler: unknown) => handler,
}))
jest.mock('@/core/lib/services/membership.service', () => ({
  MembershipService: { get: jest.fn().mockResolvedValue({ role: 'owner', canPerformAction: () => ({ allowed: true }) }) },
}))
jest.mock('@/core/lib/email/factory', () => ({ EmailFactory: { getInstance: () => ({ send: jest.fn().mockResolvedValue({ success: true }) }) } }))
jest.mock('@/core/lib/email/send', () => ({ sendTeamInvitationEmail: (...args: unknown[]) => mockSendInvitationEmail(...args) }))
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn(async () => ({ success: true, user: { id: 'u1', email: 'u@example.test', defaultTeamId: 'team-1' } })),
  createAuthFailureResponse: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/cors-response', () => ({ corsPreflight: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({
  getBillingGateway: async () => ({
    createCheckoutSession: (...a: unknown[]) => mockCreateCheckoutSession(...a),
    createPortalSession: (...a: unknown[]) => mockCreatePortalSession(...a),
  }),
}))
jest.mock('@nextsparkjs/core/lib/services', () => ({
  MembershipService: { get: jest.fn().mockResolvedValue({ canPerformAction: () => ({ allowed: true }) }) },
  SubscriptionService: { getActive: jest.fn().mockResolvedValue({ externalCustomerId: 'cus_1' }) },
}))

import { TeamInvitationService } from '@/core/lib/services/team-invitation.service'
import { POST as checkout } from '@/app/api/v1/billing/checkout/route'
import { POST as portal } from '@/app/api/v1/billing/portal/route'

const VERCEL = 'my-app-git-branch.vercel.app'
const keys = ['NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_URL'] as const
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))

// [label, env, expected app URL]
const cases: Array<[string, Partial<Record<(typeof keys)[number], string>>, string]> = [
  ['variable set', { NEXT_PUBLIC_APP_URL: 'https://app.example.com', VERCEL_ENV: 'preview', VERCEL_URL: VERCEL }, 'https://app.example.com'],
  ['preview without the variable', { VERCEL_ENV: 'preview', VERCEL_URL: VERCEL }, `https://${VERCEL}`],
  ['production without the variable', { VERCEL_ENV: 'production', VERCEL_URL: VERCEL }, 'http://localhost:5173'],
]

function useEnv(env: Partial<Record<(typeof keys)[number], string>>) {
  for (const k of keys) delete process.env[k]
  Object.assign(process.env, env)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryOneWithRLS.mockImplementation(async (sql: string) => (sql.includes('FROM "teams"') ? { id: 'team-1', name: 'Acme' } : null))
  mockMutateWithRLS.mockResolvedValue({ rows: [{ id: 'inv-1', token: 'tok' }], rowCount: 1 })
  mockSendInvitationEmail.mockResolvedValue({ subject: 's', html: 'h' })
  mockCreateCheckoutSession.mockResolvedValue({ url: 'u', id: 's' })
  mockCreatePortalSession.mockResolvedValue({ url: 'u' })
})

afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe.each(cases)('%s', (_label, env, appUrl) => {
  test('the invitation email links to the accept page on the app URL', async () => {
    useEnv(env)
    await TeamInvitationService.create({
      teamId: 'team-1',
      actor: { id: 'owner-1', email: 'o@example.test' },
      input: { email: 'new@example.test', role: 'member' },
    })
    const sent = mockSendInvitationEmail.mock.calls[0][0] as { acceptUrl?: string }
    expect(sent.acceptUrl?.startsWith(`${appUrl}/accept-invite/`)).toBe(true)
  })

  test('checkout returns to the billing page on the app URL', async () => {
    useEnv(env)
    const request = new NextRequest('http://x.test/api/v1/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planSlug: 'pro' }),
    })
    await checkout(request, undefined as never)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      successUrl: `${appUrl}/dashboard/settings/billing?success=true`,
      cancelUrl: `${appUrl}/dashboard/settings/billing?canceled=true`,
    }))
  })

  test('the portal returns to the billing page on the app URL', async () => {
    useEnv(env)
    const request = new NextRequest('http://x.test/api/v1/billing/portal', { method: 'POST' })
    await portal(request, undefined as never)
    expect(mockCreatePortalSession).toHaveBeenCalledWith({ customerId: 'cus_1', returnUrl: `${appUrl}/dashboard/settings/billing` })
  })
})

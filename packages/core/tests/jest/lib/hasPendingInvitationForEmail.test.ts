/**
 * hasPendingInvitationForEmail — used by the signup `after` hook to skip
 * auto-creating a personal team for an email that already has a pending
 * team invitation waiting (regardless of which signup route was used).
 */

// Mock db module BEFORE importing auth
const mockQueryOne = jest.fn();

jest.mock('@/core/lib/db', () => ({
  queryOne: mockQueryOne,
  parseSSLConfig: jest.fn(),
  stripSSLParams: jest.fn(),
}))

// Mock better-auth and its dependencies to avoid ESM parsing issues
jest.mock('better-auth', () => ({
  betterAuth: jest.fn(),
}))

jest.mock('better-auth/plugins', () => ({
  emailOTP: jest.fn(),
}))

jest.mock('better-auth/next-js', () => ({
  nextCookies: jest.fn(),
}))

// Import after all mocks are set up
import { hasPendingInvitationForEmail } from '@/core/lib/auth'

describe('hasPendingInvitationForEmail', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true when a pending, unexpired invitation matches the email', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'inv-1' })

    await expect(hasPendingInvitationForEmail('person@example.com')).resolves.toBe(true)
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('team_invitations'),
      ['person@example.com'],
    )
  })

  it('returns false when no matching row exists (expired, wrong status, or no invitation at all)', async () => {
    mockQueryOne.mockResolvedValueOnce(null)

    await expect(hasPendingInvitationForEmail('nobody@example.com')).resolves.toBe(false)
  })
})

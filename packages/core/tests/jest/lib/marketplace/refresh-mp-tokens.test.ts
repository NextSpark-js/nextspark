/**
 * Unit Tests: Refresh MercadoPago OAuth Tokens Handler
 *
 * Tests the scheduled action that proactively refreshes expiring
 * MercadoPago OAuth tokens for connected seller accounts.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// --- Mocks ---

// Mock the DB module
const mockQueryWithRLS = jest.fn() as jest.MockedFunction<typeof import('@/core/lib/db').queryWithRLS>
const mockMutateWithRLS = jest.fn() as jest.MockedFunction<typeof import('@/core/lib/db').mutateWithRLS>

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: (...args: unknown[]) => mockQueryWithRLS(...args as Parameters<typeof mockQueryWithRLS>),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args as Parameters<typeof mockMutateWithRLS>),
}))

// Mock refreshMPToken
const mockRefreshMPToken = jest.fn() as jest.MockedFunction<typeof import('@/core/lib/marketplace/gateways/mercadopago-split').refreshMPToken>

jest.mock('@/core/lib/marketplace/gateways/mercadopago-split', () => ({
  refreshMPToken: (...args: unknown[]) => mockRefreshMPToken(...args as Parameters<typeof mockRefreshMPToken>),
}))

// Mock token encryption
const mockDecryptToken = jest.fn() as jest.MockedFunction<typeof import('@/core/lib/marketplace/token-encryption').decryptToken>
const mockEncryptTokens = jest.fn() as jest.MockedFunction<typeof import('@/core/lib/marketplace/token-encryption').encryptTokens>

jest.mock('@/core/lib/marketplace/token-encryption', () => ({
  decryptToken: (...args: unknown[]) => mockDecryptToken(...args as Parameters<typeof mockDecryptToken>),
  encryptTokens: (...args: unknown[]) => mockEncryptTokens(...args as Parameters<typeof mockEncryptTokens>),
}))

// Mock the registry (prevent console output)
jest.mock('@/core/lib/scheduled-actions/registry', () => ({
  registerScheduledAction: jest.fn(),
}))

import { refreshMPTokensHandler, registerRefreshMPTokensHandler } from '@/core/lib/marketplace/handlers/refresh-mp-tokens'
import { registerScheduledAction } from '@/core/lib/scheduled-actions/registry'

describe('refreshMPTokensHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should return zeros when no accounts have expiring tokens', async () => {
    mockQueryWithRLS.mockResolvedValueOnce([] as never)

    const result = await refreshMPTokensHandler()

    expect(result).toEqual({
      refreshed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    })
    expect(mockQueryWithRLS).toHaveBeenCalledTimes(1)
    // Verify the query targets mercadopago_split active accounts
    expect(mockQueryWithRLS).toHaveBeenCalledWith(
      expect.stringContaining("provider = 'mercadopago_split'"),
      expect.any(Array),
      null
    )
  })

  test('should refresh tokens for accounts expiring within 30 days', async () => {
    const expiringAccount = {
      id: 'ca-001',
      teamId: 'team-123',
      externalAccountId: 'mp-ext-001',
      metadata: {
        mpTokens: {
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
          publicKey: 'TEST-public-key',
        },
      },
    }

    mockQueryWithRLS.mockResolvedValueOnce([expiringAccount] as never)
    mockDecryptToken.mockReturnValue('decrypted-refresh-token')
    mockRefreshMPToken.mockResolvedValueOnce({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 15552000, // ~180 days in seconds
    })
    mockEncryptTokens.mockReturnValueOnce({
      accessToken: 'encrypted-new-access',
      refreshToken: 'encrypted-new-refresh',
      expiresAt: expect.any(String) as unknown as string,
      publicKey: 'TEST-public-key',
    })
    mockMutateWithRLS.mockResolvedValueOnce(undefined as never)

    const result = await refreshMPTokensHandler()

    expect(result.refreshed).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)

    // Verify decrypt was called with the stored refresh token
    expect(mockDecryptToken).toHaveBeenCalledWith('encrypted-refresh-token')

    // Verify refreshMPToken was called with decrypted token
    expect(mockRefreshMPToken).toHaveBeenCalledWith('decrypted-refresh-token')

    // Verify new tokens were encrypted before storage
    expect(mockEncryptTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        publicKey: 'TEST-public-key',
      })
    )

    // Verify DB update was called
    expect(mockMutateWithRLS).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "connectedAccounts"'),
      expect.arrayContaining(['ca-001']),
      null
    )
  })

  test('should skip accounts with missing refresh tokens', async () => {
    const accountNoRefresh = {
      id: 'ca-002',
      teamId: 'team-456',
      externalAccountId: 'mp-ext-002',
      metadata: {
        mpTokens: {
          accessToken: 'encrypted-access',
          refreshToken: '', // empty
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          publicKey: 'pk',
        },
      },
    }

    mockQueryWithRLS.mockResolvedValueOnce([accountNoRefresh] as never)

    const result = await refreshMPTokensHandler()

    expect(result.skipped).toBe(1)
    expect(result.refreshed).toBe(0)
    expect(result.failed).toBe(0)
    expect(mockRefreshMPToken).not.toHaveBeenCalled()
  })

  test('should continue processing when one account fails', async () => {
    const account1 = {
      id: 'ca-fail',
      teamId: 'team-1',
      externalAccountId: 'mp-1',
      metadata: {
        mpTokens: {
          accessToken: 'enc-a1',
          refreshToken: 'enc-r1',
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          publicKey: 'pk1',
        },
      },
    }
    const account2 = {
      id: 'ca-ok',
      teamId: 'team-2',
      externalAccountId: 'mp-2',
      metadata: {
        mpTokens: {
          accessToken: 'enc-a2',
          refreshToken: 'enc-r2',
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          publicKey: 'pk2',
        },
      },
    }

    mockQueryWithRLS.mockResolvedValueOnce([account1, account2] as never)

    // First call to decryptToken (for account1) throws
    mockDecryptToken
      .mockImplementationOnce(() => { throw new Error('Decryption failed') })
      .mockReturnValueOnce('decrypted-r2')

    mockRefreshMPToken.mockResolvedValueOnce({
      accessToken: 'new-a2',
      refreshToken: 'new-r2',
      expiresIn: 15552000,
    })
    mockEncryptTokens.mockReturnValueOnce({
      accessToken: 'enc-new-a2',
      refreshToken: 'enc-new-r2',
      expiresAt: 'some-date',
      publicKey: 'pk2',
    })
    mockMutateWithRLS.mockResolvedValueOnce(undefined as never)

    const result = await refreshMPTokensHandler()

    expect(result.refreshed).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('ca-fail')
    expect(result.errors[0]).toContain('Decryption failed')
  })

  test('should handle MercadoPago API refresh failure gracefully', async () => {
    const account = {
      id: 'ca-api-fail',
      teamId: 'team-3',
      externalAccountId: 'mp-3',
      metadata: {
        mpTokens: {
          accessToken: 'enc-a3',
          refreshToken: 'enc-r3',
          expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          publicKey: 'pk3',
        },
      },
    }

    mockQueryWithRLS.mockResolvedValueOnce([account] as never)
    mockDecryptToken.mockReturnValue('decrypted-r3')
    mockRefreshMPToken.mockRejectedValueOnce(
      new Error('MercadoPago token refresh failed: 401 Unauthorized')
    )

    const result = await refreshMPTokensHandler()

    expect(result.refreshed).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.errors[0]).toContain('401 Unauthorized')
    // DB should not have been updated
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })
})

describe('registerRefreshMPTokensHandler', () => {
  test('should register the handler with the scheduled actions registry', () => {
    registerRefreshMPTokensHandler()

    expect(registerScheduledAction).toHaveBeenCalledWith(
      'marketplace:refresh-mp-tokens',
      expect.any(Function),
      {
        description: 'Refresh MercadoPago OAuth tokens expiring within 30 days',
        timeout: 120000,
      }
    )
  })
})

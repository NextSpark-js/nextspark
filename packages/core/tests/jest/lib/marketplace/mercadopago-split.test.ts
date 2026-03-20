/**
 * MercadoPago Split Gateway Tests
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createHmac } from 'crypto'

// Mock global.fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

import {
  MercadoPagoSplitGateway,
  setMPTokenProvider,
  exchangeMPAuthorizationCode,
  refreshMPToken,
} from '@/core/lib/marketplace/gateways/mercadopago-split'

describe('MercadoPagoSplitGateway', () => {
  const originalEnv = process.env
  let gateway: MercadoPagoSplitGateway

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      MP_APP_ID: 'test-app-id',
      MP_CLIENT_SECRET: 'test-client-secret',
      MP_ACCESS_TOKEN: 'test-platform-token',
      MP_WEBHOOK_SECRET: 'test-webhook-secret',
    }
    gateway = new MercadoPagoSplitGateway()

    // Set mock token provider for seller tokens
    setMPTokenProvider({
      getAccessToken: async () => 'test-seller-token',
    })
  })

  afterEach(() => {
    process.env = originalEnv
    // Reset token provider to default
    setMPTokenProvider({
      async getAccessToken(): Promise<string> {
        const token = process.env.MP_ACCESS_TOKEN
        if (!token) throw new Error('MP_ACCESS_TOKEN is not configured')
        return token
      },
    })
  })

  test('provider should be mercadopago_split', () => {
    expect(gateway.provider).toBe('mercadopago_split')
  })

  describe('createConnectedAccount', () => {
    test('should return pending result with the teamId', async () => {
      const result = await gateway.createConnectedAccount({
        teamId: 'team-456',
        email: 'seller@test.com',
        businessName: 'Test Store',
        country: 'AR',
      })

      expect(result).toEqual({
        id: 'pending_team-456',
        email: 'seller@test.com',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingStatus: 'pending',
      })
    })
  })

  describe('createOnboardingLink', () => {
    test('should construct correct OAuth URL with client_id and state', async () => {
      const result = await gateway.createOnboardingLink({
        externalAccountId: 'acct_mp_123',
        returnUrl: 'https://app.com/callback',
        refreshUrl: 'https://app.com/refresh',
      })

      expect(result.url).toContain('https://auth.mercadopago.com/authorization')
      expect(result.url).toContain('client_id=test-app-id')
      expect(result.url).toContain('response_type=code')
      expect(result.url).toContain(`state=${encodeURIComponent('acct_mp_123')}`)
      expect(result.url).toContain(`redirect_uri=${encodeURIComponent('https://app.com/callback')}`)
    })

    test('should throw when MP_APP_ID is missing', async () => {
      delete process.env.MP_APP_ID

      await expect(
        gateway.createOnboardingLink({
          externalAccountId: 'acct_mp_123',
          returnUrl: 'https://app.com/callback',
          refreshUrl: 'https://app.com/refresh',
        })
      ).rejects.toThrow('MP_APP_ID is not configured')
    })
  })

  describe('createMarketplaceCheckout', () => {
    test('should call /checkout/preferences with marketplace_fee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pref_test_123',
          init_point: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
          sandbox_init_point: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
        }),
      } as Response)

      const result = await gateway.createMarketplaceCheckout({
        connectedAccountId: 'internal-id-123',
        externalAccountId: 'acct_mp_seller',
        amount: 10000,
        currency: 'ars',
        applicationFee: 1500,
        referenceId: 'order-789',
        description: 'Premium Service',
        customerEmail: 'customer@test.com',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      })

      expect(result).toEqual({
        id: 'pref_test_123',
        status: 'pending',
        url: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/checkout/preferences',
        expect.objectContaining({
          method: 'POST',
        })
      )

      // Verify the body sent to MercadoPago
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse((callArgs[1] as RequestInit).body as string)

      expect(body.marketplace_fee).toBe(1500)
      expect(body.items).toEqual([
        expect.objectContaining({
          id: 'order-789',
          title: 'Premium Service',
          quantity: 1,
          unit_price: 10000,
          currency_id: 'ARS',
        }),
      ])
      expect(body.back_urls).toEqual({
        success: 'https://app.com/success',
        failure: 'https://app.com/cancel',
        pending: 'https://app.com/success',
      })
      expect(body.payer).toEqual({ email: 'customer@test.com' })
      expect(body.external_reference).toBe('order-789')
    })
  })

  describe('createMarketplacePayment', () => {
    test('should call /v1/payments with marketplace_fee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345678,
          status: 'approved',
          status_detail: 'accredited',
          transaction_amount: 5000,
          currency_id: 'ARS',
        }),
      } as Response)

      const result = await gateway.createMarketplacePayment({
        connectedAccountId: 'internal-id-123',
        externalAccountId: 'acct_mp_seller',
        amount: 5000,
        currency: 'ars',
        applicationFee: 750,
        referenceId: 'order-456',
        description: 'Basic Service',
        customerEmail: 'buyer@test.com',
      })

      expect(result).toEqual({
        id: '12345678',
        status: 'succeeded',
        statusDetail: 'accredited',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/payments',
        expect.objectContaining({ method: 'POST' })
      )

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse((callArgs[1] as RequestInit).body as string)

      expect(body.transaction_amount).toBe(5000)
      expect(body.marketplace_fee).toBe(750)
      expect(body.payer).toEqual({ email: 'buyer@test.com' })
      expect(body.external_reference).toBe('order-456')
    })
  })

  describe('getPaymentStatus', () => {
    test('should fetch payment and map status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 99887766,
          status: 'approved',
          status_detail: 'accredited',
          transaction_amount: 10000,
          currency_id: 'ARS',
        }),
      } as Response)

      const result = await gateway.getPaymentStatus('99887766')

      expect(result).toEqual({
        id: '99887766',
        status: 'succeeded',
        statusDetail: 'accredited',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/payments/99887766',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-platform-token',
          }),
        })
      )
    })

    test('should map pending status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 11223344,
          status: 'pending',
          status_detail: 'pending_waiting_payment',
        }),
      } as Response)

      const result = await gateway.getPaymentStatus('11223344')
      expect(result.status).toBe('pending')
    })

    test('should map rejected status to failed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 55667788,
          status: 'rejected',
          status_detail: 'cc_rejected_other_reason',
        }),
      } as Response)

      const result = await gateway.getPaymentStatus('55667788')
      expect(result.status).toBe('failed')
    })

    test('should throw when MP_ACCESS_TOKEN is missing', async () => {
      delete process.env.MP_ACCESS_TOKEN

      await expect(gateway.getPaymentStatus('12345')).rejects.toThrow(
        'MP_ACCESS_TOKEN is not configured'
      )
    })
  })

  describe('refundPayment', () => {
    test('should POST to /v1/payments/{id}/refunds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 111222333,
          amount: 10000,
          status: 'approved',
        }),
      } as Response)

      const result = await gateway.refundPayment({
        externalPaymentId: '99887766',
      })

      expect(result).toEqual({
        id: '111222333',
        amount: 10000,
        status: 'approved',
        feeRefunded: 0,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/payments/99887766/refunds',
        expect.objectContaining({ method: 'POST' })
      )
    })

    test('should support partial refund with amount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 444555666,
          amount: 5000,
          status: 'approved',
        }),
      } as Response)

      const result = await gateway.refundPayment({
        externalPaymentId: '99887766',
        amount: 5000,
      })

      expect(result.amount).toBe(5000)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse((callArgs[1] as RequestInit).body as string)
      expect(body.amount).toBe(5000)
    })
  })

  describe('getAccountBalance', () => {
    test('should return available and pending amounts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available_balance: 50000,
          unavailable_balance: 12000,
          currency_id: 'ARS',
        }),
      } as Response)

      const result = await gateway.getAccountBalance('acct_mp_seller')

      expect(result).toEqual({
        available: 50000,
        pending: 12000,
        currency: 'ars',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/users/me/mercadopago_account/balance',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-seller-token',
          }),
        })
      )
    })
  })

  describe('verifyWebhookSignature', () => {
    function buildSignature(dataId: string, requestId: string, ts: string, secret: string): string {
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
      const hmac = createHmac('sha256', secret).update(manifest).digest('hex')
      return `ts=${ts},v1=${hmac}`
    }

    test('should verify a valid signature', () => {
      const payload = JSON.stringify({
        id: 'webhook-event-1',
        type: 'payment',
        data: { id: 'pay_123' },
        user_id: 12345,
      })
      const requestId = 'req-abc-123'
      const ts = '1700000000'
      const xSignature = buildSignature('pay_123', requestId, ts, 'test-webhook-secret')

      const result = gateway.verifyWebhookSignature(payload, {
        'x-signature': xSignature,
        'x-request-id': requestId,
      })

      expect(result).toEqual({
        id: 'webhook-event-1',
        type: 'payment',
        account: '12345',
        data: { id: 'pay_123' },
      })
    })

    test('should throw on invalid signature', () => {
      const payload = JSON.stringify({
        id: 'webhook-event-2',
        type: 'payment',
        data: { id: 'pay_456' },
      })

      expect(() =>
        gateway.verifyWebhookSignature(payload, {
          'x-signature': 'ts=1700000000,v1=invalid_hash_value',
          'x-request-id': 'req-xyz-789',
        })
      ).toThrow('MercadoPago webhook signature verification failed')
    })

    test('should throw when MP_WEBHOOK_SECRET is missing', () => {
      delete process.env.MP_WEBHOOK_SECRET

      const payload = JSON.stringify({ id: '1', type: 'payment', data: { id: '2' } })

      expect(() =>
        gateway.verifyWebhookSignature(payload, {
          'x-signature': 'ts=123,v1=abc',
          'x-request-id': 'req-1',
        })
      ).toThrow('MP_WEBHOOK_SECRET is not configured')
    })
  })

  describe('createPayout', () => {
    test('should throw because MercadoPago handles payouts automatically', async () => {
      await expect(
        gateway.createPayout({
          externalAccountId: 'acct_mp_seller',
          amount: 1000,
          currency: 'ars',
        })
      ).rejects.toThrow('MercadoPago handles payouts automatically')
    })
  })
})

describe('exchangeMPAuthorizationCode', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      MP_APP_ID: 'test-app-id',
      MP_CLIENT_SECRET: 'test-client-secret',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('should POST to /oauth/token and return tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'APP_USR-new-access-token',
        refresh_token: 'TG-new-refresh-token',
        expires_in: 15552000,
        user_id: 987654,
        public_key: 'APP_USR-public-key',
      }),
    } as Response)

    const result = await exchangeMPAuthorizationCode('auth-code-xyz', 'https://app.com/callback')

    expect(result).toEqual({
      accessToken: 'APP_USR-new-access-token',
      refreshToken: 'TG-new-refresh-token',
      expiresIn: 15552000,
      userId: 987654,
      publicKey: 'APP_USR-public-key',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse((callArgs[1] as RequestInit).body as string)

    expect(body).toEqual({
      client_id: 'test-app-id',
      client_secret: 'test-client-secret',
      grant_type: 'authorization_code',
      code: 'auth-code-xyz',
      redirect_uri: 'https://app.com/callback',
    })
  })

  test('should throw when MP_APP_ID or MP_CLIENT_SECRET is missing', async () => {
    delete process.env.MP_APP_ID
    delete process.env.MP_CLIENT_SECRET

    await expect(
      exchangeMPAuthorizationCode('code', 'https://app.com/callback')
    ).rejects.toThrow('MP_APP_ID and MP_CLIENT_SECRET are required for OAuth')
  })

  test('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'invalid_grant',
    } as Response)

    await expect(
      exchangeMPAuthorizationCode('bad-code', 'https://app.com/callback')
    ).rejects.toThrow('MercadoPago OAuth token exchange failed: invalid_grant')
  })
})

describe('refreshMPToken', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      MP_APP_ID: 'test-app-id',
      MP_CLIENT_SECRET: 'test-client-secret',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('should POST to /oauth/token with refresh_token grant', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'APP_USR-refreshed-token',
        refresh_token: 'TG-new-refresh',
        expires_in: 15552000,
      }),
    } as Response)

    const result = await refreshMPToken('TG-old-refresh-token')

    expect(result).toEqual({
      accessToken: 'APP_USR-refreshed-token',
      refreshToken: 'TG-new-refresh',
      expiresIn: 15552000,
    })

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse((callArgs[1] as RequestInit).body as string)

    expect(body).toEqual({
      client_id: 'test-app-id',
      client_secret: 'test-client-secret',
      grant_type: 'refresh_token',
      refresh_token: 'TG-old-refresh-token',
    })
  })

  test('should throw when MP_APP_ID or MP_CLIENT_SECRET is missing', async () => {
    delete process.env.MP_APP_ID
    delete process.env.MP_CLIENT_SECRET

    await expect(refreshMPToken('some-token')).rejects.toThrow(
      'MP_APP_ID and MP_CLIENT_SECRET are required for OAuth'
    )
  })

  test('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'invalid_refresh_token',
    } as Response)

    await expect(refreshMPToken('bad-token')).rejects.toThrow(
      'MercadoPago token refresh failed: invalid_refresh_token'
    )
  })
})

/**
 * Marketplace Gateway Factory Tests
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'

// Mock Stripe before importing
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({}))
})

import {
  getMarketplaceGateway,
  resetMarketplaceGateway,
  setMarketplaceProvider,
} from '@/core/lib/marketplace/gateways/factory'
import { StripeConnectGateway } from '@/core/lib/marketplace/gateways/stripe-connect'
import { MercadoPagoSplitGateway } from '@/core/lib/marketplace/gateways/mercadopago-split'

describe('Marketplace Gateway Factory', () => {
  const originalEnv = process.env

  beforeEach(() => {
    resetMarketplaceGateway()
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_mock',
      MP_ACCESS_TOKEN: 'TEST-mock-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    resetMarketplaceGateway()
  })

  test('should return StripeConnectGateway by default', () => {
    const gw = getMarketplaceGateway('stripe_connect')
    expect(gw).toBeInstanceOf(StripeConnectGateway)
  })

  test('should return MercadoPagoSplitGateway when configured', () => {
    const gw = getMarketplaceGateway('mercadopago_split')
    expect(gw).toBeInstanceOf(MercadoPagoSplitGateway)
  })

  test('should return singleton instance', () => {
    const gw1 = getMarketplaceGateway('stripe_connect')
    const gw2 = getMarketplaceGateway()
    expect(gw1).toBe(gw2)
  })

  test('should return new instance after reset', () => {
    const gw1 = getMarketplaceGateway('stripe_connect')
    resetMarketplaceGateway()
    const gw2 = getMarketplaceGateway('stripe_connect')
    expect(gw1).not.toBe(gw2)
  })

  test('should switch provider when different provider requested', () => {
    const gw1 = getMarketplaceGateway('stripe_connect')
    expect(gw1).toBeInstanceOf(StripeConnectGateway)

    const gw2 = getMarketplaceGateway('mercadopago_split')
    expect(gw2).toBeInstanceOf(MercadoPagoSplitGateway)
  })

  test('should use setMarketplaceProvider configuration', () => {
    setMarketplaceProvider('mercadopago_split')
    const gw = getMarketplaceGateway()
    expect(gw).toBeInstanceOf(MercadoPagoSplitGateway)
  })

  test('should throw for unsupported provider', () => {
    expect(() => {
      getMarketplaceGateway('unknown' as any)
    }).toThrow('Unsupported marketplace provider')
  })

  test('should use MARKETPLACE_PROVIDER env var as fallback', () => {
    process.env.MARKETPLACE_PROVIDER = 'mercadopago_split'
    const gw = getMarketplaceGateway()
    expect(gw).toBeInstanceOf(MercadoPagoSplitGateway)
  })

  test('gateway should expose provider name', () => {
    const stripe = getMarketplaceGateway('stripe_connect')
    expect(stripe.provider).toBe('stripe_connect')

    resetMarketplaceGateway()
    const mp = getMarketplaceGateway('mercadopago_split')
    expect(mp.provider).toBe('mercadopago_split')
  })
})

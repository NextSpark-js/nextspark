/**
 * The plugin's configuration, read when it is used: a missing variable fails the action that needs it, and only that
 * one. A secret is never part of an error message.
 */

import { getPluginEnv } from '@nextsparkjs/core/lib/plugins/env-loader'
import { assertCommissionConfig, type CommissionConfig } from './commission'
import { parseTokenKeyring, type TokenKeyring } from './token-crypto'

export class MarketplaceNotConfiguredError extends Error {
  constructor(what: string) {
    super(`Marketplace payments: ${what} is not configured`)
    this.name = 'MarketplaceNotConfiguredError'
  }
}

const env = () => getPluginEnv('marketplace-payments')
const list = (value: string | undefined) => (value ?? '').split(',').map(part => part.trim()).filter(Boolean)

function required(name: string): string {
  const value = env()[name]?.trim()
  if (!value) throw new MarketplaceNotConfiguredError(name)
  return value
}

export const stripeSecretKey = () => required('MARKETPLACE_STRIPE_SECRET_KEY')
export const stripeLiveMode = () => /^(sk|rk)_live_/.test(env().MARKETPLACE_STRIPE_SECRET_KEY?.trim() ?? '')
/** Comma-separated: the platform endpoint's secret, the connected-accounts endpoint's, and any being rotated. */
export const stripeWebhookSecrets = () => list(env().MARKETPLACE_STRIPE_WEBHOOK_SECRETS)
export const mercadoPagoClientId = () => required('MARKETPLACE_MERCADOPAGO_CLIENT_ID')
export const mercadoPagoClientSecret = () => required('MARKETPLACE_MERCADOPAGO_CLIENT_SECRET')
export const mercadoPagoWebhookSecrets = () => list(env().MARKETPLACE_MERCADOPAGO_WEBHOOK_SECRETS)
export const mercadoPagoSandbox = () => env().MARKETPLACE_MERCADOPAGO_SANDBOX === 'true'
export const isStripeConfigured = () => Boolean(env().MARKETPLACE_STRIPE_SECRET_KEY)
export const isMercadoPagoConfigured = () => Boolean(env().MARKETPLACE_MERCADOPAGO_CLIENT_ID && env().MARKETPLACE_MERCADOPAGO_CLIENT_SECRET)

export function tokenKeyring(): TokenKeyring {
  return parseTokenKeyring(env().MARKETPLACE_TOKEN_KEYS)
}

function optionalInteger(name: string): number | undefined {
  const value = env()[name]?.trim()
  if (!value) return undefined
  if (!/^\d+$/.test(value)) throw new MarketplaceNotConfiguredError(`${name} as a whole number`)
  return Number(value)
}

/** The platform's commission. There is no default: a platform that forgets to set it must not charge 0% silently. */
export function defaultCommission(): CommissionConfig {
  const percentBps = optionalInteger('MARKETPLACE_COMMISSION_BPS')
  if (percentBps === undefined) throw new MarketplaceNotConfiguredError('MARKETPLACE_COMMISSION_BPS')
  const config = {
    percentBps,
    fixedCents: optionalInteger('MARKETPLACE_COMMISSION_FIXED_CENTS'),
    minCents: optionalInteger('MARKETPLACE_COMMISSION_MIN_CENTS'),
    maxCents: optionalInteger('MARKETPLACE_COMMISSION_MAX_CENTS'),
  }
  assertCommissionConfig(config)
  return config
}

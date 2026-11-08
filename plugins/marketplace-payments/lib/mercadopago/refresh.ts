/**
 * Renews sellers' MercadoPago tokens before they expire. MercadoPago issues a new refresh token with every renewal and
 * the old one stops working, so each seller is renewed under a row lock: two runs cannot spend the same refresh token.
 */

import { ProviderApiError } from '../provider-error'
import type { MercadoPagoTokens } from './gateway'

export const REFRESH_TOKENS_ACTION = 'marketplace-payments:refresh-mercadopago-tokens'

/** Tokens last 180 days; renewing 30 days ahead leaves time for a provider outage. */
const REFRESH_AHEAD_MS = 30 * 24 * 60 * 60 * 1000
// ponytail: 200 sellers per run; the action is hourly, so raise it past ~4800 sellers renewing on one day
const BATCH = 200

export interface LockedCredential {
  accountId: string
  refreshToken: string
  expiresAt: Date
}

export type CredentialUpdate = { tokens: MercadoPagoTokens } | 'revoked' | null

export interface TokenRefreshStore {
  listMercadoPagoAccountsExpiringBefore(before: Date, limit: number): Promise<string[]>
  /** Runs `decide` with the account's credential locked and applies its result; a locked row is skipped. */
  updateLockedCredential(accountId: string, decide: (current: LockedCredential) => Promise<CredentialUpdate>): Promise<void>
}

export interface TokenRefresher {
  refreshAccessToken(refreshToken: string): Promise<MercadoPagoTokens>
}

export interface RefreshSummary {
  refreshed: number
  revoked: number
  failed: number
}

export async function refreshExpiringMercadoPagoTokens(store: TokenRefreshStore, gateway: TokenRefresher, now = new Date()): Promise<RefreshSummary> {
  const cutoff = new Date(now.getTime() + REFRESH_AHEAD_MS)
  const summary: RefreshSummary = { refreshed: 0, revoked: 0, failed: 0 }

  for (const accountId of await store.listMercadoPagoAccountsExpiringBefore(cutoff, BATCH)) {
    try {
      await store.updateLockedCredential(accountId, async current => {
        // another run renewed it between the list and the lock
        if (current.expiresAt > cutoff) return null
        try {
          const tokens = await gateway.refreshAccessToken(current.refreshToken)
          summary.refreshed++
          return { tokens }
        } catch (error) {
          if (error instanceof ProviderApiError && error.code === 'invalid_grant') {
            summary.revoked++
            return 'revoked'
          }
          throw error
        }
      })
    } catch (error) {
      summary.failed++
      // the error's name and status only: it can come from a request that carried a token
      console.error(`[marketplace-payments] Token refresh failed for account ${accountId} (${error instanceof ProviderApiError ? error.message : 'unexpected error'})`)
    }
  }
  return summary
}

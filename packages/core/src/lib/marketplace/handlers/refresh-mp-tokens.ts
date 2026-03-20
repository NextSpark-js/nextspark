/**
 * Scheduled Action: Refresh MercadoPago OAuth Tokens
 *
 * Runs daily via the scheduled actions system. Finds all MercadoPago
 * connected accounts with OAuth tokens expiring within 30 days and
 * proactively refreshes them.
 *
 * MercadoPago tokens expire after ~180 days. By refreshing 30 days
 * before expiry, we ensure sellers never experience authentication
 * failures during payment processing.
 *
 * @module core/lib/marketplace/handlers/refresh-mp-tokens
 */

import { queryWithRLS, mutateWithRLS } from '../../db'
import { refreshMPToken } from '../gateways/mercadopago-split'
import { encryptTokens, decryptToken } from '../token-encryption'
import { registerScheduledAction } from '../../scheduled-actions/registry'
import type { ScheduledAction } from '../../scheduled-actions/types'

/**
 * Result returned by the refresh handler for logging/monitoring
 */
export interface RefreshMPTokensResult {
  refreshed: number
  failed: number
  skipped: number
  errors: string[]
}

/**
 * Database row shape for connected accounts with MP tokens
 */
interface ConnectedAccountRow {
  id: string
  teamId: string
  externalAccountId: string
  metadata: {
    mpTokens: {
      accessToken: string
      refreshToken: string
      expiresAt: string
      publicKey: string
    }
  }
}

/**
 * Number of days before token expiry to trigger a refresh.
 * 30 days gives ample buffer for retries if something goes wrong.
 */
const REFRESH_BEFORE_DAYS = 30

/**
 * Core handler logic: find expiring tokens and refresh them.
 *
 * Separated from the registration function for testability.
 * The handler queries all MercadoPago connected accounts whose tokens
 * expire within REFRESH_BEFORE_DAYS, decrypts the refresh token,
 * calls the MercadoPago OAuth refresh endpoint, and stores the
 * newly encrypted tokens back in the database.
 */
export async function refreshMPTokensHandler(): Promise<RefreshMPTokensResult> {
  const result: RefreshMPTokensResult = {
    refreshed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  // Find accounts with tokens expiring within 30 days
  // The expiresAt field is stored as an ISO string inside the JSONB metadata
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() + REFRESH_BEFORE_DAYS)

  const accounts = await queryWithRLS<ConnectedAccountRow>(
    `SELECT id, "teamId", "externalAccountId", metadata
     FROM "connectedAccounts"
     WHERE provider = 'mercadopago_split'
       AND status = 'active'
       AND metadata->'mpTokens'->>'expiresAt' IS NOT NULL
       AND (metadata->'mpTokens'->>'expiresAt')::timestamptz < $1::timestamptz
     ORDER BY (metadata->'mpTokens'->>'expiresAt')::timestamptz ASC`,
    [thresholdDate.toISOString()],
    null // System operation, no user context
  )

  if (accounts.length === 0) {
    console.info('[ScheduledAction:marketplace:refresh-mp-tokens] No tokens expiring soon, nothing to refresh')
    return result
  }

  console.info(
    `[ScheduledAction:marketplace:refresh-mp-tokens] Found ${accounts.length} account(s) with tokens expiring before ${thresholdDate.toISOString()}`
  )

  // Process each account individually so one failure doesn't block others
  for (const account of accounts) {
    try {
      const mpTokens = account.metadata?.mpTokens
      if (!mpTokens?.refreshToken) {
        console.warn(
          `[ScheduledAction:marketplace:refresh-mp-tokens] Account ${account.id} has no refresh token, skipping`
        )
        result.skipped++
        continue
      }

      // Decrypt the stored refresh token
      const decryptedRefreshToken = decryptToken(mpTokens.refreshToken)

      // Call MercadoPago OAuth refresh endpoint
      const newTokens = await refreshMPToken(decryptedRefreshToken)

      // Calculate new expiry date
      const newExpiresAt = new Date(Date.now() + newTokens.expiresIn * 1000).toISOString()

      // Encrypt the new tokens before storing
      const encryptedTokens = encryptTokens({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newExpiresAt,
        publicKey: mpTokens.publicKey, // publicKey doesn't change on refresh
      })

      // Update the database with new encrypted tokens
      await mutateWithRLS(
        `UPDATE "connectedAccounts"
         SET metadata = jsonb_set(
           metadata,
           '{mpTokens}',
           $2::jsonb
         ),
         "updatedAt" = NOW()
         WHERE id = $1`,
        [
          account.id,
          JSON.stringify(encryptedTokens),
        ],
        null // System operation
      )

      result.refreshed++
      console.info(
        `[ScheduledAction:marketplace:refresh-mp-tokens] Refreshed tokens for account ${account.id} (team: ${account.teamId}), new expiry: ${newExpiresAt}`
      )
    } catch (error) {
      result.failed++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Account ${account.id}: ${errorMessage}`)
      console.error(
        `[ScheduledAction:marketplace:refresh-mp-tokens] Failed to refresh tokens for account ${account.id}:`,
        errorMessage
      )
    }
  }

  console.info(
    `[ScheduledAction:marketplace:refresh-mp-tokens] Complete: ` +
    `${result.refreshed} refreshed, ${result.failed} failed, ${result.skipped} skipped`
  )

  return result
}

/**
 * Register the MercadoPago token refresh handler with the scheduled actions system.
 *
 * Call this during app initialization. The handler should be scheduled
 * as a daily recurring action:
 *
 * @example
 * ```typescript
 * // During app init:
 * registerRefreshMPTokensHandler()
 *
 * // Schedule the recurring action (once):
 * await scheduleAction('marketplace:refresh-mp-tokens', {}, {
 *   recurringInterval: 'daily',
 *   recurrenceType: 'fixed',
 *   maxRetries: 3,
 * })
 * ```
 */
export function registerRefreshMPTokensHandler(): void {
  registerScheduledAction(
    'marketplace:refresh-mp-tokens',
    async (_payload: unknown, _action: ScheduledAction): Promise<void> => {
      const result = await refreshMPTokensHandler()

      // If all accounts failed, throw to trigger the retry mechanism
      if (result.failed > 0 && result.refreshed === 0) {
        throw new Error(
          `All ${result.failed} token refresh(es) failed. Errors: ${result.errors.join('; ')}`
        )
      }

      // Partial failures are logged but don't trigger a full retry,
      // since successfully refreshed tokens shouldn't be re-processed
      if (result.failed > 0) {
        console.warn(
          `[ScheduledAction:marketplace:refresh-mp-tokens] Partial failure: ` +
          `${result.failed} of ${result.refreshed + result.failed} failed. ` +
          `Errors: ${result.errors.join('; ')}`
        )
      }
    },
    {
      description: 'Refresh MercadoPago OAuth tokens expiring within 30 days',
      timeout: 120000, // 2 minutes: may process many accounts
    }
  )

  console.log('[ScheduledActions] Registered handler: marketplace:refresh-mp-tokens')
}

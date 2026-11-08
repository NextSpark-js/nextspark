/**
 * The plugin's scheduled actions. A project calls these from its own scheduled-actions registration (docs/): core runs
 * only the project's registration.
 */

import { registerScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions/registry'
import { scheduleRecurringAction } from '@nextsparkjs/core/lib/scheduled-actions/scheduler'
import { REFRESH_TOKENS_ACTION, REFRESH_TOKENS_TIMEOUT_MS } from './mercadopago/refresh'
import { runRefreshTokensAction, runRotateTokenKeysAction } from './scheduled-action-handlers'
import { ROTATE_TOKEN_KEYS_ACTION } from './token-crypto'

export function registerMarketplacePaymentsActions(): void {
  registerScheduledAction(REFRESH_TOKENS_ACTION, runRefreshTokensAction, {
    description: 'Renew MercadoPago seller tokens before they expire',
    timeout: REFRESH_TOKENS_TIMEOUT_MS,
  })
  registerScheduledAction(ROTATE_TOKEN_KEYS_ACTION, runRotateTokenKeysAction, {
    description: 'Re-encrypt seller tokens that are on an older key',
  })
}

export async function scheduleMarketplacePaymentsActions(): Promise<void> {
  await scheduleRecurringAction(REFRESH_TOKENS_ACTION, {}, 'hourly')
  await scheduleRecurringAction(ROTATE_TOKEN_KEYS_ACTION, {}, 'daily')
}

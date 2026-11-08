/**
 * The plugin's scheduled actions. A project calls these from its own scheduled-actions registration (docs/): core runs
 * only the project's registration.
 */

import { registerScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions/registry'
import { scheduleRecurringAction } from '@nextsparkjs/core/lib/scheduled-actions/scheduler'
import { isMercadoPagoConfigured, tokenKeyring } from './env'
import { REFRESH_TOKENS_ACTION, refreshExpiringMercadoPagoTokens } from './mercadopago/refresh'
import { mercadoPagoGateway } from './runtime'
import { keyRotationStore, tokenRefreshStore } from './store'
import { ROTATE_TOKEN_KEYS_ACTION, rotateSellerTokenKeys } from './token-crypto'

export function registerMarketplacePaymentsActions(): void {
  registerScheduledAction(
    REFRESH_TOKENS_ACTION,
    async () => {
      if (!isMercadoPagoConfigured()) return
      const summary = await refreshExpiringMercadoPagoTokens(tokenRefreshStore, mercadoPagoGateway())
      if (summary.failed > 0) throw new Error(`${summary.failed} seller token(s) could not be refreshed`)
    },
    { description: 'Renew MercadoPago seller tokens before they expire' }
  )
  registerScheduledAction(
    ROTATE_TOKEN_KEYS_ACTION,
    async () => {
      if (!isMercadoPagoConfigured()) return
      const summary = await rotateSellerTokenKeys(keyRotationStore, tokenKeyring())
      if (summary.failed > 0) throw new Error(`${summary.failed} seller credential(s) could not be re-encrypted`)
    },
    { description: 'Re-encrypt seller tokens that are on an older key' }
  )
}

export async function scheduleMarketplacePaymentsActions(): Promise<void> {
  await scheduleRecurringAction(REFRESH_TOKENS_ACTION, {}, 'hourly')
  await scheduleRecurringAction(ROTATE_TOKEN_KEYS_ACTION, {}, 'daily')
}

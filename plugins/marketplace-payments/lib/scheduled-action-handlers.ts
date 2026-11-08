/**
 * What the scheduled actions run. A seller that fails is logged by the run and does not fail the action: the action
 * stays scheduled, and the next run tries that seller again.
 */

import { isMercadoPagoConfigured, tokenKeyring } from './env'
import { refreshExpiringMercadoPagoTokens } from './mercadopago/refresh'
import { mercadoPagoGateway } from './runtime'
import { keyRotationStore, tokenRefreshStore } from './store'
import { rotateSellerTokenKeys } from './token-crypto'

export async function runRefreshTokensAction(): Promise<void> {
  if (!isMercadoPagoConfigured()) return
  await refreshExpiringMercadoPagoTokens(tokenRefreshStore, mercadoPagoGateway())
}

export async function runRotateTokenKeysAction(): Promise<void> {
  if (!isMercadoPagoConfigured()) return
  await rotateSellerTokenKeys(keyRotationStore, tokenKeyring())
}

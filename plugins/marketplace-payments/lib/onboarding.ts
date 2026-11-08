/**
 * Connecting a seller. The MercadoPago OAuth state is random, single-use, stored as a hash and bound to the user and
 * team that started the flow: a callback only completes for that same signed-in user.
 */

import { API_BASE_PATH, SETTINGS_PATH, appLink } from './runtime'
import { consumeOAuthState, createOAuthState, findAccount, saveMercadoPagoSeller, upsertAccount } from './store'
import type { MarketplaceGateway, MarketplaceProvider } from './gateway'
import type { MercadoPagoTokens } from './mercadopago/gateway'

export async function startSellerOnboarding(
  input: { provider: MarketplaceProvider; teamId: string; userId: string; email?: string; country?: string },
  gateway: MarketplaceGateway
): Promise<{ redirectUrl: string }> {
  const settings = appLink(`${SETTINGS_PATH}?provider=${input.provider}`)

  if (input.provider === 'mercadopago') {
    return gateway.startOnboarding({ teamId: input.teamId, returnUrl: appLink(`${API_BASE_PATH}/oauth/mercadopago/callback`), state: await createOAuthState(input.userId, input.teamId) })
  }

  const existing = await findAccount(input.teamId, 'stripe')
  const result = await gateway.startOnboarding({
    teamId: input.teamId,
    email: input.email,
    country: input.country,
    returnUrl: settings,
    refreshUrl: settings,
    providerAccountId: existing?.providerAccountId,
  })
  // A disconnected seller that onboards again is live once the provider's account.updated confirms it.
  if (result.providerAccountId || existing?.status === 'disconnected') {
    await upsertAccount({ teamId: input.teamId, provider: 'stripe', providerAccountId: result.providerAccountId ?? existing!.providerAccountId, status: 'pending', chargesEnabled: false, payoutsEnabled: false, country: input.country })
  }
  return { redirectUrl: result.redirectUrl }
}

export type OAuthCallbackResult = 'connected' | 'invalid_state' | 'forbidden'

export async function completeMercadoPagoOAuth(
  input: { state: string; code: string; userId: string; canManageTeam: (teamId: string) => Promise<boolean> },
  exchangeCode: (code: string) => Promise<MercadoPagoTokens>
): Promise<OAuthCallbackResult> {
  const teamId = await consumeOAuthState(input.state, input.userId)
  if (!teamId) return 'invalid_state'
  // the user may have lost the role between the start of the flow and now
  if (!(await input.canManageTeam(teamId))) return 'forbidden'
  await saveMercadoPagoSeller(teamId, await exchangeCode(input.code))
  return 'connected'
}

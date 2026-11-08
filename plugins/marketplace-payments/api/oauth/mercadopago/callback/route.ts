/**
 * MercadoPago's OAuth callback. It needs the signed-in user who started the flow, and redirects with a code: a
 * provider's error text never reaches the page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { canManageTeamBilling } from '../../../../lib/api-auth'
import { completeMercadoPagoOAuth } from '../../../../lib/onboarding'
import { SETTINGS_PATH, appLink, mercadoPagoGateway } from '../../../../lib/runtime'
import { SellerAlreadyConnectedError } from '../../../../lib/store'

const back = (result: string) => NextResponse.redirect(appLink(`${SETTINGS_PATH}?provider=mercadopago&result=${result}`))

export const GET = withRateLimitTier(async (request: NextRequest) => {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  if (!code || !state) return back('invalid_state')

  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user || auth.type !== 'session') return back('invalid_state')
  const userId = auth.user.id

  try {
    const result = await completeMercadoPagoOAuth(
      { state, code, userId, canManageTeam: teamId => canManageTeamBilling(userId, teamId) },
      exchange => mercadoPagoGateway().exchangeCode(exchange)
    )
    return back(result)
  } catch (error) {
    if (error instanceof SellerAlreadyConnectedError) return back('already_connected')
    console.error(`[marketplace-payments] OAuth callback failed (${error instanceof Error ? error.name : 'Error'})`)
    return back('error')
  }
}, 'api')

export const OPTIONS = corsPreflight

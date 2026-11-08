/**
 * Starts connecting the active team as a seller and returns the provider's URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { requireTeamManager } from '../../lib/api-auth'
import { MarketplaceNotConfiguredError } from '../../lib/env'
import { startSellerOnboarding } from '../../lib/onboarding'
import { ProviderApiError } from '../../lib/provider-error'
import { gatewayFor } from '../../lib/runtime'
import { SellerAlreadyConnectedError } from '../../lib/store'

const bodySchema = z.object({
  provider: z.enum(['stripe', 'mercadopago']),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  const manager = await requireTeamManager(request)
  if (manager instanceof NextResponse) return manager

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })

  try {
    const { redirectUrl } = await startSellerOnboarding({ ...parsed.data, teamId: manager.teamId, userId: manager.userId, email: manager.email }, gatewayFor(parsed.data.provider))
    return NextResponse.json({ success: true, data: { redirectUrl } })
  } catch (error) {
    if (error instanceof MarketplaceNotConfiguredError) return NextResponse.json({ success: false, error: 'Provider not configured', code: 'NOT_CONFIGURED' }, { status: 501 })
    if (error instanceof SellerAlreadyConnectedError) return NextResponse.json({ success: false, error: error.message, code: 'ALREADY_CONNECTED' }, { status: 409 })
    if (error instanceof ProviderApiError) {
      console.error(`[marketplace-payments] Onboarding failed (${error.message})`)
      return NextResponse.json({ success: false, error: 'The provider rejected the request', code: 'PROVIDER_ERROR' }, { status: 502 })
    }
    throw error
  }
}, 'write')

export const OPTIONS = corsPreflight

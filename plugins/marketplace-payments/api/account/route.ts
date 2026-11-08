/**
 * The active team's seller accounts, and disconnecting one.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { requireTeamManager } from '../../lib/api-auth'
import { isMercadoPagoConfigured, isStripeConfigured } from '../../lib/env'
import { disconnectTeamSeller, listTeamAccounts } from '../../lib/store'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  const manager = await requireTeamManager(request)
  if (manager instanceof NextResponse) return manager
  return NextResponse.json({
    success: true,
    data: {
      accounts: await listTeamAccounts(manager.teamId, manager.userId),
      providers: { stripe: isStripeConfigured(), mercadopago: isMercadoPagoConfigured() },
    },
  })
}, 'read')

const disconnectSchema = z.object({ provider: z.enum(['stripe', 'mercadopago']) })

export const DELETE = withRateLimitTier(async (request: NextRequest) => {
  const manager = await requireTeamManager(request)
  if (manager instanceof NextResponse) return manager
  const parsed = disconnectSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  await disconnectTeamSeller(manager.teamId, parsed.data.provider)
  return NextResponse.json({ success: true })
}, 'write')

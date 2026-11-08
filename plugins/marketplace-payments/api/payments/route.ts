/**
 * The active team's payment history, read through RLS.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { requireTeamManager } from '../../lib/api-auth'
import { listTeamPayments } from '../../lib/store'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'disputed']).optional(),
})

export const GET = withRateLimitTier(async (request: NextRequest) => {
  const manager = await requireTeamManager(request)
  if (manager instanceof NextResponse) return manager
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  const { page, limit, status } = parsed.data
  const { payments, total } = await listTeamPayments(manager.teamId, manager.userId, { limit, offset: (page - 1) * limit, status })
  return NextResponse.json({ success: true, data: { payments, pagination: { page, limit, total } } })
}, 'read')

export const OPTIONS = corsPreflight

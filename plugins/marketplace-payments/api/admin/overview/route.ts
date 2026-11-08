/**
 * The superadmin overview. Session only, superadmin or developer; no column of it is a token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session'
import { marketplaceOverview } from '../../../lib/store'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  const session = await getAuthorizationSession(request.headers)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'superadmin' && session.user.role !== 'developer') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = 50
  return NextResponse.json({ success: true, data: await marketplaceOverview({ limit, offset: (page - 1) * limit }) })
}, 'read')

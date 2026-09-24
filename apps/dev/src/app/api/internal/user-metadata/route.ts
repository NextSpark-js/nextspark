import { NextRequest, NextResponse } from 'next/server'
import { MetaService } from '@nextsparkjs/core/lib/services/meta.service'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'

// Endpoint interno para crear metadata default después del signup
export const POST = withRateLimitTier(async (req: NextRequest) => {
  try {
    // The API-key scope is declared at the entry point, which fails closed
    // for keys that lack it (#93).
    const authResult = await authenticateRequest(req, { requiredScope: 'users:write' })
    if (!authResult.success || !authResult.user) {
      return createAuthFailureResponse(authResult)
    }

    const body = await req.json()
    const { userId, metadata } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (userId !== authResult.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!metadata || typeof metadata !== 'object') {
      return NextResponse.json({ error: 'Metadata is required' }, { status: 400 })
    }

    // Defaults only fill in what is missing. The caller picks them from a read
    // of the user's meta that may be stale by now, so a preference saved in
    // between (a theme change, a collapsed sidebar) is kept.
    await MetaService.mergeEntityMetaGroups('user', userId, metadata, userId, { defaults: true })

    return NextResponse.json({
      success: true,
      message: 'Default metadata created successfully'
    })
  } catch (error) {
    // Log error for debugging but don't expose details to client
    console.error('Error creating user metadata:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}, 'write');

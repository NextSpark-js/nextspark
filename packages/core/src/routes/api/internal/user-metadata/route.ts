import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { MetaService } from '@nextsparkjs/core/lib/services/meta.service'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
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

    const parsedBody = await readJsonObject(req)
    if (parsedBody.error) return parsedBody.error
    const body = parsedBody.data
    const { userId, metadata } = body

    if (!userId) {
      return createApiError('User ID is required', 400, undefined, 'VALIDATION_ERROR')
    }

    if (userId !== authResult.user.id) {
      return createApiError('Forbidden', 403, undefined, 'FORBIDDEN')
    }

    if (!metadata || typeof metadata !== 'object') {
      return createApiError('Metadata is required', 400, undefined, 'VALIDATION_ERROR')
    }

    // Defaults only fill in what is missing. The caller picks them from a read
    // of the user's meta that may be stale by now, so a preference saved in
    // between (a theme change, a collapsed sidebar) is kept.
    await MetaService.mergeEntityMetaGroups('user', userId, metadata as Record<string, unknown>, userId, { defaults: true })

    return NextResponse.json({
      success: true,
      message: 'Default metadata created successfully'
    })
  } catch (error) {
    // Log error for debugging but don't expose details to client
    console.error('Error creating user metadata:', error)
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

export const OPTIONS = corsPreflight

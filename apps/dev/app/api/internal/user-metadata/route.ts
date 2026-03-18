import { NextRequest, NextResponse } from 'next/server'
import { MetaService } from '@nextsparkjs/core/lib/services/meta.service'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'

// Endpoint interno para crear metadata default después del signup
export const POST = withRateLimitTier(async (req: NextRequest) => {
  try {
    const authResult = await authenticateRequest(req)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
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

    // Crear cada grupo de metadata por separado
    for (const [metaKey, metaValue] of Object.entries(metadata)) {
      if (metaValue && typeof metaValue === 'object') {
        await MetaService.setEntityMeta('user', userId, metaKey, metaValue, userId)
      }
    }

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

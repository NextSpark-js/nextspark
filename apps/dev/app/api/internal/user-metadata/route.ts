import { NextRequest, NextResponse } from 'next/server'
import { MetaService } from '@nextsparkjs/core/lib/services/meta.service'

// Endpoint interno para crear metadata default después del signup
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, metadata } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
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
}

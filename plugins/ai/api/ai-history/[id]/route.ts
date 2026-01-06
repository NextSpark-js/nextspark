/**
 * AI History Entity Linking Endpoint
 *
 * PATCH /api/v1/plugin/ai/ai-history/:id
 *
 * Updates the relatedEntityType and relatedEntityId for an AI history record.
 * Used to link AI operations (e.g., analyze-brief) to entities created afterward (e.g., clients).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nextsparkjs/core/lib/auth'
import { AIHistoryService } from '@/plugins/ai/lib/ai-history-service'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/v1/plugin/ai/ai-history/:id
 * Update related entity information for an AI history record
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Await params (Next.js 15 pattern for dynamic routes)
    const { id: historyId } = await params

    if (!historyId) {
      return NextResponse.json(
        { error: 'Missing history ID' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { relatedEntityType, relatedEntityId } = body

    if (!relatedEntityType || !relatedEntityId) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'Both relatedEntityType and relatedEntityId are required'
        },
        { status: 400 }
      )
    }

    // Verify the AI history record exists and belongs to this user
    const existingRecord = await AIHistoryService.getOperation(historyId)

    if (!existingRecord) {
      return NextResponse.json(
        { error: 'AI history record not found' },
        { status: 404 }
      )
    }

    if (existingRecord.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden - this record belongs to another user' },
        { status: 403 }
      )
    }

    // Update the related entity information
    await AIHistoryService.updateRelatedEntity(
      historyId,
      relatedEntityType,
      relatedEntityId
    )

    return NextResponse.json({
      success: true,
      message: 'AI history record linked to entity successfully',
      data: {
        historyId,
        relatedEntityType,
        relatedEntityId
      }
    })

  } catch (error) {
    console.error('Error updating AI history related entity:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to update AI history record'

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

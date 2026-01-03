import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { dbMemoryStore, CONVERSATION_LIMITS } from '../../lib/db-memory-store'
import { config } from '../../plugin.config'
import type {
    CreateConversationRequest,
    UpdateConversationRequest,
    ConversationInfo,
} from '../../types/langchain.types'

/**
 * Convert Date to ISO string for API responses
 */
function toApiConversationInfo(conv: {
    sessionId: string
    name: string | null
    messageCount: number
    firstMessage: string | null
    isPinned: boolean
    createdAt: Date
    updatedAt: Date
}): ConversationInfo {
    return {
        ...conv,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
    }
}

/**
 * GET - List all conversations or get single conversation
 *
 * Query params:
 * - id: Session ID to get specific conversation
 *
 * Without id: returns list of all conversations
 * With id: returns single conversation details
 */
export async function GET(req: NextRequest) {
    // 1. Auth
    const authResult = await authenticateRequest(req)
    if (!authResult.success || !authResult.user) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        )
    }

    const userId = authResult.user.id

    // 2. Team context
    const teamId = req.headers.get('x-team-id')
    if (!teamId) {
        return NextResponse.json(
            { success: false, error: 'Team context required', code: 'TEAM_CONTEXT_REQUIRED' },
            { status: 400 }
        )
    }

    const context = { userId, teamId }

    try {
        // Check if requesting specific session
        const { searchParams } = new URL(req.url)
        const sessionId = searchParams.get('id')

        if (sessionId) {
            // Get single conversation
            const session = await dbMemoryStore.getSession(sessionId, context)

            if (!session) {
                return NextResponse.json(
                    { success: false, error: 'Conversation not found' },
                    { status: 404 }
                )
            }

            return NextResponse.json({
                success: true,
                data: toApiConversationInfo(session),
            })
        }

        // List all conversations
        const sessions = await dbMemoryStore.listSessions(context)

        return NextResponse.json({
            success: true,
            data: {
                sessions: sessions.map(toApiConversationInfo),
                count: sessions.length,
                maxAllowed: CONVERSATION_LIMITS.MAX_CONVERSATIONS,
            },
        })
    } catch (error) {
        if (config.debug) {
            console.error('[LangChain Plugin] List sessions error:', error)
        }
        return NextResponse.json(
            { success: false, error: 'Failed to list conversations' },
            { status: 500 }
        )
    }
}

/**
 * POST - Create a new conversation
 *
 * Body:
 * - name: Optional name for the conversation
 */
export async function POST(req: NextRequest) {
    // 1. Auth
    const authResult = await authenticateRequest(req)
    if (!authResult.success || !authResult.user) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        )
    }

    const userId = authResult.user.id

    // 2. Team context
    const teamId = req.headers.get('x-team-id')
    if (!teamId) {
        return NextResponse.json(
            { success: false, error: 'Team context required', code: 'TEAM_CONTEXT_REQUIRED' },
            { status: 400 }
        )
    }

    const context = { userId, teamId }

    try {
        // 3. Check conversation limit
        const currentCount = await dbMemoryStore.countSessions(context)

        if (currentCount >= CONVERSATION_LIMITS.MAX_CONVERSATIONS) {
            const oldestSession = await dbMemoryStore.getOldestSession(context)

            return NextResponse.json({
                success: false,
                error: 'CONVERSATION_LIMIT_REACHED',
                message: `Maximum of ${CONVERSATION_LIMITS.MAX_CONVERSATIONS} conversations reached. Delete an existing conversation to create a new one.`,
                data: {
                    currentCount,
                    maxAllowed: CONVERSATION_LIMITS.MAX_CONVERSATIONS,
                    oldestSession: oldestSession
                        ? {
                              sessionId: oldestSession.sessionId,
                              name: oldestSession.name,
                              updatedAt: oldestSession.updatedAt.toISOString(),
                          }
                        : null,
                },
            }, { status: 400 })
        }

        // 4. Parse body
        const body: CreateConversationRequest = await req.json().catch(() => ({}))
        const { name } = body

        // 5. Create session
        const result = await dbMemoryStore.createSession(context, name)

        return NextResponse.json({
            success: true,
            data: {
                sessionId: result.sessionId,
                name: name || null,
                createdAt: result.createdAt.toISOString(),
            },
        }, { status: 201 })
    } catch (error) {
        if (config.debug) {
            console.error('[LangChain Plugin] Create session error:', error)
        }
        return NextResponse.json(
            { success: false, error: 'Failed to create conversation' },
            { status: 500 }
        )
    }
}

/**
 * PATCH - Update a conversation (rename, pin/unpin)
 *
 * Body:
 * - sessionId: Session ID to update (required)
 * - name: New name (optional)
 * - isPinned: New pin status (optional)
 */
export async function PATCH(req: NextRequest) {
    // 1. Auth
    const authResult = await authenticateRequest(req)
    if (!authResult.success || !authResult.user) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        )
    }

    const userId = authResult.user.id

    // 2. Team context
    const teamId = req.headers.get('x-team-id')
    if (!teamId) {
        return NextResponse.json(
            { success: false, error: 'Team context required', code: 'TEAM_CONTEXT_REQUIRED' },
            { status: 400 }
        )
    }

    const context = { userId, teamId }

    try {
        // 3. Parse body
        const body: UpdateConversationRequest = await req.json()
        const { sessionId, name, isPinned } = body

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: 'Session ID is required' },
                { status: 400 }
            )
        }

        // 4. Check if session exists
        const existingSession = await dbMemoryStore.getSession(sessionId, context)
        if (!existingSession) {
            return NextResponse.json(
                { success: false, error: 'Conversation not found' },
                { status: 404 }
            )
        }

        // 5. Update fields
        if (name !== undefined) {
            await dbMemoryStore.renameSession(sessionId, name, context)
        }

        if (isPinned !== undefined) {
            await dbMemoryStore.togglePinSession(sessionId, isPinned, context)
        }

        // 6. Get updated session
        const updatedSession = await dbMemoryStore.getSession(sessionId, context)

        return NextResponse.json({
            success: true,
            data: updatedSession ? toApiConversationInfo(updatedSession) : null,
        })
    } catch (error) {
        if (config.debug) {
            console.error('[LangChain Plugin] Update session error:', error)
        }
        return NextResponse.json(
            { success: false, error: 'Failed to update conversation' },
            { status: 500 }
        )
    }
}

/**
 * DELETE - Delete a conversation
 *
 * Body:
 * - sessionId: Session ID to delete (required)
 */
export async function DELETE(req: NextRequest) {
    // 1. Auth
    const authResult = await authenticateRequest(req)
    if (!authResult.success || !authResult.user) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        )
    }

    const userId = authResult.user.id

    // 2. Team context
    const teamId = req.headers.get('x-team-id')
    if (!teamId) {
        return NextResponse.json(
            { success: false, error: 'Team context required', code: 'TEAM_CONTEXT_REQUIRED' },
            { status: 400 }
        )
    }

    const context = { userId, teamId }

    try {
        // 3. Parse body
        const body: { sessionId?: string } = await req.json()
        const { sessionId } = body

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: 'Session ID is required' },
                { status: 400 }
            )
        }

        // 4. Check if session exists
        const existingSession = await dbMemoryStore.getSession(sessionId, context)
        if (!existingSession) {
            return NextResponse.json(
                { success: false, error: 'Conversation not found' },
                { status: 404 }
            )
        }

        // 5. Delete session
        await dbMemoryStore.clearSession(sessionId, context)

        return NextResponse.json({
            success: true,
            message: 'Conversation deleted successfully',
            sessionId,
        })
    } catch (error) {
        if (config.debug) {
            console.error('[LangChain Plugin] Delete session error:', error)
        }
        return NextResponse.json(
            { success: false, error: 'Failed to delete conversation' },
            { status: 500 }
        )
    }
}

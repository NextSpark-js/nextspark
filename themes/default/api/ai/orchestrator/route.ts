import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { processMessage } from '@/themes/default/lib/langchain/orchestrator'
import { dbMemoryStore } from '@/plugins/langchain/lib/db-memory-store'
import type { ChatMessage } from '@/plugins/langchain/types/langchain.types'

// Schema for request validation
const ChatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().optional(),
})

// Helper to convert messages to API format
// Filters out internal messages (tool results, system messages, empty AI messages)
function convertToApiMessages(
    messages: Awaited<ReturnType<typeof dbMemoryStore.getMessages>>
): ChatMessage[] {
    return messages
        .filter((msg) => {
            const type = msg._getType()

            // Skip tool messages - these are internal tool results (e.g., API responses)
            if (type === 'tool') return false

            // Skip system messages - these are internal prompts
            if (type === 'system') return false

            // Skip AI messages with empty content (these are tool_call-only messages)
            if (type === 'ai') {
                const content = msg.content
                if (!content || (typeof content === 'string' && content.trim() === '')) {
                    return false
                }
            }

            return true
        })
        .map((msg, index) => ({
            id: `msg-${index}`,
            role: msg._getType() === 'human' ? 'user' : 'assistant',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            timestamp: Date.now() - (messages.length - index) * 1000,
        }))
}

/**
 * AI Chat Endpoint for Default Theme
 *
 * Uses the Multi-Agent Orchestrator pattern:
 * - Orchestrator analyzes user intent and routes to specialized agents
 * - Sub-agents: task-assistant, customer-assistant, page-assistant
 * - Handles ambiguous requests by asking for clarification
 */
const postHandler = async (req: NextRequest) => {
    try {
        // 1. Dual authentication (API key or session)
        const authResult = await authenticateRequest(req)
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // 2. Team context required for team-scoped operations
        const teamId = req.headers.get('x-team-id')
        if (!teamId) {
            return NextResponse.json(
                { success: false, error: 'Team context required', code: 'TEAM_CONTEXT_REQUIRED' },
                { status: 400 }
            )
        }

        const userId = authResult.user.id
        const userName = authResult.user.name || 'system'

        // 3. Parse and Validate Request
        const body = await req.json()
        const result = ChatRequestSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid request', details: result.error.issues },
                { status: 400 }
            )
        }

        const { message, sessionId: requestedSessionId } = result.data

        // Generate a session ID if not provided
        const sessionId = requestedSessionId || crypto.randomUUID()

        // 4. Process through orchestrator (routes to appropriate sub-agent)
        // Uses graph-based orchestrator if LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true
        const response = await processMessage(message, {
            userId,
            teamId,
            sessionId,
            userName,
        })

        // 5. Return Response
        return NextResponse.json({
            success: true,
            data: {
                message: response.content,
                sessionId: response.sessionId,
                agentUsed: response.agentUsed,
            },
        })
    } catch (error) {
        console.error('AI Chat Error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export const POST = withRateLimitTier(postHandler, 'write')

/**
 * GET - Retrieve conversation history
 */
const getHandler = async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    // Return API documentation if no sessionId
    if (!sessionId) {
        return NextResponse.json({
            endpoint: '/api/v1/theme/default/ai/orchestrator',
            description: 'Multi-agent orchestrator - routes to specialized sub-agents',
            methods: {
                POST: {
                    description: 'Send message to AI assistant',
                    body: { message: 'string', sessionId: 'string (optional)' },
                },
                GET: {
                    description: 'Get conversation history',
                    query: { sessionId: 'string (required)' },
                },
                DELETE: {
                    description: 'Clear conversation',
                    body: { sessionId: 'string (required)' },
                },
            },
        })
    }

    // Auth
    const authResult = await authenticateRequest(req)
    if (!authResult.success || !authResult.user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = req.headers.get('x-team-id')
    if (!teamId) {
        return NextResponse.json(
            { success: false, error: 'Team context required' },
            { status: 400 }
        )
    }

    const context = { userId: authResult.user.id, teamId }

    try {
        const session = await dbMemoryStore.getSession(sessionId, context)
        if (!session) {
            return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
        }

        const messages = await dbMemoryStore.getMessages(sessionId, context)

        return NextResponse.json({
            success: true,
            data: {
                sessionId,
                name: session.name,
                messageCount: session.messageCount,
                isPinned: session.isPinned,
                messages: convertToApiMessages(messages),
            },
        })
    } catch (error) {
        console.error('[AI Chat] Get history error:', error)
        return NextResponse.json({ success: false, error: 'Failed to get history' }, { status: 500 })
    }
}

export const GET = withRateLimitTier(getHandler, 'read')

/**
 * DELETE - Clear conversation
 */
const deleteHandler = async (req: NextRequest) => {
    const authResult = await authenticateRequest(req)
    if (!authResult.success || !authResult.user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = req.headers.get('x-team-id')
    if (!teamId) {
        return NextResponse.json(
            { success: false, error: 'Team context required' },
            { status: 400 }
        )
    }

    try {
        const body = await req.json().catch(() => ({}))
        const sessionId = body.sessionId

        if (!sessionId) {
            return NextResponse.json({ success: false, error: 'sessionId required' }, { status: 400 })
        }

        await dbMemoryStore.clearSession(sessionId, { userId: authResult.user.id, teamId })

        return NextResponse.json({
            success: true,
            message: 'Conversation cleared',
            sessionId,
        })
    } catch (error) {
        console.error('[AI Chat] Clear error:', error)
        return NextResponse.json({ success: false, error: 'Failed to clear' }, { status: 500 })
    }
}

export const DELETE = withRateLimitTier(deleteHandler, 'write')

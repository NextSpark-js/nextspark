/**
 * ============================================================================
 * SINGLE AGENT CHAT ENDPOINT
 * ============================================================================
 *
 * A unified agent with access to ALL entity tools (tasks, customers, pages).
 * Use this for simpler interactions where routing overhead is unnecessary.
 *
 * Configuration is centralized in: config/langchain.config.ts
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createAgent } from '@/plugins/langchain/lib/agent-factory'
import {
    dbMemoryStore,
    CONVERSATION_LIMITS,
    generateSessionId,
} from '@/plugins/langchain/lib/db-memory-store'
import {
    getAgentConfig,
    getAgentModelConfig,
    getAgentTools,
    getAgentPromptName,
} from '@/themes/default/lib/langchain/langchain.config'
import { loadSystemPrompt } from '@/themes/default/lib/langchain/agents'
import type { ChatMessage } from '@/plugins/langchain/types/langchain.types'

// Agent name - matches key in AGENTS config
const AGENT_NAME = 'single-agent'

// Request validation
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
 * POST - Send message to single agent
 */
export async function POST(req: NextRequest) {
    try {
        // 1. Authentication
        const authResult = await authenticateRequest(req)
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // 2. Team context
        const teamId = req.headers.get('x-team-id')
        if (!teamId) {
            return NextResponse.json(
                { success: false, error: 'Team context required', code: 'TEAM_CONTEXT_REQUIRED' },
                { status: 400 }
            )
        }

        const userId = authResult.user.id
        const userName = authResult.user.name || 'system'
        const context = { userId, teamId, userName }

        // 3. Validate request
        const body = await req.json()
        const validation = ChatRequestSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid request', details: validation.error.issues },
                { status: 400 }
            )
        }

        const { message, sessionId: requestedSessionId } = validation.data

        // 4. Session management
        let sessionId: string
        let isNewSession = false

        if (requestedSessionId) {
            sessionId = requestedSessionId
            const existingSession = await dbMemoryStore.getSession(sessionId, context)
            isNewSession = !existingSession
        } else {
            sessionId = generateSessionId(userId)
            isNewSession = true
        }

        // 5. Check conversation limits
        if (isNewSession) {
            const currentCount = await dbMemoryStore.countSessions(context)

            if (currentCount >= CONVERSATION_LIMITS.MAX_CONVERSATIONS) {
                return NextResponse.json({
                    success: false,
                    error: 'CONVERSATION_LIMIT_REACHED',
                    message: `Maximum of ${CONVERSATION_LIMITS.MAX_CONVERSATIONS} conversations reached.`,
                    data: { currentCount, maxAllowed: CONVERSATION_LIMITS.MAX_CONVERSATIONS },
                }, { status: 400 })
            }
        }

        // 6. Get agent configuration from centralized config
        const agentConfig = getAgentConfig(AGENT_NAME)
        if (!agentConfig) {
            throw new Error(`Agent '${AGENT_NAME}' not configured`)
        }

        // 7. Load system prompt from .md file
        const promptName = getAgentPromptName(AGENT_NAME)
        if (!promptName) {
            throw new Error(`No system prompt configured for agent '${AGENT_NAME}'`)
        }
        const systemPrompt = loadSystemPrompt(promptName as any)

        // 8. Create agent with config from langchain.config.ts
        const agent = await createAgent({
            sessionId,
            agentName: AGENT_NAME,
            context,
            systemPrompt,
            tools: getAgentTools(AGENT_NAME, context),
            modelConfig: getAgentModelConfig(AGENT_NAME),
        })

        // 9. Process message
        const response = await agent.chat(message)

        return NextResponse.json({
            success: true,
            data: {
                message: response.content,
                sessionId: response.sessionId,
                isNewSession,
            },
        })
    } catch (error) {
        console.error('[Single Agent] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to process message' },
            { status: 500 }
        )
    }
}

/**
 * GET - Retrieve conversation history
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    // Return API documentation if no sessionId
    if (!sessionId) {
        const agentConfig = getAgentConfig(AGENT_NAME)
        return NextResponse.json({
            endpoint: '/api/v1/theme/default/ai/single-agent',
            description: agentConfig?.description || 'Single agent chat endpoint',
            agent: AGENT_NAME,
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
        console.error('[Single Agent] Get history error:', error)
        return NextResponse.json({ success: false, error: 'Failed to get history' }, { status: 500 })
    }
}

/**
 * DELETE - Clear conversation
 */
export async function DELETE(req: NextRequest) {
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
        console.error('[Single Agent] Clear error:', error)
        return NextResponse.json({ success: false, error: 'Failed to clear' }, { status: 500 })
    }
}

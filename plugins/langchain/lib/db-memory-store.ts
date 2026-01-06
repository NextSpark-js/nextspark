/**
 * Database Memory Store for LangChain
 *
 * Persistent storage for conversation history using PostgreSQL.
 * Supports multi-tenancy with userId + teamId + sessionId isolation.
 * Supports multiple conversations per user with no expiration by default.
 */

import { BaseMessage, HumanMessage } from '@langchain/core/messages'
import { queryWithRLS, mutateWithRLS, query } from '@nextsparkjs/core/lib/db'
import {
    serializeMessages,
    deserializeMessages,
    type SerializedMessage,
} from './message-serializer'
import type { AgentContext, SessionConfig } from '../types/langchain.types'

/**
 * Conversation/Session information returned by list and get operations
 */
export interface ConversationInfo {
    sessionId: string
    name: string | null
    messageCount: number
    firstMessage: string | null
    isPinned: boolean
    createdAt: Date
    updatedAt: Date
}

/**
 * Conversation limits
 */
export const CONVERSATION_LIMITS = {
    MAX_CONVERSATIONS: 50,
    MAX_MESSAGES_PER_CONVERSATION: 50,
} as const

const DEFAULT_MAX_MESSAGES = CONVERSATION_LIMITS.MAX_MESSAGES_PER_CONVERSATION
const DEFAULT_TTL_HOURS: number | null = null // No expiration by default

/**
 * Row type from database
 */
interface SessionRow {
    id: string
    userId: string
    teamId: string
    sessionId: string
    name: string | null
    isPinned: boolean
    messages: SerializedMessage[]
    maxMessages: number
    expiresAt: Date | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Generate a new session ID
 */
export function generateSessionId(userId: string): string {
    return `${userId}-${Date.now()}`
}

/**
 * Extract first human message content from serialized messages
 */
function getFirstHumanMessage(messages: SerializedMessage[]): string | null {
    const humanMessage = messages.find((m) => m.type === 'human')
    if (!humanMessage) return null

    const content = humanMessage.content
    if (typeof content === 'string') {
        return content.slice(0, 100) // Truncate to 100 chars
    }
    return null
}

/**
 * Database-backed memory store with full multi-tenancy support
 */
export const dbMemoryStore = {
    /**
     * Get messages for a session
     */
    getMessages: async (
        sessionId: string,
        context: AgentContext
    ): Promise<BaseMessage[]> => {
        const { userId, teamId } = context

        const result = await queryWithRLS<SessionRow>(
            `SELECT messages
             FROM public."langchain_sessions"
             WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3
             AND ("expiresAt" IS NULL OR "expiresAt" > now())`,
            [userId, teamId, sessionId],
            userId
        )

        if (!result.length) return []

        return deserializeMessages(result[0].messages)
    },

    /**
     * Get full session info (not just messages)
     */
    getSession: async (
        sessionId: string,
        context: AgentContext
    ): Promise<ConversationInfo | null> => {
        const { userId, teamId } = context

        const result = await queryWithRLS<SessionRow>(
            `SELECT "sessionId", name, "isPinned", messages, "createdAt", "updatedAt"
             FROM public."langchain_sessions"
             WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3
             AND ("expiresAt" IS NULL OR "expiresAt" > now())`,
            [userId, teamId, sessionId],
            userId
        )

        if (!result.length) return null

        const row = result[0]
        return {
            sessionId: row.sessionId,
            name: row.name,
            messageCount: row.messages.length,
            firstMessage: getFirstHumanMessage(row.messages),
            isPinned: row.isPinned,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }
    },

    /**
     * Add messages to a session (upsert with sliding window)
     * Auto-generates name from first message if not set
     *
     * OPTIMIZED: Uses a single query with CTE instead of 3 separate queries
     * - Reads existing messages, combines with new, applies sliding window
     * - All done atomically in PostgreSQL
     */
    addMessages: async (
        sessionId: string,
        messages: BaseMessage[],
        context: AgentContext,
        config: SessionConfig = {}
    ): Promise<void> => {
        const { userId, teamId } = context
        const maxMessages = config.maxMessages || DEFAULT_MAX_MESSAGES
        const ttlHours = config.ttlHours === undefined ? DEFAULT_TTL_HOURS : config.ttlHours

        // Serialize new messages
        const newMessagesSerialized = serializeMessages(messages)

        // Auto-generate name from first human message
        let autoName: string | null = null
        if (messages.length > 0) {
            const firstHuman = messages.find((m) => m instanceof HumanMessage)
            if (firstHuman) {
                const content = firstHuman.content
                if (typeof content === 'string') {
                    autoName = content.slice(0, 50) // First 50 chars
                }
            }
        }

        // Calculate expiresAt
        const expiresAt = ttlHours !== null
            ? new Date(Date.now() + ttlHours * 60 * 60 * 1000)
            : null

        // Single atomic query: read existing + combine + sliding window + upsert
        // Uses CTE to:
        // 1. Get existing messages (or empty array)
        // 2. Combine with new messages
        // 3. Apply sliding window (keep last N messages)
        // 4. Upsert the result
        await mutateWithRLS(
            `WITH existing_session AS (
                SELECT messages, name
                FROM public."langchain_sessions"
                WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3
            ),
            combined AS (
                SELECT COALESCE((SELECT messages FROM existing_session), '[]'::jsonb) || $4::jsonb as all_msgs
            ),
            windowed AS (
                SELECT COALESCE(
                    (
                        SELECT jsonb_agg(value ORDER BY ordinality)
                        FROM (
                            SELECT value, ordinality
                            FROM combined, jsonb_array_elements(all_msgs) WITH ORDINALITY
                        ) sub
                        WHERE ordinality > jsonb_array_length((SELECT all_msgs FROM combined)) - $5
                    ),
                    $4::jsonb
                ) as final_msgs
            )
            INSERT INTO public."langchain_sessions"
                (id, "userId", "teamId", "sessionId", messages, "maxMessages", "expiresAt", name)
            SELECT
                gen_random_uuid()::text, $1, $2, $3,
                (SELECT final_msgs FROM windowed),
                $5, $6,
                COALESCE((SELECT name FROM existing_session), $7)
            ON CONFLICT ("userId", "teamId", "sessionId")
            DO UPDATE SET
                messages = EXCLUDED.messages,
                "expiresAt" = COALESCE(public."langchain_sessions"."expiresAt", EXCLUDED."expiresAt"),
                name = COALESCE(public."langchain_sessions".name, EXCLUDED.name),
                "updatedAt" = now()`,
            [userId, teamId, sessionId, JSON.stringify(newMessagesSerialized), maxMessages, expiresAt, autoName],
            userId
        )
    },

    /**
     * Create a new empty session/conversation
     */
    createSession: async (
        context: AgentContext,
        name?: string
    ): Promise<{ sessionId: string; createdAt: Date }> => {
        const { userId, teamId } = context
        const sessionId = generateSessionId(userId)

        const result = await queryWithRLS<{ sessionId: string; createdAt: Date }>(
            `INSERT INTO public."langchain_sessions"
             (id, "userId", "teamId", "sessionId", messages, name)
             VALUES (gen_random_uuid()::text, $1, $2, $3, '[]'::jsonb, $4)
             RETURNING "sessionId", "createdAt"`,
            [userId, teamId, sessionId, name || null],
            userId
        )

        return result[0]
    },

    /**
     * Rename a session
     */
    renameSession: async (
        sessionId: string,
        name: string,
        context: AgentContext
    ): Promise<void> => {
        const { userId, teamId } = context

        await mutateWithRLS(
            `UPDATE public."langchain_sessions"
             SET name = $4, "updatedAt" = now()
             WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3`,
            [userId, teamId, sessionId, name],
            userId
        )
    },

    /**
     * Toggle pin status of a session
     */
    togglePinSession: async (
        sessionId: string,
        isPinned: boolean,
        context: AgentContext
    ): Promise<void> => {
        const { userId, teamId } = context

        await mutateWithRLS(
            `UPDATE public."langchain_sessions"
             SET "isPinned" = $4, "updatedAt" = now()
             WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3`,
            [userId, teamId, sessionId, isPinned],
            userId
        )
    },

    /**
     * Count sessions for a user (for limit enforcement)
     */
    countSessions: async (context: AgentContext): Promise<number> => {
        const { userId, teamId } = context

        const result = await queryWithRLS<{ count: string }>(
            `SELECT COUNT(*)::text as count
             FROM public."langchain_sessions"
             WHERE "userId" = $1 AND "teamId" = $2
             AND ("expiresAt" IS NULL OR "expiresAt" > now())`,
            [userId, teamId],
            userId
        )

        return parseInt(result[0]?.count || '0', 10)
    },

    /**
     * Get oldest session (for suggesting deletion when limit reached)
     */
    getOldestSession: async (
        context: AgentContext
    ): Promise<ConversationInfo | null> => {
        const { userId, teamId } = context

        const result = await queryWithRLS<SessionRow>(
            `SELECT "sessionId", name, "isPinned", messages, "createdAt", "updatedAt"
             FROM public."langchain_sessions"
             WHERE "userId" = $1 AND "teamId" = $2
             AND ("expiresAt" IS NULL OR "expiresAt" > now())
             AND "isPinned" = false
             ORDER BY "updatedAt" ASC
             LIMIT 1`,
            [userId, teamId],
            userId
        )

        if (!result.length) return null

        const row = result[0]
        return {
            sessionId: row.sessionId,
            name: row.name,
            messageCount: row.messages.length,
            firstMessage: getFirstHumanMessage(row.messages),
            isPinned: row.isPinned,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }
    },

    /**
     * Clear/delete a session
     */
    clearSession: async (
        sessionId: string,
        context: AgentContext
    ): Promise<void> => {
        const { userId, teamId } = context

        await mutateWithRLS(
            `DELETE FROM public."langchain_sessions"
             WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3`,
            [userId, teamId, sessionId],
            userId
        )
    },

    /**
     * Clean up expired sessions (run periodically)
     * Only cleans sessions with expiresAt set and expired.
     * Sessions with expiresAt = NULL are never cleaned up.
     */
    cleanup: async (): Promise<number> => {
        const result = await query<{ id: string }>(
            `DELETE FROM public."langchain_sessions"
             WHERE "expiresAt" IS NOT NULL AND "expiresAt" < now()
             RETURNING id`
        )

        return result.rowCount
    },

    /**
     * Get all sessions for a user in a team
     * Returns sessions sorted by: pinned first, then by updatedAt desc
     */
    listSessions: async (
        context: AgentContext
    ): Promise<ConversationInfo[]> => {
        const { userId, teamId } = context

        const result = await queryWithRLS<SessionRow>(
            `SELECT "sessionId", name, "isPinned", messages, "createdAt", "updatedAt"
             FROM public."langchain_sessions"
             WHERE "userId" = $1 AND "teamId" = $2
             AND ("expiresAt" IS NULL OR "expiresAt" > now())
             ORDER BY "isPinned" DESC, "updatedAt" DESC`,
            [userId, teamId],
            userId
        )

        return result.map((row) => ({
            sessionId: row.sessionId,
            name: row.name,
            messageCount: row.messages.length,
            firstMessage: getFirstHumanMessage(row.messages),
            isPinned: row.isPinned,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }))
    },

    /**
     * Extend session TTL (deprecated - sessions now have no expiration by default)
     * @deprecated Use for legacy support only
     */
    extendSession: async (
        sessionId: string,
        context: AgentContext,
        ttlHours: number = 24
    ): Promise<void> => {
        const { userId, teamId } = context
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

        await mutateWithRLS(
            `UPDATE public."langchain_sessions"
             SET "expiresAt" = $4, "updatedAt" = now()
             WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3`,
            [userId, teamId, sessionId, expiresAt],
            userId
        )
    },
}

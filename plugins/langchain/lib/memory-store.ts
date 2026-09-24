/**
 * Memory Store for LangChain
 *
 * This module provides the primary interface for conversation memory.
 * Uses database persistence via dbMemoryStore.
 *
 * For new code, use dbMemoryStore directly with explicit context.
 */

import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import {
    dbMemoryStore,
    CONVERSATION_LIMITS,
    generateSessionId,
    type ConversationInfo,
} from './db-memory-store'
import type { AgentContext, SessionConfig } from '../types/langchain.types'

export {
    dbMemoryStore,
    CONVERSATION_LIMITS,
    generateSessionId,
    type AgentContext,
    type SessionConfig,
    type ConversationInfo,
}

/**
 * Memory store interface with context support
 *
 * All methods are async and require context (userId, teamId) for multi-tenancy.
 */
export const memoryStore = {
    /**
     * Get messages for a session
     */
    getMessages: async (
        sessionId: string,
        context: AgentContext
    ): Promise<BaseMessage[]> => {
        return dbMemoryStore.getMessages(sessionId, context)
    },

    /**
     * Add messages to a session
     */
    addMessages: async (
        sessionId: string,
        messages: BaseMessage[],
        context: AgentContext,
        config?: SessionConfig
    ): Promise<void> => {
        return dbMemoryStore.addMessages(sessionId, messages, context, config)
    },

    /**
     * Clear a session
     */
    clearSession: async (
        sessionId: string,
        context: AgentContext
    ): Promise<void> => {
        return dbMemoryStore.clearSession(sessionId, context)
    },

    /**
     * Clean up expired sessions
     */
    cleanup: async (): Promise<number> => {
        return dbMemoryStore.cleanup()
    },

    /**
     * List all sessions for a user in a team
     */
    listSessions: async (
        context: AgentContext
    ): Promise<ConversationInfo[]> => {
        return dbMemoryStore.listSessions(context)
    },

    /**
     * Get full session info
     */
    getSession: async (
        sessionId: string,
        context: AgentContext
    ): Promise<ConversationInfo | null> => {
        return dbMemoryStore.getSession(sessionId, context)
    },

    /**
     * Create a new session
     */
    createSession: async (
        context: AgentContext,
        name?: string
    ): Promise<{ sessionId: string; createdAt: Date }> => {
        return dbMemoryStore.createSession(context, name)
    },

    /**
     * Rename a session
     */
    renameSession: async (
        sessionId: string,
        name: string,
        context: AgentContext
    ): Promise<void> => {
        return dbMemoryStore.renameSession(sessionId, name, context)
    },

    /**
     * Toggle pin status
     */
    togglePinSession: async (
        sessionId: string,
        isPinned: boolean,
        context: AgentContext
    ): Promise<void> => {
        return dbMemoryStore.togglePinSession(sessionId, isPinned, context)
    },

    /**
     * Count sessions for limit enforcement
     */
    countSessions: async (
        context: AgentContext
    ): Promise<number> => {
        return dbMemoryStore.countSessions(context)
    },

    /**
     * Extend session TTL (deprecated)
     * @deprecated Sessions now have no expiration by default
     */
    extendSession: async (
        sessionId: string,
        context: AgentContext,
        ttlHours?: number
    ): Promise<void> => {
        return dbMemoryStore.extendSession(sessionId, context, ttlHours)
    },

    /**
     * Default configuration values
     */
    defaults: {
        maxMessages: CONVERSATION_LIMITS.MAX_MESSAGES_PER_CONVERSATION,
        maxConversations: CONVERSATION_LIMITS.MAX_CONVERSATIONS,
    },
}

/**
 * Helper function to create a HumanMessage
 * Re-exported for use in theme code without direct @langchain imports
 */
export function createHumanMessage(content: string): HumanMessage {
    return new HumanMessage(content)
}

/**
 * Helper function to create an AIMessage
 * Re-exported for use in theme code without direct @langchain imports
 */
export function createAIMessage(content: string): AIMessage {
    return new AIMessage(content)
}

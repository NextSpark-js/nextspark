'use client'

import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { authClient } from '@nextsparkjs/core/lib/auth-client'

/**
 * Conversation info from the API
 */
export interface ConversationInfo {
    sessionId: string
    name: string | null
    messageCount: number
    firstMessage: string | null
    isPinned: boolean
    createdAt: string
    updatedAt: string
}

interface ListConversationsResponse {
    success: boolean
    data?: {
        sessions: ConversationInfo[]
        count: number
        maxAllowed: number
    }
    error?: string
}

interface CreateConversationResponse {
    success: boolean
    data?: {
        sessionId: string
        name: string | null
        createdAt: string
    }
    error?: string
    message?: string
}

interface UpdateConversationResponse {
    success: boolean
    data?: ConversationInfo
    error?: string
}

interface DeleteConversationResponse {
    success: boolean
    message?: string
    error?: string
}

const ACTIVE_SESSION_KEY = 'active-conversation-session'
const CONVERSATIONS_QUERY_KEY = 'conversations'

/**
 * Conversations Management Hook
 *
 * Manages the list of conversations and CRUD operations.
 * Works with the LangChain plugin sessions endpoint.
 */
export function useConversations() {
    const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const { currentTeam } = useTeamContext()
    const queryClient = useQueryClient()

    // Get current user session
    const { data: session } = useQuery({
        queryKey: ['session'],
        queryFn: async () => {
            const { data } = await authClient.getSession()
            return data
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

    const userId = session?.user?.id
    const teamId = currentTeam?.id

    // Load active session from localStorage
    useEffect(() => {
        if (!userId || isInitialized) return

        try {
            const stored = localStorage.getItem(`${ACTIVE_SESSION_KEY}-${userId}`)
            if (stored) {
                setActiveSessionIdState(stored)
            }
        } catch {
            // Ignore parse errors
        }
        setIsInitialized(true)
    }, [userId, isInitialized])

    // Save active session to localStorage
    const setActiveSession = useCallback((sessionId: string | null) => {
        setActiveSessionIdState(sessionId)
        if (userId) {
            try {
                if (sessionId) {
                    localStorage.setItem(`${ACTIVE_SESSION_KEY}-${userId}`, sessionId)
                } else {
                    localStorage.removeItem(`${ACTIVE_SESSION_KEY}-${userId}`)
                }
            } catch {
                // Ignore storage errors
            }
        }
    }, [userId])

    // Fetch conversations list
    const {
        data: conversationsData,
        isLoading,
        error: queryError,
        refetch,
    } = useQuery({
        queryKey: [CONVERSATIONS_QUERY_KEY, userId, teamId],
        queryFn: async (): Promise<ListConversationsResponse> => {
            if (!teamId) {
                return { success: true, data: { sessions: [], count: 0, maxAllowed: 50 } }
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-team-id': teamId,
            }

            const response = await fetch('/api/v1/plugin/langchain/sessions', {
                method: 'GET',
                headers,
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to fetch conversations')
            }

            return response.json()
        },
        enabled: !!userId && !!teamId && isInitialized,
        staleTime: 1000 * 30, // 30 seconds
    })

    const conversations = conversationsData?.data?.sessions || []
    const conversationCount = conversationsData?.data?.count || 0
    const maxConversations = conversationsData?.data?.maxAllowed || 50

    // Auto-select first conversation if none selected
    useEffect(() => {
        if (!isInitialized) return

        // If we have conversations but no active one, select the first
        if (conversations.length > 0 && !activeSessionId) {
            setActiveSession(conversations[0].sessionId)
        }

        // If the active session was deleted, clear it
        if (activeSessionId && conversations.length > 0) {
            const exists = conversations.some((c) => c.sessionId === activeSessionId)
            if (!exists) {
                setActiveSession(conversations[0].sessionId)
            }
        }

        // If no conversations at all, clear active session
        if (conversations.length === 0 && activeSessionId) {
            setActiveSession(null)
        }
    }, [conversations, activeSessionId, isInitialized, setActiveSession])

    // Create conversation mutation
    const createMutation = useMutation({
        mutationFn: async (name?: string): Promise<CreateConversationResponse> => {
            if (!teamId) {
                throw new Error('No team context')
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-team-id': teamId,
            }

            const response = await fetch('/api/v1/plugin/langchain/sessions', {
                method: 'POST',
                headers,
                body: JSON.stringify({ name }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Failed to create conversation')
            }

            return data
        },
        onSuccess: (data) => {
            if (data.success && data.data) {
                // Set the new conversation as active
                setActiveSession(data.data.sessionId)
                // Refetch conversations list
                queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] })
            }
        },
    })

    // Delete conversation mutation
    const deleteMutation = useMutation({
        mutationFn: async (sessionId: string): Promise<DeleteConversationResponse> => {
            if (!teamId) {
                throw new Error('No team context')
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-team-id': teamId,
            }

            const response = await fetch('/api/v1/plugin/langchain/sessions', {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ sessionId }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to delete conversation')
            }

            return response.json()
        },
        onSuccess: (_, deletedSessionId) => {
            // If we deleted the active session, clear it (useEffect will select a new one)
            if (activeSessionId === deletedSessionId) {
                setActiveSession(null)
            }
            // Refetch conversations list
            queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] })
        },
    })

    // Rename conversation mutation
    const renameMutation = useMutation({
        mutationFn: async ({
            sessionId,
            name,
        }: {
            sessionId: string
            name: string
        }): Promise<UpdateConversationResponse> => {
            if (!teamId) {
                throw new Error('No team context')
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-team-id': teamId,
            }

            const response = await fetch('/api/v1/plugin/langchain/sessions', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ sessionId, name }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to rename conversation')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] })
        },
    })

    // Toggle pin mutation
    const togglePinMutation = useMutation({
        mutationFn: async (sessionId: string): Promise<UpdateConversationResponse> => {
            if (!teamId) {
                throw new Error('No team context')
            }

            // Find current pin state
            const conversation = conversations.find((c) => c.sessionId === sessionId)
            if (!conversation) {
                throw new Error('Conversation not found')
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-team-id': teamId,
            }

            const response = await fetch('/api/v1/plugin/langchain/sessions', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ sessionId, isPinned: !conversation.isPinned }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to toggle pin')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] })
        },
    })

    // Action handlers
    const createConversation = useCallback(
        async (name?: string): Promise<string> => {
            const result = await createMutation.mutateAsync(name)
            return result.data?.sessionId || ''
        },
        [createMutation]
    )

    const deleteConversation = useCallback(
        async (sessionId: string): Promise<void> => {
            await deleteMutation.mutateAsync(sessionId)
        },
        [deleteMutation]
    )

    const renameConversation = useCallback(
        async (sessionId: string, name: string): Promise<void> => {
            await renameMutation.mutateAsync({ sessionId, name })
        },
        [renameMutation]
    )

    const togglePin = useCallback(
        async (sessionId: string): Promise<void> => {
            await togglePinMutation.mutateAsync(sessionId)
        },
        [togglePinMutation]
    )

    return {
        // Data
        conversations,
        activeSessionId,
        isLoading,
        error: queryError?.message || null,

        // Actions
        createConversation,
        deleteConversation,
        renameConversation,
        togglePin,
        setActiveSession,
        refetchConversations: refetch,

        // Computed
        canCreateNew: conversationCount < maxConversations,
        conversationCount,
        maxConversations,

        // Mutation states
        isCreating: createMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isRenaming: renameMutation.isPending,
        isTogglingPin: togglePinMutation.isPending,

        // Ready state
        isReady: isInitialized && !!userId && !!teamId,
    }
}

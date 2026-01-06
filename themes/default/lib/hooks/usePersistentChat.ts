'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { authClient } from '@nextsparkjs/core/lib/auth-client'

export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
}

interface ChatResponse {
    success: boolean
    data?: {
        message: string
        sessionId: string
        isNewSession?: boolean
    }
    error?: string
}

interface HistoryResponse {
    success: boolean
    data?: {
        sessionId: string
        name: string | null
        messageCount: number
        isPinned: boolean
        messages: Message[]
    }
    error?: string
}

interface ClearResponse {
    success: boolean
    message?: string
    error?: string
}

const STORAGE_KEY = 'persistent-chat-messages'
const CONVERSATIONS_QUERY_KEY = 'conversations'

/**
 * Persistent Chat Hook
 *
 * Manages chat messages for a specific conversation session.
 * If sessionId is provided, uses that session.
 * If not provided, creates a new session on first message.
 *
 * Features:
 * - Loads message history from server when switching sessions
 * - Caches messages in localStorage for quick UI
 * - Supports multiple conversations
 */
export function usePersistentChat(externalSessionId?: string | null) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const lastLoadedSessionRef = useRef<string | null>(null)
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

    // Use external session ID if provided
    const sessionId = externalSessionId || undefined

    // Storage key is specific to the session
    const storageKey = sessionId ? `${STORAGE_KEY}-${sessionId}` : null

    // Load messages from localStorage when session changes
    useEffect(() => {
        if (!userId || !sessionId) {
            setMessages([])
            setIsInitialized(true)
            return
        }

        // Already loaded this session
        if (lastLoadedSessionRef.current === sessionId) {
            return
        }

        // Try to load from localStorage first for instant UI
        if (storageKey) {
            try {
                const stored = localStorage.getItem(storageKey)
                if (stored) {
                    const parsed = JSON.parse(stored) as Message[]
                    setMessages(parsed)
                } else {
                    setMessages([])
                }
            } catch {
                setMessages([])
            }
        }

        setIsInitialized(true)
        lastLoadedSessionRef.current = sessionId

        // Then fetch from server to get the authoritative history
        if (teamId) {
            fetchHistory(sessionId)
        }
    }, [userId, sessionId, storageKey, teamId])

    // Fetch message history from server
    const fetchHistory = async (sid: string) => {
        if (!teamId) return

        setIsLoadingHistory(true)
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-team-id': teamId,
            }

            const response = await fetch(
                `/api/v1/theme/default/ai/single-agent?sessionId=${encodeURIComponent(sid)}`,
                { method: 'GET', headers }
            )

            if (response.ok) {
                const data: HistoryResponse = await response.json()
                if (data.success && data.data?.messages) {
                    setMessages(data.data.messages)
                    // Update localStorage
                    if (storageKey) {
                        try {
                            localStorage.setItem(storageKey, JSON.stringify(data.data.messages))
                        } catch {
                            // Ignore
                        }
                    }
                }
            }
        } catch {
            // Ignore fetch errors, we have localStorage data
        } finally {
            setIsLoadingHistory(false)
        }
    }

    // Save messages to localStorage when they change
    useEffect(() => {
        if (!storageKey || !isInitialized) return

        try {
            localStorage.setItem(storageKey, JSON.stringify(messages))
        } catch {
            // Ignore storage errors (quota exceeded, etc.)
        }
    }, [messages, storageKey, isInitialized])

    const sendMutation = useMutation({
        mutationFn: async (message: string): Promise<ChatResponse> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }

            if (teamId) {
                headers['x-team-id'] = teamId
            }

            const response = await fetch('/api/v1/theme/default/ai/single-agent', {
                method: 'POST',
                headers,
                body: JSON.stringify({ message, sessionId }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to send message')
            }

            return response.json()
        },
        onMutate: (message) => {
            setError(null)
            // Optimistic update - add user message immediately
            const userMessage: Message = {
                id: crypto.randomUUID(),
                role: 'user',
                content: message,
                timestamp: Date.now(),
            }
            setMessages((prev) => [...prev, userMessage])
            setInput('')
        },
        onSuccess: (data) => {
            if (data.success && data.data) {
                const aiMessage: Message = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: data.data.message,
                    timestamp: Date.now(),
                }
                setMessages((prev) => [...prev, aiMessage])

                // If a new session was created, invalidate conversations list
                if (data.data.isNewSession) {
                    queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] })
                }
            } else if (data.error) {
                setError(data.error)
            }
        },
        onError: (err: Error) => {
            setError(err.message)
            // Remove the optimistic user message on error
            setMessages((prev) => prev.slice(0, -1))
        },
    })

    const clearMutation = useMutation({
        mutationFn: async (): Promise<ClearResponse> => {
            if (!sessionId) {
                throw new Error('No session to clear')
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }

            if (teamId) {
                headers['x-team-id'] = teamId
            }

            const response = await fetch('/api/v1/theme/default/ai/single-agent', {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ sessionId }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to clear session')
            }

            return response.json()
        },
        onSuccess: () => {
            // Clear local messages
            setMessages([])
            setError(null)
            setInput('')

            // Clear localStorage for this session
            if (storageKey) {
                try {
                    localStorage.removeItem(storageKey)
                } catch {
                    // Ignore
                }
            }

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['chat-history'] })
            queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] })
        },
        onError: (err: Error) => {
            setError(`Failed to clear conversation: ${err.message}`)
        },
    })

    const sendMessage = useCallback(() => {
        if (!input.trim() || sendMutation.isPending) return
        sendMutation.mutate(input)
    }, [input, sendMutation])

    const clearConversation = useCallback(() => {
        if (clearMutation.isPending) return
        clearMutation.mutate()
    }, [clearMutation])

    // Reload history from server
    const reloadHistory = useCallback(() => {
        if (sessionId && teamId) {
            fetchHistory(sessionId)
        }
    }, [sessionId, teamId])

    return {
        messages,
        input,
        setInput,
        error,
        isLoading: sendMutation.isPending,
        isClearing: clearMutation.isPending,
        isLoadingHistory,
        sendMessage,
        clearConversation,
        reloadHistory,
        sessionId,
        isReady: isInitialized && !!userId,
        hasSession: !!sessionId,
    }
}

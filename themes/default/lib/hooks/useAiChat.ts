'use client'

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'

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
    }
    error?: string
}

export function useAiChat() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [sessionId, setSessionId] = useState<string | undefined>(undefined)
    const [error, setError] = useState<string | null>(null)
    const { currentTeam } = useTeamContext()

    const sendMutation = useMutation({
        mutationFn: async (message: string): Promise<ChatResponse> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            // Include team context if available
            if (currentTeam?.id) {
                headers['x-team-id'] = currentTeam.id
            }

            const response = await fetch('/api/v1/theme/default/ai/chat', {
                method: 'POST',
                headers,
                body: JSON.stringify({ message, sessionId })
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
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, userMessage])
            setInput('')
        },
        onSuccess: (data) => {
            if (data.success && data.data) {
                setSessionId(data.data.sessionId)
                const aiMessage: Message = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: data.data.message,
                    timestamp: Date.now()
                }
                setMessages(prev => [...prev, aiMessage])
            } else if (data.error) {
                setError(data.error)
            }
        },
        onError: (err: Error) => {
            setError(err.message)
            // Add error message to chat
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `Error: ${err.message}`,
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, errorMessage])
        }
    })

    const sendMessage = useCallback(() => {
        if (!input.trim() || sendMutation.isPending) return
        sendMutation.mutate(input)
    }, [input, sendMutation])

    const clearChat = useCallback(() => {
        setMessages([])
        setSessionId(undefined)
        setError(null)
        setInput('')
    }, [])

    return {
        messages,
        input,
        setInput,
        error,
        isLoading: sendMutation.isPending,
        sendMessage,
        clearChat
    }
}

'use client'

import { useState, useCallback, useRef } from 'react'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'

interface StreamChunk {
    type: 'token' | 'done' | 'error' | 'tool_start' | 'tool_end'
    content?: string
    fullContent?: string
    agentUsed?: string
    tokenUsage?: {
        inputTokens: number
        outputTokens: number
        totalTokens: number
    }
    error?: string
    toolName?: string
    result?: unknown
}

interface UseStreamingChatOptions {
    agentName: string
    sessionId?: string
    onToken?: (token: string) => void
    onComplete?: (fullContent: string) => void
    onError?: (error: string) => void
}

export function useStreamingChat(options: UseStreamingChatOptions) {
    const { agentName, sessionId, onToken, onComplete, onError } = options
    const { currentTeam } = useTeamContext()

    const [isStreaming, setIsStreaming] = useState(false)
    const [partialContent, setPartialContent] = useState('')
    const [error, setError] = useState<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const streamMessage = useCallback(async (message: string) => {
        setIsStreaming(true)
        setPartialContent('')
        setError(null)

        abortControllerRef.current = new AbortController()

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            // Include team context
            if (currentTeam?.id) {
                headers['x-team-id'] = currentTeam.id
            }

            const response = await fetch('/api/ai/chat/stream', {
                method: 'POST',
                headers,
                body: JSON.stringify({ message, agentName, sessionId }),
                signal: abortControllerRef.current.signal,
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let fullContent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value)
                const lines = text.split('\n')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const chunk: StreamChunk = JSON.parse(data)

                            if (chunk.type === 'token' && chunk.content) {
                                fullContent += chunk.content
                                setPartialContent(fullContent)
                                onToken?.(chunk.content)
                            } else if (chunk.type === 'done' && chunk.fullContent) {
                                onComplete?.(chunk.fullContent)
                            } else if (chunk.type === 'error' && chunk.error) {
                                setError(chunk.error)
                                onError?.(chunk.error)
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                const message = err.message
                setError(message)
                onError?.(message)
            }
        } finally {
            setIsStreaming(false)
            abortControllerRef.current = null
        }
    }, [agentName, sessionId, currentTeam?.id, onToken, onComplete, onError])

    const cancel = useCallback(() => {
        abortControllerRef.current?.abort()
        setIsStreaming(false)
    }, [])

    return {
        streamMessage,
        isStreaming,
        partialContent,
        error,
        cancel,
    }
}

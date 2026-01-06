import { useEffect, useRef } from 'react'
import { ScrollArea } from '@nextsparkjs/core/components/ui/scroll-area'
import { Message as MessageType } from '../../lib/hooks/useAiChat'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'
import { createCyId } from '@nextsparkjs/core/lib/testing-utils'

interface MessageListProps {
    messages: MessageType[]
    isLoading: boolean
    error?: string | null
}

export function MessageList({ messages, isLoading, error }: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isLoading])

    return (
        <ScrollArea data-cy={createCyId('ai-chat', 'message-list')} className="flex-1 p-4">
            <div className="flex flex-col gap-4">
                {error && (
                    <div
                        data-cy={createCyId('ai-chat', 'error-message')}
                        className="p-4 mb-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg"
                    >
                        {error}
                    </div>
                )}
                {messages.map((message) => (
                    <Message key={message.id} message={message} />
                ))}
                {isLoading && (
                    <div className="flex items-center gap-2 p-4">
                        <TypingIndicator />
                    </div>
                )}
                <div ref={scrollRef} />
            </div>
        </ScrollArea>
    )
}

import { cn } from '@nextsparkjs/core/lib/utils'
import { Message as MessageType } from '../../lib/hooks/useAiChat'
import { MarkdownRenderer } from './MarkdownRenderer'
import { User, Bot } from 'lucide-react'
import { sel } from '@nextsparkjs/core/selectors'

interface MessageProps {
    message: MessageType
}

export function Message({ message }: MessageProps) {
    const isUser = message.role === 'user'

    return (
        <div
            data-cy={sel(message.role === 'user' ? 'common.aiChat.messageUser' : 'common.aiChat.messageAssistant')}
            className={cn(
                'flex w-full gap-3 p-4',
                isUser ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            <div
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                    isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
            >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
                className={cn(
                    'flex max-w-[80%] flex-col gap-1 rounded-lg px-4 py-2 text-sm',
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                )}
            >
                <MarkdownRenderer content={message.content} />
            </div>
        </div>
    )
}

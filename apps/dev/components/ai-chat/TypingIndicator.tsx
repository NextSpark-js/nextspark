import { sel } from '@nextsparkjs/core/selectors'

export function TypingIndicator() {
    return (
        <div data-cy={sel('common.aiChat.typingIndicator')} className="flex items-center gap-1 p-2">
            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
        </div>
    )
}

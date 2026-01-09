import { KeyboardEvent } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Textarea } from '@nextsparkjs/core/components/ui/textarea'
import { Send } from 'lucide-react'
import { createCyId } from '@nextsparkjs/testing/utils'

interface MessageInputProps {
    value: string
    onChange: (value: string) => void
    onSend: () => void
    isLoading: boolean
}

export function MessageInput({ value, onChange, onSend, isLoading }: MessageInputProps) {
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
        }
    }

    return (
        <div className="p-4 border-t bg-background">
            <div className="flex gap-2">
                <Textarea
                    data-cy={createCyId('ai-chat', 'message-input')}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="min-h-[60px] resize-none"
                    disabled={isLoading}
                />
                <Button
                    data-cy={createCyId('ai-chat', 'send-btn')}
                    size="icon"
                    onClick={onSend}
                    disabled={!value.trim() || isLoading}
                    className="h-[60px] w-[60px]"
                >
                    <Send className="h-5 w-5" />
                </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
                Press Enter to send, Shift + Enter for new line
            </div>
        </div>
    )
}

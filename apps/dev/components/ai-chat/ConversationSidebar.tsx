'use client'

import { Plus, MessageSquarePlus, Loader2 } from 'lucide-react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { ScrollArea } from '@nextsparkjs/core/components/ui/scroll-area'
import { ConversationItem } from './ConversationItem'
import type { ConversationInfo } from '../../lib/hooks/useConversations'

interface ConversationSidebarProps {
    conversations: ConversationInfo[]
    activeSessionId: string | null
    onSelect: (sessionId: string) => void
    onNew: () => Promise<void>
    onRename: (sessionId: string, name: string) => Promise<void>
    onDelete: (sessionId: string) => Promise<void>
    onTogglePin: (sessionId: string) => Promise<void>
    isLoading: boolean
    isCreating: boolean
    canCreateNew: boolean
    conversationCount: number
    maxConversations: number
}

export function ConversationSidebar({
    conversations,
    activeSessionId,
    onSelect,
    onNew,
    onRename,
    onDelete,
    onTogglePin,
    isLoading,
    isCreating,
    canCreateNew,
    conversationCount,
    maxConversations,
}: ConversationSidebarProps) {
    return (
        <div
            className="flex flex-col h-full border-r bg-muted/30"
            data-cy="conversation-sidebar"
        >
            {/* Header */}
            <div className="p-4 border-b">
                <Button
                    onClick={onNew}
                    disabled={!canCreateNew || isCreating}
                    className="w-full"
                    data-cy="new-conversation-button"
                >
                    {isCreating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4 mr-2" />
                    )}
                    New conversation
                </Button>

                {/* Count indicator */}
                <p className="text-xs text-muted-foreground text-center mt-2">
                    {conversationCount} / {maxConversations} conversations
                </p>
            </div>

            {/* Conversations List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center py-8 px-4">
                            <MessageSquarePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                                No conversations yet.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Start a new conversation to begin.
                            </p>
                        </div>
                    ) : (
                        conversations.map((conversation) => (
                            <ConversationItem
                                key={conversation.sessionId}
                                conversation={conversation}
                                isActive={conversation.sessionId === activeSessionId}
                                onClick={() => onSelect(conversation.sessionId)}
                                onRename={(name) => onRename(conversation.sessionId, name)}
                                onDelete={() => onDelete(conversation.sessionId)}
                                onTogglePin={() => onTogglePin(conversation.sessionId)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}

'use client'

import { ChatPanel, type SidebarConfig } from '@/themes/default/components/ai-chat/ChatPanel'
import { usePersistentChat } from '@/themes/default/lib/hooks/usePersistentChat'
import { useConversations } from '@/themes/default/lib/hooks/useConversations'
import { Bot, Loader2, MessageSquarePlus } from 'lucide-react'

/**
 * AI Assistant Page with Multiple Conversations
 *
 * Features:
 * - Sidebar with list of all conversations
 * - Create new conversations
 * - Switch between conversations
 * - Rename, delete, pin/unpin conversations
 * - Persistent message history per conversation
 * - Max 50 conversations, 50 messages per conversation
 */
export default function AiAssistantTemplate() {
    const {
        conversations,
        activeSessionId,
        setActiveSession,
        createConversation,
        deleteConversation,
        renameConversation,
        togglePin,
        isLoading: isLoadingConversations,
        isCreating,
        canCreateNew,
        conversationCount,
        maxConversations,
        isReady: isConversationsReady,
    } = useConversations()

    const {
        messages,
        input,
        setInput,
        isLoading: isSending,
        isLoadingHistory,
        sendMessage,
        error,
        isReady: isChatReady,
        hasSession,
    } = usePersistentChat(activeSessionId)

    const isReady = isConversationsReady && isChatReady

    const handleNewConversation = async () => {
        await createConversation()
    }

    // Sidebar configuration
    const sidebarConfig: SidebarConfig = {
        conversations,
        activeSessionId,
        onSelect: setActiveSession,
        onNew: handleNewConversation,
        onRename: renameConversation,
        onDelete: deleteConversation,
        onTogglePin: togglePin,
        isLoading: isLoadingConversations,
        isCreating,
        canCreateNew,
        conversationCount,
        maxConversations,
    }

    return (
        <ChatPanel
            cyPrefix="ai-chat"
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSend={sendMessage}
            isLoading={isSending}
            error={error}
            isReady={isReady}
            isLoadingHistory={isLoadingHistory}
            hasSession={hasSession}
            sessionId={activeSessionId}
            showSessionDebug
            sidebar={sidebarConfig}
            header={{
                title: 'AI Assistant',
                subtitle: hasSession
                    ? 'Ask me about your tasks or anything else.'
                    : 'Select or create a conversation to begin.',
                icon: Bot,
                mobileAction: (
                    <button
                        onClick={handleNewConversation}
                        disabled={!canCreateNew || isCreating}
                        className="p-2 rounded-md hover:bg-muted disabled:opacity-50"
                        data-cy="new-conversation-mobile"
                    >
                        {isCreating ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <MessageSquarePlus className="h-5 w-5" />
                        )}
                    </button>
                ),
            }}
            emptyState={{
                icon: Bot,
                title: 'Welcome to your AI Assistant',
                description: 'Your conversation history is automatically saved. Ask me anything!',
                suggestions: [
                    'Show me my tasks',
                    'Create a new task: Review project proposal',
                    'What tasks are due this week?',
                ],
            }}
            noSessionState={{
                icon: MessageSquarePlus,
                title: conversations.length === 0
                    ? 'Start your first conversation'
                    : 'Select a conversation',
                description: conversations.length === 0
                    ? 'Create a new conversation to start chatting with your AI assistant.'
                    : 'Choose a conversation from the sidebar or create a new one.',
                action: (
                    <button
                        onClick={handleNewConversation}
                        disabled={!canCreateNew || isCreating}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        data-cy="start-conversation-btn"
                    >
                        {isCreating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <MessageSquarePlus className="h-4 w-4" />
                        )}
                        New conversation
                    </button>
                ),
            }}
        />
    )
}

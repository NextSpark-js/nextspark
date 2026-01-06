'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Card } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { ScrollArea } from '@nextsparkjs/core/components/ui/scroll-area'
import { MessageInput } from './MessageInput'
import { MarkdownRenderer } from './MarkdownRenderer'
import { TypingIndicator } from './TypingIndicator'
import { ConversationSidebar } from './ConversationSidebar'
import { createCyId } from '@nextsparkjs/core/lib/testing-utils'
import { cn } from '@nextsparkjs/core/lib/utils'
import { Bot, User, Loader2, Trash2, ListTodo, Users, FileText, Sparkles, X } from 'lucide-react'
import type { ConversationInfo } from '../../lib/hooks/useConversations'
import type { LucideIcon } from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Agent badge configuration for multi-agent support
 */
export interface AgentBadge {
    label: string
    icon: LucideIcon
    className: string
}

/**
 * Agent badge registry - maps agent names to their visual representation
 */
export type AgentBadgeRegistry = Record<string, AgentBadge>

/**
 * Message with optional agent information
 */
export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp?: number
    /** Agent that handled this message (for multi-agent mode) */
    agentUsed?: string
}

/**
 * Sidebar configuration for conversation management
 */
export interface SidebarConfig {
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

/**
 * Header configuration
 */
export interface HeaderConfig {
    title: string
    subtitle?: string
    icon?: LucideIcon
    iconClassName?: string
    /** Show clear chat button */
    showClearButton?: boolean
    onClear?: () => void
    /** Additional header content (e.g., agent legend) */
    extra?: ReactNode
    /** Mobile action button */
    mobileAction?: ReactNode
}

/**
 * Empty state configuration
 */
export interface EmptyStateConfig {
    icon?: LucideIcon
    title: string
    description?: string
    suggestions?: string[]
    action?: ReactNode
}

/**
 * ChatPanel props
 */
export interface ChatPanelProps {
    /** Unique identifier for testing */
    cyPrefix?: string
    /** Messages to display */
    messages: ChatMessage[]
    /** Current input value */
    input: string
    /** Input change handler */
    onInputChange: (value: string) => void
    /** Send message handler */
    onSend: () => void
    /** Loading state (sending message) */
    isLoading?: boolean
    /** Error message */
    error?: string | null
    /** Header configuration */
    header: HeaderConfig
    /** Sidebar configuration (optional - enables conversation management) */
    sidebar?: SidebarConfig
    /** Agent badge registry (optional - enables multi-agent mode) */
    agentBadges?: AgentBadgeRegistry
    /** Show agent legend in header */
    showAgentLegend?: boolean
    /** Empty state when no messages */
    emptyState?: EmptyStateConfig
    /** Empty state when no session selected (sidebar mode) */
    noSessionState?: EmptyStateConfig
    /** Session ID for debugging */
    sessionId?: string | null
    /** Show session debug info in dev mode */
    showSessionDebug?: boolean
    /** Custom max width class */
    maxWidthClass?: string
    /** Component is ready */
    isReady?: boolean
    /** Loading history */
    isLoadingHistory?: boolean
    /** Has active session (for sidebar mode) */
    hasSession?: boolean
    /** Partial content during streaming */
    streamingContent?: string
    /** Whether currently streaming */
    isStreamingMessage?: boolean
    /** Cancel streaming callback */
    onCancelStream?: () => void
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Single chat message with optional agent badge
 */
function ChatMessageItem({
    message,
    agentBadges,
    cyPrefix = 'chat',
}: {
    message: ChatMessage
    agentBadges?: AgentBadgeRegistry
    cyPrefix?: string
}) {
    const isUser = message.role === 'user'
    const agentBadge = !isUser && message.agentUsed && agentBadges
        ? agentBadges[message.agentUsed]
        : null

    return (
        <div
            data-cy={createCyId(cyPrefix, `message-${message.role}`)}
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
            <div className={cn('flex max-w-[80%] flex-col gap-1')}>
                {agentBadge && (
                    <div className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium w-fit',
                        agentBadge.className
                    )}>
                        <agentBadge.icon className="h-3 w-3" />
                        {agentBadge.label}
                    </div>
                )}
                <div
                    className={cn(
                        'rounded-lg px-4 py-2 text-sm',
                        isUser
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                    )}
                >
                    <MarkdownRenderer content={message.content} />
                </div>
            </div>
        </div>
    )
}

/**
 * Agent legend display
 */
function AgentLegend({ badges }: { badges: AgentBadgeRegistry }) {
    return (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(badges).map(([key, badge]) => (
                <span
                    key={key}
                    className={cn(
                        'px-2 py-1 rounded flex items-center gap-1',
                        badge.className
                    )}
                >
                    <badge.icon className="h-3 w-3" />
                    {badge.label}
                </span>
            ))}
        </div>
    )
}

/**
 * Empty state display
 */
function EmptyState({ config, icon: DefaultIcon = Bot }: { config: EmptyStateConfig; icon?: LucideIcon }) {
    const Icon = config.icon || DefaultIcon
    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
                <Icon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h2 className="text-xl font-semibold mb-2">{config.title}</h2>
                {config.description && (
                    <p className="text-muted-foreground mb-6">{config.description}</p>
                )}
                {config.suggestions && config.suggestions.length > 0 && (
                    <div className="space-y-2 text-sm text-left">
                        <p className="text-muted-foreground">Try asking:</p>
                        {config.suggestions.map((suggestion, i) => (
                            <p key={i} className="bg-muted p-2 rounded">
                                &quot;{suggestion}&quot;
                            </p>
                        ))}
                    </div>
                )}
                {config.action}
            </div>
        </div>
    )
}

/**
 * Loading state display
 */
function LoadingState({ message = 'Loading...' }: { message?: string }) {
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            </div>
        </div>
    )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ChatPanel - Unified chat interface component
 *
 * A flexible chat panel that supports:
 * - Optional sidebar for conversation management
 * - Optional multi-agent badges
 * - Customizable header, empty states, and styling
 *
 * @example
 * // Simple chat (like orchestrator)
 * <ChatPanel
 *   messages={messages}
 *   input={input}
 *   onInputChange={setInput}
 *   onSend={sendMessage}
 *   isLoading={isLoading}
 *   header={{ title: 'AI Chat', subtitle: 'Ask me anything' }}
 * />
 *
 * @example
 * // With sidebar (like single-agent)
 * <ChatPanel
 *   messages={messages}
 *   input={input}
 *   onInputChange={setInput}
 *   onSend={sendMessage}
 *   sidebar={sidebarConfig}
 *   header={{ title: 'AI Assistant' }}
 * />
 *
 * @example
 * // With multi-agent badges
 * <ChatPanel
 *   messages={messages}
 *   agentBadges={AGENT_BADGES}
 *   showAgentLegend
 *   header={{ title: 'Orchestrator' }}
 * />
 */
export function ChatPanel({
    cyPrefix = 'chat',
    messages,
    input,
    onInputChange,
    onSend,
    isLoading = false,
    error,
    header,
    sidebar,
    agentBadges,
    showAgentLegend = false,
    emptyState,
    noSessionState,
    sessionId,
    showSessionDebug = false,
    maxWidthClass = 'max-w-4xl',
    isReady = true,
    isLoadingHistory = false,
    hasSession = true,
    streamingContent,
    isStreamingMessage = false,
    onCancelStream,
}: ChatPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const HeaderIcon = header.icon || Bot

    // Auto-scroll on new messages and streaming content
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isLoading, streamingContent])

    // Determine layout class based on sidebar presence
    const hasSidebar = !!sidebar
    const layoutClass = hasSidebar ? 'max-w-6xl' : maxWidthClass

    return (
        <div className="h-[calc(100vh-4rem)] p-4 md:p-6 lg:p-8">
            <Card
                data-cy={createCyId(cyPrefix, 'panel')}
                className={cn(
                    'flex h-full mx-auto overflow-hidden shadow-lg',
                    layoutClass
                )}
            >
                {/* Optional Sidebar */}
                {hasSidebar && (
                    <div className="w-64 flex-shrink-0 hidden md:block">
                        <ConversationSidebar
                            conversations={sidebar.conversations}
                            activeSessionId={sidebar.activeSessionId}
                            onSelect={sidebar.onSelect}
                            onNew={sidebar.onNew}
                            onRename={sidebar.onRename}
                            onDelete={sidebar.onDelete}
                            onTogglePin={sidebar.onTogglePin}
                            isLoading={sidebar.isLoading}
                            isCreating={sidebar.isCreating}
                            canCreateNew={sidebar.canCreateNew}
                            conversationCount={sidebar.conversationCount}
                            maxConversations={sidebar.maxConversations}
                        />
                    </div>
                )}

                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="p-4 border-b bg-muted/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-full',
                                    header.iconClassName || 'bg-primary/10'
                                )}>
                                    <HeaderIcon className={cn(
                                        'h-5 w-5',
                                        header.iconClassName ? '' : 'text-primary'
                                    )} />
                                </div>
                                <div>
                                    <h1 className="text-lg font-semibold flex items-center gap-2">
                                        {header.title}
                                    </h1>
                                    {header.subtitle && (
                                        <p className="text-sm text-muted-foreground">
                                            {header.subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Clear button */}
                                {header.showClearButton && header.onClear && (
                                    <Button
                                        data-cy={createCyId(cyPrefix, 'clear-btn')}
                                        variant="ghost"
                                        size="sm"
                                        onClick={header.onClear}
                                        disabled={messages.length === 0}
                                        title="Clear chat"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}

                                {/* Mobile action (e.g., new conversation button) */}
                                {header.mobileAction && (
                                    <div className="md:hidden">
                                        {header.mobileAction}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Agent Legend */}
                        {showAgentLegend && agentBadges && (
                            <AgentLegend badges={agentBadges} />
                        )}

                        {/* Extra header content */}
                        {header.extra}

                        {/* Session Debug */}
                        {showSessionDebug && sessionId && process.env.NODE_ENV === 'development' && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Session: <code className="bg-muted px-1 rounded">
                                    {sessionId.length > 16 ? `${sessionId.slice(0, 8)}...` : sessionId}
                                </code>
                            </div>
                        )}
                    </div>

                    {/* Content Area */}
                    {!isReady ? (
                        <LoadingState />
                    ) : hasSidebar && !hasSession ? (
                        /* No session selected (sidebar mode) */
                        noSessionState ? (
                            <EmptyState config={noSessionState} />
                        ) : (
                            <LoadingState message="Select a conversation" />
                        )
                    ) : isLoadingHistory && messages.length === 0 ? (
                        <LoadingState message="Loading conversation..." />
                    ) : messages.length === 0 && !isLoading ? (
                        /* Empty state */
                        emptyState ? (
                            <EmptyState config={emptyState} />
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <p className="text-muted-foreground">Start a conversation</p>
                            </div>
                        )
                    ) : (
                        /* Messages */
                        <ScrollArea
                            data-cy={createCyId(cyPrefix, 'message-list')}
                            className="flex-1 p-4"
                        >
                            <div className="flex flex-col gap-4">
                                {error && (
                                    <div
                                        data-cy={createCyId(cyPrefix, 'error-message')}
                                        className="p-4 mb-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg"
                                    >
                                        {error}
                                    </div>
                                )}
                                {messages.map((message) => (
                                    <ChatMessageItem
                                        key={message.id}
                                        message={message}
                                        agentBadges={agentBadges}
                                        cyPrefix={cyPrefix}
                                    />
                                ))}
                                {isLoading && (
                                    <div className="flex items-center gap-2 p-4">
                                        {isStreamingMessage && streamingContent ? (
                                            // Show streaming content with blinking cursor
                                            <div className="flex w-full gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
                                                    <Bot className="h-4 w-4" />
                                                </div>
                                                <div className="flex max-w-[80%] flex-col gap-1">
                                                    <div className="rounded-lg px-4 py-2 text-sm bg-muted">
                                                        <MarkdownRenderer content={streamingContent} />
                                                        <span className="inline-block w-2 h-4 ml-1 bg-foreground animate-pulse">|</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <TypingIndicator />
                                        )}
                                    </div>
                                )}
                                {/* Cancel button during streaming */}
                                {isStreamingMessage && onCancelStream && (
                                    <div className="flex justify-center py-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={onCancelStream}
                                            data-cy="chat-cancel-button"
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Stop generating
                                        </Button>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                    )}

                    {/* Input - always show if ready and has session */}
                    {isReady && (hasSidebar ? hasSession : true) && (
                        <MessageInput
                            value={input}
                            onChange={onInputChange}
                            onSend={onSend}
                            isLoading={isLoading}
                        />
                    )}
                </div>
            </Card>
        </div>
    )
}

// ============================================================================
// PRESETS
// ============================================================================

/**
 * Default agent badges for orchestrator mode
 */
export const ORCHESTRATOR_AGENT_BADGES: AgentBadgeRegistry = {
    task: {
        label: 'Task Agent',
        icon: ListTodo,
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    },
    customer: {
        label: 'Customer Agent',
        icon: Users,
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    },
    page: {
        label: 'Page Agent',
        icon: FileText,
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    },
    orchestrator: {
        label: 'Orchestrator',
        icon: Sparkles,
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    },
}

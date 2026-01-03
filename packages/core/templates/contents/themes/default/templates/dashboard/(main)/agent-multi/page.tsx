'use client'

import { ChatPanel, ORCHESTRATOR_AGENT_BADGES } from '@/themes/default/components/ai-chat/ChatPanel'
import { useOrchestratorChat } from '@/themes/default/lib/hooks/useOrchestratorChat'
import { Sparkles } from 'lucide-react'

/**
 * AI Orchestrator Test Page
 *
 * This page demonstrates the multi-agent orchestrator pattern.
 * Messages are routed to specialized agents based on intent:
 * - Task Agent: manages tasks, to-dos, deadlines
 * - Customer Agent: manages customers, accounts, sales
 * - Page Agent: manages pages, blocks, content
 */
export default function AiOrchestratorTemplate() {
    const {
        messages,
        input,
        setInput,
        isLoading,
        sendMessage,
        clearChat,
        error,
        sessionId,
    } = useOrchestratorChat()

    return (
        <ChatPanel
            cyPrefix="orchestrator-chat"
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSend={sendMessage}
            isLoading={isLoading}
            error={error}
            sessionId={sessionId}
            showSessionDebug
            agentBadges={ORCHESTRATOR_AGENT_BADGES}
            showAgentLegend
            header={{
                title: 'AI Orchestrator Test',
                subtitle: 'Multi-agent routing: Tasks, Customers, Pages',
                icon: Sparkles,
                iconClassName: 'bg-amber-100 dark:bg-amber-900/30',
                showClearButton: true,
                onClear: clearChat,
            }}
            emptyState={{
                icon: Sparkles,
                title: 'Test the Orchestrator',
                description: 'Try these examples:',
                suggestions: [
                    'Show me my pending tasks',
                    'List all customers',
                    'Create a landing page for Product X',
                    'Hello!',
                    'Create something new',
                ],
            }}
        />
    )
}

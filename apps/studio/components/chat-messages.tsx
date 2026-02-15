'use client'

import { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { User, Sparkles, Wrench, Loader2, CheckCircle2, Terminal } from 'lucide-react'
import type { ChatMessage, StudioStatus } from '@/lib/types'

interface ChatMessagesProps {
  messages: ChatMessage[]
  status: StudioStatus
}

function ToolIcon({ status }: { status: StudioStatus }) {
  if (status === 'streaming') {
    return <Loader2 className="h-4 w-4 animate-spin text-accent" />
  }
  return <CheckCircle2 className="h-4 w-4 text-success" />
}

function toolDisplayName(name?: string): string {
  switch (name) {
    case 'analyze_requirement': return 'Analyzing requirements'
    case 'configure_project': return 'Configuring project'
    case 'define_entity': return 'Defining entity'
    default: return name || 'Processing'
  }
}

export function ChatMessages({ messages, status }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4">
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0 mt-0.5">
            {msg.role === 'user' ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated">
                <User className="h-4 w-4 text-text-secondary" />
              </div>
            ) : msg.role === 'tool' ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted">
                <Wrench className="h-4 w-4 text-accent" />
              </div>
            ) : msg.role === 'system' ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated">
                <Terminal className="h-4 w-4 text-success" />
              </div>
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {msg.role === 'tool' ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm">
                <ToolIcon status={status} />
                <span className="text-text-secondary">
                  {toolDisplayName(msg.toolName)}
                </span>
                <span className="text-text-muted truncate">
                  {msg.content}
                </span>
              </div>
            ) : msg.role === 'system' ? (
              <div className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-xs font-mono text-text-muted">
                {msg.content}
              </div>
            ) : msg.role === 'assistant' ? (
              <div className="prose-studio text-sm leading-relaxed">
                <Markdown>{msg.content}</Markdown>
              </div>
            ) : (
              <div className="text-sm leading-relaxed text-text-primary">
                {msg.content}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {status === 'loading' && (
        <div className="flex gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm text-text-muted">Thinking...</span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}

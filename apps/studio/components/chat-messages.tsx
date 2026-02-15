'use client'

import { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { Loader2, ChevronRight } from 'lucide-react'
import type { ChatMessage, StudioStatus } from '@/lib/types'

interface ChatMessagesProps {
  messages: ChatMessage[]
  status: StudioStatus
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-2">
      {messages.map((msg) => {
        // User message
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="space-y-0.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted/60">
                You
              </span>
              <p className="text-[12px] text-text-primary leading-relaxed">
                {msg.content}
              </p>
            </div>
          )
        }

        // Tool usage — compact inline
        if (msg.role === 'tool') {
          return (
            <div key={msg.id} className="flex items-center gap-1.5 py-px">
              <ChevronRight className="h-2 w-2 text-accent/50 flex-shrink-0" />
              <span className="text-[10px] text-text-muted/70">
                {toolDisplayName(msg.toolName)}
              </span>
            </div>
          )
        }

        // System messages — compact log
        if (msg.role === 'system') {
          return (
            <div key={msg.id} className="border-l border-border/60 pl-2 py-px">
              <span className="text-[10px] font-mono text-text-muted/60 leading-relaxed line-clamp-2">
                {msg.content}
              </span>
            </div>
          )
        }

        // Assistant message
        return (
          <div key={msg.id} className="space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-accent/60">
              AI
            </span>
            <div className="prose-studio text-[12px]">
              <Markdown>{msg.content}</Markdown>
            </div>
          </div>
        )
      })}

      {/* Thinking indicator */}
      {status === 'loading' && (
        <div className="flex items-center gap-2 py-1">
          <Loader2 className="h-3 w-3 animate-spin text-accent" />
          <span className="text-[10px] text-text-muted">Thinking...</span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { ChevronRight } from 'lucide-react'
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
    <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3">
      {messages.map((msg) => {
        // User message
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted/60">
                You
              </span>
              <p className="text-[13px] text-text-primary leading-relaxed">
                {msg.content}
              </p>
            </div>
          )
        }

        // Tool usage — enhanced with status indicator
        if (msg.role === 'tool') {
          return (
            <div key={msg.id} className="flex items-center gap-2 py-1 animate-in">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/10 flex-shrink-0">
                <ChevronRight className="h-2.5 w-2.5 text-accent/70" />
              </div>
              <span className="text-[11px] text-text-secondary font-medium">
                {toolDisplayName(msg.toolName)}
              </span>
            </div>
          )
        }

        // System messages — terminal-like
        if (msg.role === 'system') {
          return (
            <div key={msg.id} className="border-l-2 border-accent/20 pl-2.5 py-1 animate-in">
              <span className="text-[11px] font-mono text-text-muted/80 leading-relaxed">
                {msg.content}
              </span>
            </div>
          )
        }

        // Assistant message
        return (
          <div key={msg.id} className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent/60">
              AI
            </span>
            <div className="prose-studio text-[13px]">
              <Markdown>{msg.content}</Markdown>
            </div>
          </div>
        )
      })}

      {/* Thinking indicator */}
      {status === 'loading' && (
        <div className="flex items-center gap-2.5 py-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-[11px] text-accent/70 font-medium">Thinking...</span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}

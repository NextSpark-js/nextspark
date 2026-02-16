'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ArrowRight, FolderOpen, Loader2 } from 'lucide-react'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for non-secure contexts (HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const EXAMPLES = [
  'A CRM for my gym with clients, memberships and payments',
  'Blog for my photography portfolio',
  'Project management tool for my remote team',
  'SaaS para gestionar reservas de un restaurante',
]

interface SessionSummary {
  id: string
  prompt: string
  status: string
  project_slug: string | null
  updated_at: string
}

export default function HomePage() {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([])
  const router = useRouter()

  useEffect(() => {
    fetch('/api/sessions?limit=3')
      .then((res) => res.ok ? res.json() : { sessions: [] })
      .then((data) => setRecentSessions(data.sessions || []))
      .catch(() => {})
  }, [])

  async function handleSubmit(text?: string) {
    const input = text || prompt
    if (!input.trim() || submitting) return

    setSubmitting(true)
    try {
      const id = generateId()
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, prompt: input.trim() }),
      })
      if (res.ok) {
        router.push(`/build?session=${id}`)
      } else {
        // Fallback — navigate anyway, build page will handle it
        router.push(`/build?session=${id}`)
      }
    } catch {
      // Fallback
      const id = generateId()
      router.push(`/build?session=${id}`)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-8">
        {/* Logo with gradient glow */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-accent/20 blur-xl" />
              <Zap className="relative h-7 w-7 text-accent" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              nextspark studio
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Describe your app. We build it.
          </p>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Describe the app you want to build..."
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-bg-surface p-4 pr-14 text-sm text-text-primary placeholder:text-text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors"
              autoFocus
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!prompt.trim() || submitting}
              className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent-hover disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-text-muted/50 text-center">
            Press Enter to submit &middot; Shift+Enter for new line
          </p>
        </div>

        {/* Examples */}
        <div className="space-y-3">
          <p className="text-[11px] text-text-muted text-center uppercase tracking-wider font-medium">
            Try an example
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => handleSubmit(example)}
                disabled={submitting}
                className="rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition-all hover:border-border-strong hover:text-text-primary hover:scale-[1.03] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Recent projects */}
        {recentSessions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="h-px flex-1 bg-border/50" />
              <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                Recent projects
              </p>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/build?session=${s.id}`)}
                  className="w-full flex items-center gap-3 rounded-lg border border-border bg-bg-surface px-4 py-3 text-left transition-all hover:border-border-strong hover:bg-bg-hover group"
                >
                  <FolderOpen className="h-4 w-4 text-text-muted/50 group-hover:text-accent transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary truncate">
                      {s.project_slug || s.prompt.slice(0, 60)}
                    </p>
                    <p className="text-[10px] text-text-muted/60 truncate mt-0.5">
                      {s.prompt.slice(0, 80)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    s.status === 'complete'
                      ? 'bg-success/10 text-success'
                      : s.status === 'error'
                      ? 'bg-error/10 text-error'
                      : 'bg-accent-muted text-accent'
                  }`}>
                    {s.status}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={() => router.push('/projects')}
                className="text-[11px] text-accent hover:text-accent-hover transition-colors"
              >
                View all projects
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-6 text-[11px] text-text-muted/40">
        Built with NextSpark &times; Claude
      </div>
    </div>
  )
}

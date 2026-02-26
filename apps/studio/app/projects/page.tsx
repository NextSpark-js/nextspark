'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, FolderOpen, Trash2, ArrowLeft, Loader2,
  CheckCircle2, XCircle, Clock, LayoutGrid,
} from 'lucide-react'

interface SessionSummary {
  id: string
  prompt: string
  status: string
  project_slug: string | null
  result: {
    entities?: { name: string }[]
    pages?: unknown[]
    wizardConfig?: { projectName?: string; projectDescription?: string }
  } | null
  pages: unknown[] | null
  error: string | null
  created_at: string
  updated_at: string
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-success" />
    case 'error':
      return <XCircle className="h-4 w-4 text-error" />
    default:
      return <Clock className="h-4 w-4 text-accent" />
  }
}

export default function ProjectsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions?limit=50')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleting) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id))
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }, [deleting])

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-bg-surface/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              title="Back to home"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" />
              <h1 className="text-sm font-semibold text-text-primary">Projects</h1>
            </div>
            <span className="text-xs text-text-muted/50">
              {sessions.length} {sessions.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Zap className="h-3 w-3" />
            New project
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted border border-accent/10">
              <FolderOpen className="h-7 w-7 text-accent/60" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium text-text-secondary">No projects yet</p>
              <p className="text-xs text-text-muted max-w-[260px]">
                Describe the app you want to build on the home page to create your first project
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-xs font-medium text-white transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 active:scale-[0.97]"
            >
              <Zap className="h-3 w-3" />
              Create your first app
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => {
              const name = session.project_slug
                || session.result?.wizardConfig?.projectName
                || session.prompt.slice(0, 40)
              const entityCount = session.result?.entities?.length || 0
              const pageCount = (session.pages || session.result?.pages || []).length
              const description = session.result?.wizardConfig?.projectDescription
                || session.prompt

              return (
                <button
                  key={session.id}
                  onClick={() => router.push(`/build?session=${session.id}`)}
                  className="animate-card-in group relative flex flex-col rounded-xl border border-border bg-bg-surface p-4 text-left transition-all hover:border-border-strong hover:shadow-md hover:shadow-accent/5 active:scale-[0.98]"
                  style={{ animationDelay: `${sessions.indexOf(session) * 50}ms` }}
                >
                  {/* Delete button */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDelete(session.id, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(session.id, e as unknown as React.MouseEvent) }}
                    className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted/0 group-hover:text-text-muted/50 hover:!text-error hover:!bg-error/10 transition-all"
                    title="Delete project"
                  >
                    {deleting === session.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </div>

                  {/* Status + Name */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <StatusIcon status={session.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate pr-6">
                        {name}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-text-muted/70 line-clamp-2 mb-3 leading-relaxed">
                    {description}
                  </p>

                  {/* Meta */}
                  <div className="mt-auto flex items-center gap-3 text-[11px] text-text-muted/50">
                    {entityCount > 0 && (
                      <span className="flex items-center gap-1">
                        <LayoutGrid className="h-3 w-3" />
                        {entityCount} {entityCount === 1 ? 'entity' : 'entities'}
                      </span>
                    )}
                    {pageCount > 0 && (
                      <span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                    )}
                    <span className="ml-auto">
                      {formatRelativeTime(session.updated_at)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

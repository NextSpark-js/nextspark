/**
 * GitHub Push Modal
 *
 * Form → Progress → Success/Error states
 */

'use client'

import { useState, useCallback } from 'react'
import {
  X, Github, Check, Loader2, AlertCircle,
  ExternalLink, Copy, Lock, Globe,
} from 'lucide-react'
import type { GitHubUser, PushStep, PushResult } from '@/lib/use-github'

interface GitHubPushModalProps {
  slug: string
  user: GitHubUser
  pushStep: PushStep
  pushError: string | null
  pushResult: PushResult | null
  description?: string
  onPush: (options: {
    slug: string
    repoName: string
    description?: string
    isPrivate?: boolean
    sanitizeEnv?: boolean
    addReadme?: boolean
  }) => void
  onClose: () => void
}

const STEPS: { key: PushStep; label: string }[] = [
  { key: 'sanitizing', label: 'Securing files' },
  { key: 'initializing', label: 'Creating repository' },
  { key: 'staging', label: 'Preparing code' },
  { key: 'committing', label: 'Saving snapshot' },
  { key: 'creating_repo', label: 'Setting up GitHub' },
  { key: 'pushing', label: 'Uploading to GitHub' },
  { key: 'cleaning', label: 'Complete' },
]

function getStepIndex(step: PushStep): number {
  return STEPS.findIndex((s) => s.key === step)
}

export function GitHubPushModal({
  slug,
  user,
  pushStep,
  pushError,
  pushResult,
  description: defaultDescription,
  onPush,
  onClose,
}: GitHubPushModalProps) {
  const [repoName, setRepoName] = useState(slug)
  const [description, setDescription] = useState(defaultDescription || '')
  const [isPrivate, setIsPrivate] = useState(true)
  const [sanitizeEnv, setSanitizeEnv] = useState(true)
  const [addReadme, setAddReadme] = useState(true)
  const [copied, setCopied] = useState(false)

  const isIdle = pushStep === 'idle'
  const isPushing = !isIdle && pushStep !== 'done' && pushStep !== 'error'
  const isDone = pushStep === 'done'
  const isError = pushStep === 'error'

  const handleSubmit = useCallback(() => {
    if (!repoName.trim()) return
    onPush({
      slug,
      repoName: repoName.trim(),
      description: description.trim() || undefined,
      isPrivate,
      sanitizeEnv,
      addReadme,
    })
  }, [slug, repoName, description, isPrivate, sanitizeEnv, addReadme, onPush])

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const currentStepIndex = getStepIndex(pushStep)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isPushing ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-border bg-bg-surface shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">
              {isDone ? 'Pushed Successfully' : isError ? 'Push Failed' : isPushing ? 'Pushing to GitHub' : 'Push to GitHub'}
            </h2>
          </div>
          {!isPushing && (
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-4">
          {/* ── Form State ──────────────────────────────────────────── */}
          {isIdle && (
            <div className="space-y-4">
              {/* User badge */}
              <div className="flex items-center gap-2 rounded-lg bg-bg-hover/50 px-3 py-2">
                <img src={user.avatar_url} alt={user.login} className="h-5 w-5 rounded-full" />
                <span className="text-xs text-text-secondary">
                  Pushing as <span className="font-medium">@{user.login}</span>
                </span>
              </div>

              {/* Repo name */}
              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  Repository name
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50"
                  placeholder="my-project"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  Description <span className="text-text-muted/40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50"
                  placeholder="A SaaS app built with NextSpark"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-2">
                  Visibility
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPrivate(true)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                      isPrivate
                        ? 'border-accent/50 bg-accent/5 text-accent'
                        : 'border-border text-text-muted hover:border-border-hover'
                    }`}
                  >
                    <Lock className="h-3 w-3" />
                    Private
                  </button>
                  <button
                    onClick={() => setIsPrivate(false)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                      !isPrivate
                        ? 'border-accent/50 bg-accent/5 text-accent'
                        : 'border-border text-text-muted hover:border-border-hover'
                    }`}
                  >
                    <Globe className="h-3 w-3" />
                    Public
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addReadme}
                    onChange={(e) => setAddReadme(e.target.checked)}
                    className="rounded border-border"
                  />
                  Add README.md with project info
                </label>
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sanitizeEnv}
                    onChange={(e) => setSanitizeEnv(e.target.checked)}
                    className="rounded border-border"
                  />
                  Clean sensitive data from .env
                </label>
              </div>
            </div>
          )}

          {/* ── Pushing State ───────────────────────────────────────── */}
          {isPushing && (
            <div className="space-y-3 py-2">
              {STEPS.map((step, i) => {
                const isActive = step.key === pushStep
                const isDone = i < currentStepIndex
                const isPending = i > currentStepIndex

                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                      {isDone && (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-success/20">
                          <Check className="h-2.5 w-2.5 text-success" />
                        </div>
                      )}
                      {isActive && (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      )}
                      {isPending && (
                        <div className="h-2 w-2 rounded-full bg-border" />
                      )}
                    </div>
                    <span className={`text-xs ${
                      isActive ? 'text-text-primary font-medium' :
                      isDone ? 'text-text-muted' :
                      'text-text-muted/40'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}

              {/* Progress bar */}
              <div className="mt-4 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(5, ((currentStepIndex + 1) / STEPS.length) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Success State ───────────────────────────────────────── */}
          {isDone && pushResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2.5">
                <Check className="h-4 w-4 text-success flex-shrink-0" />
                <span className="text-xs text-success font-medium">Your project is now on GitHub!</span>
              </div>

              {/* Repo link */}
              <a
                href={pushResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs text-accent hover:bg-bg-hover transition-colors"
              >
                <Github className="h-4 w-4" />
                <span className="font-medium">{pushResult.fullName}</span>
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </a>

              {/* Clone command */}
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                  Clone command
                </label>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-2">
                  <code className="flex-1 text-[11px] text-text-secondary font-mono truncate">
                    git clone {pushResult.cloneUrl}
                  </code>
                  <button
                    onClick={() => handleCopy(`git clone ${pushResult.cloneUrl}`)}
                    className="flex-shrink-0 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Next steps */}
              <div className="rounded-lg bg-bg-hover/30 px-3 py-2.5">
                <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Next steps</p>
                <ol className="space-y-1 text-[11px] text-text-muted">
                  <li>1. Clone the repo</li>
                  <li>2. Run <code className="text-text-secondary">pnpm install</code></li>
                  <li>3. Copy <code className="text-text-secondary">.env.example</code> to <code className="text-text-secondary">.env</code></li>
                  <li>4. Add your credentials and run <code className="text-text-secondary">pnpm dev</code></li>
                </ol>
              </div>
            </div>
          )}

          {/* ── Error State ─────────────────────────────────────────── */}
          {isError && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-2 rounded-lg bg-error/5 border border-error/20 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-error font-medium">Push failed</p>
                  <p className="text-[11px] text-error/70 mt-0.5">{pushError}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          {isIdle && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!repoName.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-text-primary px-4 py-2 text-xs font-medium text-bg hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                <Github className="h-3.5 w-3.5" />
                Push to GitHub
              </button>
            </>
          )}

          {isDone && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              >
                Close
              </button>
              {pushResult && (
                <a
                  href={pushResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-text-primary px-4 py-2 text-xs font-medium text-bg hover:opacity-90 transition-opacity"
                >
                  Open in GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          )}

          {isError && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

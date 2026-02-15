'use client'

import { ExternalLink, Globe, Play, RotateCw, Database, Zap } from 'lucide-react'
import type { StudioPhase } from '@/lib/types'

type Viewport = 'desktop' | 'tablet' | 'mobile'

interface PreviewFrameProps {
  url: string | null
  loading: boolean
  onStart: () => void
  canStart: boolean
  viewport?: Viewport
  isProcessing?: boolean
  phase?: StudioPhase
}

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

/** Unified loading state with icon + spinner ring + bouncing dots */
function LoadingState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Zap
  title: string
  subtitle: string
}) {
  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <div className="text-center space-y-6">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-accent/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
          <Icon className="h-6 w-6 text-accent absolute inset-0 m-auto" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1 w-1 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PreviewFrame({
  url,
  loading,
  onStart,
  canStart,
  viewport = 'desktop',
  isProcessing = false,
  phase,
}: PreviewFrameProps) {
  // Active preview with iframe
  if (url) {
    const width = VIEWPORT_WIDTHS[viewport]
    const isResponsive = viewport !== 'desktop'

    return (
      <div className="flex h-full flex-col bg-[#111115]">
        {/* Browser chrome bar */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-bg-surface/60 px-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex items-center rounded-md bg-bg/80 border border-border/60 px-3 py-1 min-w-[200px] max-w-lg">
              <span className="text-[11px] font-mono text-text-muted/70 truncate">{url}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                const iframe = document.querySelector(
                  'iframe[title="Project Preview"]'
                ) as HTMLIFrameElement
                if (iframe) iframe.src = iframe.src
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted/40 hover:text-text-secondary hover:bg-bg-hover transition-colors"
              title="Reload"
            >
              <RotateCw className="h-3 w-3" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted/40 hover:text-text-secondary hover:bg-bg-hover transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Iframe container — responsive viewport */}
        <div className="flex-1 flex items-start justify-center overflow-auto">
          <div
            className={`h-full bg-white transition-all duration-300 ease-in-out ${
              isResponsive
                ? 'rounded-lg overflow-hidden shadow-2xl shadow-black/40 my-4 mx-4 border border-white/10'
                : ''
            }`}
            style={{
              width,
              maxWidth: '100%',
              ...(isResponsive ? { height: 'calc(100% - 32px)' } : {}),
            }}
          >
            <iframe
              src={url}
              className="h-full w-full border-0"
              title="Project Preview"
            />
          </div>
        </div>
      </div>
    )
  }

  // Processing — building animation
  if (isProcessing) {
    return (
      <LoadingState
        icon={Zap}
        title="Building your app"
        subtitle="AI is generating your project..."
      />
    )
  }

  // Setting up database
  if (loading && phase === 'setting_up_db') {
    return (
      <LoadingState
        icon={Database}
        title="Setting up database"
        subtitle="Running migrations and seeding data..."
      />
    )
  }

  // Loading dev server
  if (loading) {
    return (
      <LoadingState
        icon={Globe}
        title="Starting preview"
        subtitle="Compiling your application..."
      />
    )
  }

  // Project ready but preview not started
  if (canStart) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted border border-accent/20">
            <Globe className="h-6 w-6 text-accent" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-text-primary">Project ready</p>
            <p className="text-xs text-text-muted">Start the dev server to preview your app</p>
          </div>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20"
          >
            <Play className="h-3.5 w-3.5" />
            Start Preview
          </button>
        </div>
      </div>
    )
  }

  // Idle — no project yet
  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <div className="text-center space-y-4 opacity-50">
        <Globe className="h-14 w-14 mx-auto text-text-muted" />
        <p className="text-sm text-text-muted">Enter a prompt to start building</p>
      </div>
    </div>
  )
}

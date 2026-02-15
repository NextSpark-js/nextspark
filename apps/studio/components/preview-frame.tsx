'use client'

import { Loader2, ExternalLink, Globe } from 'lucide-react'

interface PreviewFrameProps {
  url: string | null
  loading: boolean
  onStart: () => void
  canStart: boolean
}

export function PreviewFrame({ url, loading, onStart, canStart }: PreviewFrameProps) {
  if (url) {
    return (
      <div className="flex h-full flex-col">
        {/* Preview header */}
        <div className="flex items-center justify-between border-b border-border bg-bg-surface px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-error" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning" />
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
            </div>
            <span className="text-xs font-mono text-text-muted">{url}</span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        </div>

        {/* iframe */}
        <div className="flex-1 bg-white">
          <iframe
            src={url}
            className="h-full w-full border-0"
            title="Project Preview"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <Globe className="h-10 w-10 text-border mx-auto" />
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting dev server...
          </div>
        ) : canStart ? (
          <>
            <p className="text-sm text-text-muted">Preview your generated project</p>
            <button
              onClick={onStart}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Start Preview
            </button>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            Generate a project first to preview it
          </p>
        )}
      </div>
    </div>
  )
}

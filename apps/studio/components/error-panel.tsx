'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react'
import type { PreviewError } from '@/lib/types'

interface ErrorPanelProps {
  errors: PreviewError[]
  onFixError: (error: PreviewError) => void
  onFixAll: () => void
  onDismiss: () => void
}

export function ErrorPanel({ errors, onFixError, onFixAll, onDismiss }: ErrorPanelProps) {
  const [expanded, setExpanded] = useState(true)

  if (errors.length === 0) return null

  return (
    <div className="flex-shrink-0 border-t border-red-500/20 bg-gradient-to-b from-red-950/40 to-red-950/20">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">
            {errors.length} {errors.length === 1 ? 'error' : 'errors'}
          </span>
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronUp className="h-3 w-3" />
          )}
        </button>

        <div className="flex items-center gap-1">
          {errors.length > 1 && (
            <button
              onClick={onFixAll}
              className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Fix All
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex h-5 w-5 items-center justify-center rounded text-red-400/50 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Error list */}
      {expanded && (
        <div className="max-h-48 overflow-y-auto border-t border-red-500/10 divide-y divide-red-500/10">
          {errors.map((error) => (
            <div key={error.id} className="px-3 py-2 hover:bg-red-500/5 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {error.file && (
                    <p className="text-[10px] font-mono text-red-300/70 truncate">
                      {error.file}
                      {error.line ? `:${error.line}` : ''}
                      {error.column ? `:${error.column}` : ''}
                    </p>
                  )}
                  <p className="text-[11px] text-red-200/90 mt-0.5 line-clamp-2">
                    {error.message}
                  </p>
                </div>
                <button
                  onClick={() => onFixError(error)}
                  className="flex-shrink-0 flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Fix with AI
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

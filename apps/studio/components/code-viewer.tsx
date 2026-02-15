'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, FileCode } from 'lucide-react'

interface CodeViewerProps {
  slug: string
  filePath: string | null
}

export function CodeViewer({ slug, filePath }: CodeViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!filePath || !slug) {
      setContent(null)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/file?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setContent(data.content || data.error || 'Empty file')
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent('Failed to load file')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [slug, filePath])

  async function handleCopy() {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <FileCode className="h-8 w-8 text-border mx-auto" />
          <p className="text-sm text-text-muted">Select a file to view its content</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* File header */}
      <div className="flex items-center justify-between border-b border-border bg-bg-surface px-3 py-2">
        <span className="text-xs font-mono text-text-secondary truncate">{filePath}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-success" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto bg-bg p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
            Loading...
          </div>
        ) : (
          <pre className="text-xs font-mono leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  )
}

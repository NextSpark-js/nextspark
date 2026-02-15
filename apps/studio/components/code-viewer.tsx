'use client'

import { useState, useEffect, useMemo } from 'react'
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

  const lines = useMemo(() => {
    if (!content) return []
    return content.split('\n')
  }, [content])

  const gutterWidth = useMemo(() => {
    const digits = String(lines.length).length
    return Math.max(digits, 2)
  }, [lines.length])

  async function handleCopy() {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3 opacity-25">
          <FileCode className="h-12 w-12 mx-auto text-text-muted" />
          <p className="text-xs text-text-muted">Select a file</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* File path header */}
      <div className="flex h-8 items-center justify-between border-b border-border bg-bg-surface/40 px-3 flex-shrink-0">
        <span className="text-[11px] font-mono text-text-muted truncate">{filePath}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Code with line numbers */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-xs text-text-muted">
            <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-accent" />
            Loading...
          </div>
        ) : (
          <div className="flex font-mono text-[12px] leading-[1.65]">
            {/* Line number gutter */}
            <div className="sticky left-0 flex-shrink-0 select-none border-r border-border bg-bg-surface/30 py-3 text-right">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className="px-3 text-text-muted/30"
                  style={{ minWidth: `${gutterWidth + 2}ch` }}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code content */}
            <pre className="flex-1 py-3 px-4 text-text-secondary overflow-x-auto">
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

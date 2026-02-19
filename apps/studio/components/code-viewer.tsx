'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Copy, Check, FileCode, RotateCw, AlertCircle, ChevronRight } from 'lucide-react'
import { codeToHtml } from 'shiki'

interface CodeViewerProps {
  slug: string
  filePath: string | null
  onNavigateFolder?: (folderPath: string) => void
}

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.html': 'html',
  '.sql': 'sql',
  '.sh': 'bash',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.env': 'bash',
  '.mjs': 'javascript',
  '.mts': 'typescript',
  '.cjs': 'javascript',
  '.prisma': 'prisma',
  '.graphql': 'graphql',
  '.svg': 'xml',
}

function getLang(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.'))
  return EXT_TO_LANG[ext] || 'text'
}

function Breadcrumbs({ path, onNavigateFolder }: { path: string; onNavigateFolder?: (p: string) => void }) {
  const segments = path.split('/')
  const fileName = segments.pop() || ''

  return (
    <div className="flex items-center gap-0 text-[11px] font-mono truncate min-w-0">
      {segments.map((segment, i) => {
        const folderPath = segments.slice(0, i + 1).join('/')
        return (
          <span key={folderPath} className="flex items-center flex-shrink-0">
            {onNavigateFolder ? (
              <button
                onClick={() => onNavigateFolder(folderPath)}
                className="text-text-muted/60 hover:text-accent transition-colors"
              >
                {segment}
              </button>
            ) : (
              <span className="text-text-muted/60">{segment}</span>
            )}
            <ChevronRight className="h-2.5 w-2.5 text-text-muted/30 mx-0.5 flex-shrink-0" />
          </span>
        )
      })}
      <span className="text-text-secondary font-medium truncate">{fileName}</span>
    </div>
  )
}

export function CodeViewer({ slug, filePath, onNavigateFolder }: CodeViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchFile = useCallback(() => {
    if (!filePath || !slug) {
      setContent(null)
      setHighlighted(null)
      setError(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/file?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          if (data.error) {
            setContent(null)
            setError(true)
          } else {
            setContent(data.content || 'Empty file')
            setError(false)
          }
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(null)
          setError(true)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [slug, filePath])

  useEffect(() => {
    return fetchFile()
  }, [fetchFile])

  // Syntax highlighting with shiki
  useEffect(() => {
    if (!content || !filePath) {
      setHighlighted(null)
      return
    }

    let cancelled = false
    const lang = getLang(filePath)

    codeToHtml(content, {
      lang,
      theme: 'github-dark-default',
    })
      .then((html) => {
        if (!cancelled) setHighlighted(html)
      })
      .catch(() => {
        // Fallback: no highlighting
        if (!cancelled) setHighlighted(null)
      })

    return () => { cancelled = true }
  }, [content, filePath])

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
        <div className="text-center space-y-3 opacity-50">
          <FileCode className="h-14 w-14 mx-auto text-text-muted" />
          <p className="text-xs text-text-muted">Select a file from the explorer</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* File path header — breadcrumbs */}
      <div className="sticky top-0 z-10 flex h-8 items-center justify-between border-b border-border bg-bg-surface/40 px-3 flex-shrink-0 backdrop-blur-sm">
        <Breadcrumbs path={filePath} onNavigateFolder={onNavigateFolder} />
        <button
          onClick={handleCopy}
          disabled={!content}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors flex-shrink-0 disabled:opacity-30"
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-xs text-text-muted">
            <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-accent" />
            Loading...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <AlertCircle className="h-8 w-8 text-error/60" />
            <p className="text-xs text-text-muted">Failed to load file</p>
            <button
              onClick={fetchFile}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <RotateCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : highlighted ? (
          <div
            className="shiki-container text-[12px] leading-[1.65] overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
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

            {/* Code content (plaintext fallback) */}
            <pre className="flex-1 py-3 px-4 text-text-secondary overflow-x-auto">
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

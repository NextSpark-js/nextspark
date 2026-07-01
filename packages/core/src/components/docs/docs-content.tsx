'use client'

import { useEffect, useRef } from 'react'
import { renderMermaid } from '../../lib/docs/mermaid'

interface DocsContentProps {
  html: string
}

export function DocsContent({ html }: DocsContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        'pre.mermaid:not([data-processed="true"])'
      )
    )
    if (nodes.length === 0) return

    renderMermaid(nodes).catch((error) => {
      // On failure the raw diagram source stays visible as a fallback.
      console.error('[DocsContent] Failed to render mermaid diagrams:', error)
    })
  }, [html])

  return (
    <div
      ref={containerRef}
      className="docs-content"
      dangerouslySetInnerHTML={{ __html: html }}
      data-cy="docs-content"
    />
  )
}

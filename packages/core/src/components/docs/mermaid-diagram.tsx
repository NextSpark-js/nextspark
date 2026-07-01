'use client'

import { useEffect, useRef } from 'react'
import { renderMermaid } from '../../lib/docs/mermaid'

interface MermaidDiagramProps {
  chart: string
}

/**
 * Renders a single mermaid diagram from its source. Used by React-based
 * markdown renderers (e.g. MarkdownViewer) where a ```mermaid fence maps to a
 * React element rather than to an HTML marker string.
 */
export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    // Feed the raw source as text content; renderMermaid reads it and swaps in
    // the SVG. Clearing data-processed lets it re-render if the chart changes.
    node.removeAttribute('data-processed')
    node.textContent = chart
    renderMermaid([node]).catch((error) => {
      console.error('[MermaidDiagram] Failed to render diagram:', error)
    })
  }, [chart])

  return <pre ref={ref} className="mermaid" />
}

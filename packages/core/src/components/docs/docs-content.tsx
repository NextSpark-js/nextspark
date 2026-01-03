'use client'

interface DocsContentProps {
  html: string
}

export function DocsContent({ html }: DocsContentProps) {
  return (
    <div
      className="docs-content"
      dangerouslySetInnerHTML={{ __html: html }}
      data-cy="docs-content"
    />
  )
}

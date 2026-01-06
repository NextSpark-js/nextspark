/**
 * PageRenderer Component
 *
 * Renders pages from the Page Builder by iterating over blocks
 * and dynamically loading block components from the registry.
 *
 * @module core/components/public/pageBuilder
 */

import { Suspense } from 'react'
import type { BlockInstance } from '../../../types/blocks'
import { getBlockComponent, normalizeBlockProps } from '../../../lib/blocks/loader'

// Loading skeleton for blocks
function BlockSkeleton() {
  return (
    <div className="w-full py-12 px-4 animate-pulse">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 bg-muted rounded w-3/4 mb-4" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
    </div>
  )
}

// Error boundary for individual blocks
function BlockError({ blockSlug }: { blockSlug: string }) {
  return (
    <div className="w-full py-12 px-4 bg-destructive/10 border border-destructive/20 rounded">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-destructive">
          Failed to load block: <code className="font-mono">{blockSlug}</code>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This block may not be available or there was an error rendering it.
        </p>
      </div>
    </div>
  )
}

// Individual block renderer with error boundary
function BlockRenderer({ block }: { block: BlockInstance }) {
  const BlockComponent = getBlockComponent(block.blockSlug)

  if (!BlockComponent) {
    console.warn(`Block component not found for slug: ${block.blockSlug}`)
    return <BlockError blockSlug={block.blockSlug} />
  }

  // Normalize props to convert dot-notation to nested objects
  const normalizedProps = normalizeBlockProps(block.props)

  return (
    <Suspense fallback={<BlockSkeleton />}>
      <BlockComponent {...normalizedProps} />
    </Suspense>
  )
}

export interface PageRendererProps {
  page: {
    id: string
    title: string
    slug: string
    blocks: BlockInstance[]
    locale: string
  }
}

export function PageRenderer({ page }: PageRendererProps) {
  // Ensure blocks is an array
  const blocks = Array.isArray(page.blocks) ? page.blocks : []

  if (blocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold mb-2">{page.title}</h1>
          <p className="text-muted-foreground">
            This page does not have any content yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" data-page-id={page.id} data-page-slug={page.slug}>
      {blocks.map((block) => (
        <div key={block.id} data-block-id={block.id} data-block-slug={block.blockSlug}>
          <BlockRenderer block={block} />
        </div>
      ))}
    </div>
  )
}

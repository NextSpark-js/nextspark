'use client'

import { useEffect, useState, useCallback, Suspense, useMemo, useRef } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { getBlockComponent, normalizeBlockProps } from '@nextsparkjs/core/lib/blocks/loader'
import { isPatternReference } from '@nextsparkjs/core/types/pattern-reference'
import type { BlockInstance } from '@nextsparkjs/core/types/blocks'
import { ChevronUp, ChevronDown, Copy, Trash2 } from 'lucide-react'

/**
 * Block Preview Frame Page
 *
 * This page is designed to be loaded inside an iframe for mobile preview.
 * It receives blocks via postMessage and renders them with full CSS support.
 *
 * The real viewport of the iframe (e.g., 375px) makes CSS media queries
 * respond correctly, unlike just constraining a div's max-width.
 */

interface PreviewState {
  blocks: BlockInstance[]
  selectedBlockId: string | null
  isDark: boolean
}

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

// Empty state
function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[300px] rounded-lg border-2 border-dashed border-border bg-muted/10 m-4">
      <div className="text-center">
        <p className="text-muted-foreground mb-2">No blocks yet</p>
        <p className="text-sm text-muted-foreground">Add blocks from the sidebar</p>
      </div>
    </div>
  )
}

// Floating toolbar for block actions
function BlockToolbar({
  blockId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}: {
  blockId: string
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  return (
    <div className="absolute top-2 left-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        className="h-7 w-7 flex items-center justify-center bg-background border rounded shadow-md hover:bg-accent disabled:opacity-50"
        onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
        disabled={isFirst}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        className="h-7 w-7 flex items-center justify-center bg-background border rounded shadow-md hover:bg-accent disabled:opacity-50"
        onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
        disabled={isLast}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        className="h-7 w-7 flex items-center justify-center bg-background border rounded shadow-md hover:bg-accent"
        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        className="h-7 w-7 flex items-center justify-center bg-background border rounded shadow-md hover:bg-destructive hover:text-destructive-foreground"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// Block renderer component
function BlockRenderer({
  block,
  isSelected,
  isFirst,
  isLast,
  onClick,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}: {
  block: BlockInstance
  isSelected: boolean
  isFirst: boolean
  isLast: boolean
  onClick: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  // Skip pattern references for now
  if (isPatternReference(block)) {
    return (
      <div className="p-4 bg-muted/20 border border-dashed">
        <p className="text-sm text-muted-foreground">Pattern reference: {block.ref}</p>
      </div>
    )
  }

  const BlockComponent = getBlockComponent(block.blockSlug)
  const normalizedProps = useMemo(
    () => normalizeBlockProps(block.props),
    [block.props]
  )

  if (!BlockComponent) {
    return (
      <div className="w-full py-12 px-4 bg-destructive/10 border border-destructive/20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-destructive">
            Block not found: <code className="font-mono">{block.blockSlug}</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-all group',
        'border-2 border-transparent',
        'hover:border-primary/50',
        isSelected && 'border-primary'
      )}
      onClick={onClick}
      data-block-id={block.id}
    >
      {/* Toolbar */}
      <BlockToolbar
        blockId={block.id}
        isFirst={isFirst}
        isLast={isLast}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />

      {/* Editing badge */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-20 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-md">
          Editing
        </div>
      )}

      {/* Block content - pointer events disabled */}
      <div className="pointer-events-none">
        <Suspense fallback={<BlockSkeleton />}>
          <BlockComponent {...normalizedProps} />
        </Suspense>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  const [state, setState] = useState<PreviewState>({
    blocks: [],
    selectedBlockId: null,
    isDark: false,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  // Send message to parent
  const sendToParent = useCallback((message: Record<string, unknown>) => {
    window.parent.postMessage(message, '*')
  }, [])

  // Send content height to parent
  const sendContentHeight = useCallback(() => {
    if (containerRef.current) {
      const height = containerRef.current.scrollHeight
      sendToParent({ type: 'CONTENT_HEIGHT', height })
    }
  }, [sendToParent])

  // Handle incoming messages from parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, ...data } = event.data

      switch (type) {
        case 'UPDATE_BLOCKS':
          setState(prev => ({
            ...prev,
            blocks: data.blocks || [],
            selectedBlockId: data.selectedBlockId ?? prev.selectedBlockId,
          }))
          // Send height after blocks update
          setTimeout(sendContentHeight, 100)
          break

        case 'UPDATE_SELECTION':
          setState(prev => ({
            ...prev,
            selectedBlockId: data.selectedBlockId,
          }))
          break

        case 'UPDATE_THEME':
          setState(prev => ({
            ...prev,
            isDark: data.isDark,
          }))
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sendContentHeight])

  // Apply dark mode class
  useEffect(() => {
    if (state.isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [state.isDark])

  // Send READY message on mount
  useEffect(() => {
    sendToParent({ type: 'READY' })
  }, [sendToParent])

  // Watch for content size changes
  useEffect(() => {
    if (!containerRef.current) return

    resizeObserverRef.current = new ResizeObserver(() => {
      sendContentHeight()
    })

    resizeObserverRef.current.observe(containerRef.current)

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [sendContentHeight])

  // Block action handlers
  const handleBlockClick = useCallback((blockId: string) => {
    sendToParent({ type: 'BLOCK_CLICKED', blockId })
  }, [sendToParent])

  const handleMoveUp = useCallback((blockId: string) => {
    sendToParent({ type: 'BLOCK_MOVE_UP', blockId })
  }, [sendToParent])

  const handleMoveDown = useCallback((blockId: string) => {
    sendToParent({ type: 'BLOCK_MOVE_DOWN', blockId })
  }, [sendToParent])

  const handleDuplicate = useCallback((blockId: string) => {
    sendToParent({ type: 'BLOCK_DUPLICATE', blockId })
  }, [sendToParent])

  const handleRemove = useCallback((blockId: string) => {
    sendToParent({ type: 'BLOCK_REMOVE', blockId })
  }, [sendToParent])

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background"
      data-cy="preview-frame-container"
    >
      {state.blocks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-0">
          {state.blocks.map((block, index) => (
            <BlockRenderer
              key={block.id}
              block={block}
              isSelected={state.selectedBlockId === block.id}
              isFirst={index === 0}
              isLast={index === state.blocks.length - 1}
              onClick={() => handleBlockClick(block.id)}
              onMoveUp={() => handleMoveUp(block.id)}
              onMoveDown={() => handleMoveDown(block.id)}
              onDuplicate={() => handleDuplicate(block.id)}
              onRemove={() => handleRemove(block.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

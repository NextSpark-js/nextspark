'use client'

import { Suspense, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import type { BlockInstance } from '../../../types/blocks'
import { getBlockComponent, normalizeBlockProps } from '../../../lib/blocks/loader'

// Loading skeleton
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

interface BlockPreviewCanvasProps {
  blocks: BlockInstance[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
}

export function BlockPreviewCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onMoveUp,
  onMoveDown,
}: BlockPreviewCanvasProps) {
  if (blocks.length === 0) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px] rounded-lg border-2 border-dashed border-border bg-muted/10"
        data-cy="block-preview-canvas-empty"
      >
        <div className="text-center">
          <p className="text-muted-foreground mb-2">No blocks yet</p>
          <p className="text-sm text-muted-foreground">Add blocks from the left sidebar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0" data-cy="block-preview-canvas">
      {blocks.map((block, index) => (
        <SelectableBlockPreview
          key={block.id}
          block={block}
          isSelected={selectedBlockId === block.id}
          onSelect={() => onSelectBlock(block.id)}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
          onMoveUp={onMoveUp ? () => onMoveUp(block.id) : undefined}
          onMoveDown={onMoveDown ? () => onMoveDown(block.id) : undefined}
        />
      ))}
    </div>
  )
}

interface SelectableBlockPreviewProps {
  block: BlockInstance
  isSelected: boolean
  onSelect: () => void
  isFirst?: boolean
  isLast?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function SelectableBlockPreview({
  block,
  isSelected,
  onSelect,
  isFirst = false,
  isLast = false,
  onMoveUp,
  onMoveDown,
}: SelectableBlockPreviewProps) {
  const BlockComponent = getBlockComponent(block.blockSlug)

  // Memoize normalized props to prevent unnecessary recalculations
  const normalizedProps = useMemo(
    () => normalizeBlockProps(block.props),
    [block.props]
  )

  if (!BlockComponent) {
    return (
      <div
        className="w-full py-12 px-4 bg-destructive/10 border border-destructive/20"
        onClick={onSelect}
      >
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-destructive">
            Block not found: <code className="font-mono">{block.blockSlug}</code>
          </p>
        </div>
      </div>
    )
  }

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMoveUp?.()
  }

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMoveDown?.()
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-all group',
        'hover:ring-2 hover:ring-primary/50 hover:ring-offset-2',
        isSelected && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={onSelect}
      data-cy={`preview-block-${block.id}`}
    >
      {/* Selection indicator label */}
      {isSelected && (
        <div className="absolute top-2 left-2 z-20 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-md">
          Editing
        </div>
      )}

      {/* Reorder controls - visible on hover or when selected */}
      {(onMoveUp || onMoveDown) && (
        <div className={cn(
          'absolute top-2 right-2 z-20 flex gap-1 transition-opacity',
          'opacity-0 group-hover:opacity-100',
          isSelected && 'opacity-100'
        )}>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 shadow-md"
            onClick={handleMoveUp}
            disabled={isFirst}
            data-cy={`preview-block-${block.id}-move-up`}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 shadow-md"
            onClick={handleMoveDown}
            disabled={isLast}
            data-cy={`preview-block-${block.id}-move-down`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Block content - pointer events disabled to prevent internal links from navigating */}
      <div className="pointer-events-none">
        <Suspense fallback={<BlockSkeleton />}>
          <BlockComponent {...normalizedProps} />
        </Suspense>
      </div>
    </div>
  )
}

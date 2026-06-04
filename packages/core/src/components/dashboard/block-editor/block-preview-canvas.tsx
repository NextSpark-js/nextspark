'use client'

import { Suspense, useMemo, useState, memo, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { FloatingBlockToolbar } from './floating-block-toolbar'
import type { BlockInstance } from '../../../types/blocks'
import { getBlockComponent, normalizeBlockProps } from '../../../lib/blocks/loader'
import { isPatternReference } from '../../../types/pattern-reference'
import { PatternReferencePreview } from './pattern-reference-preview'

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
  selectedBlockIds: Set<string>
  onSelectBlock: (id: string, event?: { metaKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean }) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  onCopy?: (id: string) => void
  onDuplicate?: (id: string) => void
  onRemove?: (id: string) => void
}

export function BlockPreviewCanvas({
  blocks,
  selectedBlockIds,
  onSelectBlock,
  onMoveUp,
  onMoveDown,
  onCopy,
  onDuplicate,
  onRemove,
}: BlockPreviewCanvasProps) {
  const t = useTranslations('admin.builder')
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null)
  const isMultiSelect = selectedBlockIds.size > 1

  // Memoized callbacks to prevent re-renders of child components
  const handleHover = useCallback((id: string) => setHoveredBlockId(id), [])
  const handleLeave = useCallback(() => setHoveredBlockId(null), [])

  if (blocks.length === 0) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px] rounded-lg border-2 border-dashed border-border bg-muted/10"
        data-cy={sel('blockEditor.previewCanvas.empty')}
      >
        <div className="text-center">
          <p className="text-muted-foreground mb-2">{t('canvas.empty.title')}</p>
          <p className="text-sm text-muted-foreground">{t('canvas.empty.subtitle')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0" data-cy={sel('blockEditor.previewCanvas.container')}>
      {blocks.map((block, index) => (
        <SelectableBlockPreview
          key={block.id || `block-${index}`}
          block={block}
          isSelected={selectedBlockIds.has(block.id)}
          isMultiSelect={isMultiSelect}
          isHovered={hoveredBlockId === block.id}
          onSelect={onSelectBlock}
          blockId={block.id}
          onHover={handleHover}
          onLeave={handleLeave}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onCopy={onCopy}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

interface SelectableBlockPreviewProps {
  block: BlockInstance
  blockId: string
  isSelected: boolean
  isMultiSelect: boolean
  isHovered: boolean
  onSelect: (id: string, event?: { metaKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean }) => void
  onHover: (id: string) => void
  onLeave: () => void
  isFirst?: boolean
  isLast?: boolean
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  onCopy?: (id: string) => void
  onDuplicate?: (id: string) => void
  onRemove?: (id: string) => void
}

const SelectableBlockPreview = memo(function SelectableBlockPreview({
  block,
  blockId,
  isSelected,
  isMultiSelect,
  isHovered,
  onSelect,
  onHover,
  onLeave,
  isFirst = false,
  isLast = false,
  onMoveUp,
  onMoveDown,
  onCopy,
  onDuplicate,
  onRemove,
}: SelectableBlockPreviewProps) {
  const t = useTranslations('admin.builder')

  // Forward click event modifiers for multi-select
  const handleSelect = useCallback((e: React.MouseEvent) => {
    onSelect(blockId, { metaKey: e.metaKey, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey })
  }, [onSelect, blockId])
  const handleHover = useCallback(() => onHover(blockId), [onHover, blockId])
  const handleMoveUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onMoveUp?.(blockId)
  }, [onMoveUp, blockId])
  const handleMoveDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onMoveDown?.(blockId)
  }, [onMoveDown, blockId])
  const handleCopy = useCallback(() => onCopy?.(blockId), [onCopy, blockId])
  const handleDuplicate = useCallback(() => onDuplicate?.(blockId), [onDuplicate, blockId])
  const handleRemove = useCallback(() => onRemove?.(blockId), [onRemove, blockId])

  // Check if this is a pattern reference
  if (isPatternReference(block)) {
    return (
      <div
        className="relative group"
        onMouseEnter={handleHover}
        onMouseLeave={onLeave}
      >
        {/* Reorder controls for pattern reference - same as regular blocks */}
        {(onMoveUp || onMoveDown) && (
          <div className={cn(
            'absolute top-2 left-2 z-30 flex gap-1 transition-opacity',
            'opacity-0 group-hover:opacity-100',
            isSelected && 'opacity-100'
          )}>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 shadow-md"
              onClick={handleMoveUp}
              disabled={isFirst}
              data-cy={sel('blockEditor.previewCanvas.moveUp', { id: block.id })}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 shadow-md"
              onClick={handleMoveDown}
              disabled={isLast}
              data-cy={sel('blockEditor.previewCanvas.moveDown', { id: block.id })}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        <PatternReferencePreview
          patternRef={block}
          isSelected={isSelected}
          onSelect={() => onSelect(blockId)}
          onRemove={handleRemove}
        />
      </div>
    )
  }

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
        onClick={handleSelect}
      >
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-destructive">
            {t('canvas.error.blockNotFound')}: <code className="font-mono">{block.blockSlug}</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-[border-color] duration-150 group @container',
        'border-2 border-transparent',
        'hover:border-primary/50',
        isSelected && !isMultiSelect && 'border-primary',
        isSelected && isMultiSelect && 'border-primary/70 bg-primary/5'
      )}
      onClick={handleSelect}
      onMouseEnter={handleHover}
      onMouseLeave={onLeave}
      data-cy={sel('blockEditor.previewCanvas.block', { id: block.id })}
    >
      {/* Floating Toolbar - visible on hover or single selection */}
      {(onDuplicate && onRemove) && !isMultiSelect && (
        <FloatingBlockToolbar
          blockId={block.id}
          blockSlug={block.blockSlug}
          isVisible={isHovered || isSelected}
          onCopy={handleCopy}
          onDuplicate={handleDuplicate}
          onRemove={handleRemove}
        />
      )}

      {/* Editing Badge / Multi-select check */}
      {isSelected && (
        <div
          className={cn(
            "absolute top-2 right-2 z-20 text-xs px-2 py-1 rounded shadow-md",
            isMultiSelect
              ? "bg-primary/80 text-primary-foreground"
              : "bg-primary text-primary-foreground"
          )}
          data-cy={sel('blockEditor.previewCanvas.editingBadge', { id: block.id })}
        >
          {isMultiSelect ? '✓' : t('canvas.editingBadge')}
        </div>
      )}

      {/* Legacy Reorder controls - visible on hover or when selected (kept for backward compatibility) */}
      {(onMoveUp || onMoveDown) && (
        <div className={cn(
          'absolute top-2 left-2 z-20 flex gap-1 transition-opacity',
          'opacity-0 group-hover:opacity-100',
          isSelected && 'opacity-100'
        )}>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 shadow-md"
            onClick={handleMoveUp}
            disabled={isFirst}
            data-cy={sel('blockEditor.previewCanvas.moveUp', { id: block.id })}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 shadow-md"
            onClick={handleMoveDown}
            disabled={isLast}
            data-cy={sel('blockEditor.previewCanvas.moveDown', { id: block.id })}
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
})

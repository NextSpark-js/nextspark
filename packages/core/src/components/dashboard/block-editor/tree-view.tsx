'use client'

import { useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useTranslations } from 'next-intl'
import { LayoutList } from 'lucide-react'
import { ScrollArea } from '../../ui/scroll-area'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { TreeViewNode } from './tree-view-node'
import { isPatternReference, type PatternReference } from '../../../types/pattern-reference'
import type { BlockInstance } from '../../../types/blocks'

interface TreeViewProps {
  blocks: (BlockInstance | PatternReference)[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onReorder: (blocks: (BlockInstance | PatternReference)[]) => void
  emptyMessage?: string
}

/**
 * TreeView component for the Layout tab in the left sidebar.
 * Displays a tree structure of all blocks with drag & drop reordering.
 * Clicking a block selects it and scrolls to it in the preview.
 */
export function TreeView({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onReorder,
  emptyMessage
}: TreeViewProps) {
  const t = useTranslations('admin.builder')

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Group blocks by pattern reference (for visual grouping)
  const groupedItems = useMemo(() => {
    const items: Array<{
      id: string
      block: BlockInstance | PatternReference
      patternRef?: string
    }> = []

    blocks.forEach(block => {
      if (isPatternReference(block)) {
        // Pattern references are shown with their ref for grouping
        items.push({ id: block.id, block, patternRef: block.ref })
      } else {
        items.push({ id: block.id, block })
      }
    })

    return items
  }, [blocks])

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id)
      const newIndex = blocks.findIndex(b => b.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newBlocks = arrayMove(blocks, oldIndex, newIndex)
        onReorder(newBlocks)
      }
    }
  }, [blocks, onReorder])

  // Handle block selection with scroll
  const handleSelectBlock = useCallback((blockId: string) => {
    onSelectBlock(blockId)

    // Scroll to block in preview (with small delay for state update)
    setTimeout(() => {
      const previewBlock = document.querySelector(`[data-cy="preview-block-${blockId}"]`)
      if (previewBlock) {
        previewBlock.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 50)
  }, [onSelectBlock])

  // Empty state
  if (blocks.length === 0) {
    return (
      <div
        data-cy={sel('blockEditor.treeView.empty')}
        className="flex flex-col items-center justify-center h-full p-6 text-center"
      >
        <LayoutList className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">
          {emptyMessage || t('layout.empty')}
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div
        data-cy={sel('blockEditor.treeView.container')}
        className="p-3 space-y-1"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={groupedItems.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {groupedItems.map((item) => (
              <TreeViewNode
                key={item.id}
                block={item.block}
                isSelected={selectedBlockId === item.id}
                onSelect={() => handleSelectBlock(item.id)}
                isPartOfPattern={false}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </ScrollArea>
  )
}

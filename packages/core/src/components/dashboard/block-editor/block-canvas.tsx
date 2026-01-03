'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableBlock } from './sortable-block'
import type { BlockInstance } from '../../../types/blocks'

interface BlockCanvasProps {
  blocks: BlockInstance[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onRemoveBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
  onReorder: (blocks: BlockInstance[]) => void
  onUpdateProps: (blockId: string, props: Record<string, unknown>) => void
  onAddBlock: (blockSlug: string) => void
}

export function BlockCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  onDuplicateBlock,
  onReorder,
  onAddBlock,
}: BlockCanvasProps) {
  const t = useTranslations('admin.blockEditor.canvas')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    if (active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id)
      const newIndex = blocks.findIndex(b => b.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(blocks, oldIndex, newIndex))
      }
    }
  }, [blocks, onReorder])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const blockSlug = e.dataTransfer.getData('blockSlug')
    if (blockSlug) {
      onAddBlock(blockSlug)
    }
  }, [onAddBlock])

  if (blocks.length === 0) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px] rounded-lg border-2 border-dashed border-border bg-muted/10"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        data-cy="block-canvas-empty"
      >
        <div className="text-center">
          <p className="text-muted-foreground mb-2">{t('empty.message')}</p>
          <p className="text-sm text-muted-foreground">{t('empty.hint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div data-cy="block-canvas">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onRemove={() => onRemoveBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

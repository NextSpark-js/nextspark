'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { BlockService } from '../../../lib/services/block.service'
import { DynamicIcon } from '../../ui/dynamic-icon'
import type { BlockInstance } from '../../../types/blocks'
import { isPatternReference, type PatternReference } from '../../../types/pattern-reference'

interface TreeViewNodeProps {
  block: BlockInstance | PatternReference
  isSelected: boolean
  onSelect: () => void
  isPartOfPattern?: boolean
}

export function TreeViewNode({
  block,
  isSelected,
  onSelect,
  isPartOfPattern = false
}: TreeViewNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: block.id,
    disabled: isPartOfPattern // Disable individual dragging for pattern blocks
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Get block config for icon and name
  const blockConfig = isPatternReference(block)
    ? null
    : BlockService.get(block.blockSlug)

  const iconName = blockConfig?.icon || 'LayoutGrid'
  const blockName = blockConfig?.name || (isPatternReference(block) ? 'Pattern' : 'Unknown Block')

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-cy={sel('blockEditor.treeView.node', { id: block.id })}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
        'hover:bg-muted/80',
        isSelected && 'bg-primary/10 ring-1 ring-primary',
        isPartOfPattern && 'ml-4 border-l-2 border-muted-foreground/20',
        isDragging && 'z-50'
      )}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      {!isPartOfPattern && (
        <div
          data-cy={sel('blockEditor.treeView.nodeDragHandle', { id: block.id })}
          className={cn(
            'cursor-grab active:cursor-grabbing text-muted-foreground/50',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            isSelected && 'opacity-100'
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* Block Icon */}
      <div
        data-cy={sel('blockEditor.treeView.nodeIcon', { id: block.id })}
        className="text-muted-foreground shrink-0"
      >
        <DynamicIcon name={iconName} className="h-4 w-4" />
      </div>

      {/* Block Name */}
      <span
        data-cy={sel('blockEditor.treeView.nodeName', { id: block.id })}
        className={cn(
          'text-sm truncate flex-1',
          isSelected && 'font-medium'
        )}
      >
        {blockName}
      </span>
    </div>
  )
}

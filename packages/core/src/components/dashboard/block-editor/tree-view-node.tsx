'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ClipboardCopy, Copy, Trash2, Check } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { BlockService } from '../../../lib/services/block.service'
import { DynamicIcon } from '../../ui/dynamic-icon'
import type { BlockInstance } from '../../../types/blocks'
import { isPatternReference, type PatternReference } from '../../../types/pattern-reference'

interface TreeViewNodeProps {
  block: BlockInstance | PatternReference
  isSelected: boolean
  isMultiSelect?: boolean
  onSelect: (event?: { metaKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean }) => void
  onCopy?: () => void
  onDuplicate?: () => void
  onRemove?: () => void
  isPartOfPattern?: boolean
}

export function TreeViewNode({
  block,
  isSelected,
  isMultiSelect = false,
  onSelect,
  onCopy,
  onDuplicate,
  onRemove,
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
        isSelected && !isMultiSelect && 'bg-primary/10 ring-1 ring-primary',
        isSelected && isMultiSelect && 'bg-primary/10 ring-1 ring-primary/70',
        isPartOfPattern && 'ml-4 border-l-2 border-muted-foreground/20',
        isDragging && 'z-50'
      )}
      onClick={(e) => onSelect({ metaKey: e.metaKey, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey })}
    >
      {/* Multi-select checkbox */}
      {isMultiSelect && !isPartOfPattern && (
        <div
          className={cn(
            'flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-colors',
            isSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/30 hover:border-primary'
          )}
          data-cy={sel('blockEditor.treeView.nodeCheckbox', { id: block.id })}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </div>
      )}

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

      {/* Actions - visible on hover */}
      {(onCopy || onDuplicate || onRemove) && (
        <div
          className={cn(
            'flex items-center gap-0.5 shrink-0 transition-opacity',
            'opacity-0 group-hover:opacity-100',
            isSelected && 'opacity-100'
          )}
        >
          {onCopy && (
            <button
              data-cy={sel('blockEditor.treeView.nodeCopy', { id: block.id })}
              className="p-1 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onCopy()
              }}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
            </button>
          )}
          {onDuplicate && (
            <button
              data-cy={sel('blockEditor.treeView.nodeDuplicate', { id: block.id })}
              className="p-1 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
          {onRemove && (
            <button
              data-cy={sel('blockEditor.treeView.nodeRemove', { id: block.id })}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

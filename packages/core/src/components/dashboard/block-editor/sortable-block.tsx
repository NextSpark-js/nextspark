'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
import { Card, CardContent } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { GripVertical, Copy, Trash2 } from 'lucide-react'
import type { BlockInstance } from '../../../types/blocks'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

interface SortableBlockProps {
  block: BlockInstance
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  onDuplicate: () => void
}

export function SortableBlock({
  block,
  isSelected,
  onSelect,
  onRemove,
  onDuplicate,
}: SortableBlockProps) {
  const t = useTranslations('admin.blockEditor.block')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const blockConfig = BLOCK_REGISTRY[block.blockSlug]

  if (!blockConfig) {
    return (
      <Card className="border-destructive" data-cy={sel('blockEditor.layoutCanvas.sortableBlock.error', { id: block.id })}>
        <CardContent className="p-4">
          <p className="text-destructive text-sm">
            {t('error.notFound', { slug: block.blockSlug })}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative',
        isDragging && 'opacity-50',
      )}
      data-cy={sel('blockEditor.layoutCanvas.sortableBlock.container', { id: block.id })}
    >
      <Card
        className={cn(
          'cursor-pointer transition-all',
          isSelected && 'ring-2 ring-primary ring-offset-2',
          'hover:shadow-md'
        )}
        onClick={onSelect}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-primary rounded p-1"
              data-cy={sel('blockEditor.layoutCanvas.sortableBlock.dragHandle', { id: block.id })}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Block Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-sm">{blockConfig.name}</h4>
                <Badge variant="outline" className="text-xs capitalize">
                  {blockConfig.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {blockConfig.description}
              </p>

              {/* Block Props Preview */}
              {Object.keys(block.props).length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(block.props).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-mono truncate max-w-[100px]">
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                    {Object.keys(block.props).length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{Object.keys(block.props).length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
                data-cy={sel('blockEditor.layoutCanvas.sortableBlock.duplicateBtn', { id: block.id })}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="text-destructive hover:text-destructive"
                data-cy={sel('blockEditor.layoutCanvas.sortableBlock.removeBtn', { id: block.id })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

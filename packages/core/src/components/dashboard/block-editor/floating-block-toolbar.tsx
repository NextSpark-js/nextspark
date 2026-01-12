'use client'

import { GripVertical, Copy, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'

interface FloatingBlockToolbarProps {
  blockId: string
  blockSlug: string
  isVisible: boolean
  onDuplicate: () => void
  onRemove: () => void
}

/**
 * Floating toolbar that appears above blocks in preview mode
 * Provides quick access to block actions: drag, duplicate, delete
 */
export function FloatingBlockToolbar({
  blockId,
  blockSlug,
  isVisible,
  onDuplicate,
  onRemove,
}: FloatingBlockToolbarProps) {
  const t = useTranslations('admin.builder.floatingToolbar')
  const blockConfig = BLOCK_REGISTRY[blockSlug]
  const blockName = blockConfig?.name || blockSlug

  return (
    <div
      className={cn(
        'absolute -top-3 left-1/2 -translate-x-1/2 z-10',
        'bg-primary text-primary-foreground rounded-full',
        'px-3 py-1 text-xs font-medium shadow-lg',
        'flex items-center gap-3',
        'transition-all duration-200',
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-2 pointer-events-none'
      )}
      data-cy={sel('blockEditor.floatingToolbar.container', { id: blockId })}
    >
      {/* Drag Handle */}
      <span
        className="cursor-grab active:cursor-grabbing"
        data-cy={sel('blockEditor.floatingToolbar.dragHandle', { id: blockId })}
        title={t('drag')}
      >
        <GripVertical className="h-3 w-3" />
      </span>

      {/* Block Name */}
      <span
        className="uppercase tracking-wider text-[10px]"
        data-cy={sel('blockEditor.floatingToolbar.blockName', { id: blockId })}
      >
        {blockName}
      </span>

      {/* Divider */}
      <div
        className="h-3 w-px bg-primary-foreground/30"
        data-cy={sel('blockEditor.floatingToolbar.divider', { id: blockId })}
      />

      {/* Actions */}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 hover:bg-primary-foreground/20 text-primary-foreground"
        onClick={(e) => {
          e.stopPropagation()
          onDuplicate()
        }}
        data-cy={sel('blockEditor.floatingToolbar.duplicateBtn', { id: blockId })}
        title={t('duplicate')}
      >
        <Copy className="h-3 w-3" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 hover:bg-destructive/20 text-primary-foreground"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        data-cy={sel('blockEditor.floatingToolbar.deleteBtn', { id: blockId })}
        title={t('delete')}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

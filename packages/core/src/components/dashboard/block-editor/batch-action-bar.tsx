'use client'

import { Copy, CopyPlus, Trash2, ClipboardPaste, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

interface BatchActionBarProps {
  selectedCount: number
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClearSelection: () => void
  clipboardCount: number
  onPaste: () => void
}

export function BatchActionBar({
  selectedCount,
  onCopy,
  onDuplicate,
  onDelete,
  onClearSelection,
  clipboardCount,
  onPaste,
}: BatchActionBarProps) {
  const t = useTranslations('admin.builder.multiSelect')

  return (
    <div
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 z-30',
        'bg-primary text-primary-foreground rounded-full',
        'px-4 py-2 shadow-lg',
        'flex items-center gap-3',
        'animate-in slide-in-from-bottom-4 fade-in duration-200'
      )}
      data-cy={sel('blockEditor.batchActionBar.container')}
    >
      <span className="text-sm font-medium whitespace-nowrap" data-cy={sel('blockEditor.batchActionBar.count')}>
        {t('selected', { count: selectedCount })}
      </span>

      <div className="h-4 w-px bg-primary-foreground/30" />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-primary-foreground/20 text-primary-foreground"
        onClick={onCopy}
        title={t('copy')}
        data-cy={sel('blockEditor.batchActionBar.copy')}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>

      {clipboardCount > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-primary-foreground/20 text-primary-foreground"
          onClick={onPaste}
          title={t('paste')}
          data-cy={sel('blockEditor.batchActionBar.paste')}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-primary-foreground/20 text-primary-foreground"
        onClick={onDuplicate}
        title={t('duplicate')}
        data-cy={sel('blockEditor.batchActionBar.duplicate')}
      >
        <CopyPlus className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-destructive/80 text-primary-foreground"
        onClick={onDelete}
        title={t('delete')}
        data-cy={sel('blockEditor.batchActionBar.delete')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-primary-foreground/30" />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-primary-foreground/20 text-primary-foreground"
        onClick={onClearSelection}
        title={t('deselectAll')}
        data-cy={sel('blockEditor.batchActionBar.deselect')}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

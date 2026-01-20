'use client'

import { AlertTriangle, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '../ui/button'
import { sel } from '@nextsparkjs/core/lib/test'

interface DeletedPatternPlaceholderProps {
  /**
   * ID of the deleted pattern (for debugging/logging)
   */
  patternId: string
  /**
   * Callback to remove this orphaned reference from the blocks array
   */
  onRemove: () => void
}

/**
 * DeletedPatternPlaceholder
 *
 * Displayed in the editor when a PatternReference points to a deleted pattern.
 * Part of the "Lazy Cleanup" strategy:
 * - Patterns can be deleted without updating all entities
 * - Editor shows this placeholder instead of the missing pattern
 * - User can click "Remove" or simply save the page to clean up the reference
 *
 * @example
 * // In BlockEditor or similar component:
 * if (isPatternReference(block) && !patternExists(block.ref)) {
 *   return (
 *     <DeletedPatternPlaceholder
 *       patternId={block.ref}
 *       onRemove={() => removeBlock(block.id)}
 *     />
 *   )
 * }
 */
export function DeletedPatternPlaceholder({
  patternId,
  onRemove
}: DeletedPatternPlaceholderProps) {
  const t = useTranslations('admin.patterns.placeholder')

  return (
    <div
      className="flex items-center gap-3 p-4 border border-dashed border-destructive/50 rounded-lg bg-destructive/5"
      data-cy={sel('patterns.placeholder.container')}
      data-pattern-id={patternId}
    >
      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-destructive">{t('title')}</p>
        <p className="text-xs text-muted-foreground truncate">
          {t('description')}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
        data-cy={sel('patterns.placeholder.removeBtn')}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {t('remove')}
      </Button>
    </div>
  )
}

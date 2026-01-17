'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@nextsparkjs/core/components/ui/alert-dialog'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { usePatternUsages } from '@nextsparkjs/core/hooks/usePatternUsages'

interface PatternDeleteDialogProps {
  /** The ID of the pattern to delete */
  patternId: string
  /** The display title of the pattern */
  patternTitle: string
  /** Callback when delete is confirmed */
  onConfirm: () => void
  /** Custom trigger element (defaults to a delete button) */
  trigger?: React.ReactNode
  /** Whether the delete action is in progress */
  isDeleting?: boolean
}

/**
 * PatternDeleteDialog
 *
 * A delete confirmation dialog that shows affected entities before deletion.
 * Uses lazy loading - only fetches usage data when the dialog is opened.
 *
 * Features:
 * - Lazy-loads usage data on dialog open
 * - Shows list of affected entities (first 10)
 * - Warns about orphaned references
 * - Handles loading and error states
 * - Full i18n support
 *
 * @example
 * ```tsx
 * <PatternDeleteDialog
 *   patternId="pat-123"
 *   patternTitle="Hero Section"
 *   onConfirm={handleDelete}
 * />
 * ```
 */
export function PatternDeleteDialog({
  patternId,
  patternTitle,
  onConfirm,
  trigger,
  isDeleting = false,
}: PatternDeleteDialogProps) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('admin.patterns.delete')

  // Lazy fetch: only enabled when dialog is open
  const { data, isLoading, error } = usePatternUsages(patternId, {
    enabled: open,
    limit: 10,
  })

  const usageCount = data?.total ?? 0
  const usages = data?.usages ?? []

  const handleConfirm = () => {
    onConfirm()
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            data-cy="pattern-delete-trigger"
          >
            {t('trigger')}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent data-cy="pattern-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {t('confirm')}{' '}
                <strong className="text-foreground">"{patternTitle}"</strong>?
              </p>

              {isLoading ? (
                <div
                  className="flex items-center gap-2 text-muted-foreground"
                  data-cy="pattern-delete-loading"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loading')}
                </div>
              ) : error ? (
                <div
                  className="text-sm text-destructive"
                  data-cy="pattern-delete-error"
                >
                  {t('error')}
                </div>
              ) : usageCount > 0 ? (
                <div
                  className="rounded-md border border-destructive/20 bg-destructive/5 p-3"
                  data-cy="pattern-delete-warning"
                >
                  <p className="font-medium text-destructive">
                    {t('inUse', { count: usageCount })}
                  </p>
                  <ul
                    className="mt-2 space-y-1 text-sm text-muted-foreground"
                    data-cy="pattern-delete-usage-list"
                  >
                    {usages.map((usage) => (
                      <li key={usage.entityId}>
                        • {usage.entityTitle || usage.entitySlug || usage.entityId} (
                        {usage.entityType})
                      </li>
                    ))}
                    {usageCount > 10 && (
                      <li className="text-muted-foreground/70">
                        {t('moreItems', { count: usageCount - 10 })}
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('cleanupNote')}
                  </p>
                </div>
              ) : (
                <p
                  className="text-muted-foreground"
                  data-cy="pattern-delete-no-usage"
                >
                  {t('notInUse')}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-cy="pattern-delete-cancel">
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-cy="pattern-delete-confirm"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('deleting')}
              </>
            ) : (
              t('deleteAction')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

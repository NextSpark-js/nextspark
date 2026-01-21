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
import { sel } from '@nextsparkjs/core/lib/test'

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
  /** Controlled open state (optional - for external control) */
  open?: boolean
  /** Callback when open state changes (optional - for external control) */
  onOpenChange?: (open: boolean) => void
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
  open: controlledOpen,
  onOpenChange,
}: PatternDeleteDialogProps) {
  // Internal state for uncontrolled mode
  const [internalOpen, setInternalOpen] = useState(false)

  // Use controlled or uncontrolled mode
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen

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

  // In controlled mode without trigger, don't render trigger
  const showTrigger = !isControlled || trigger

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <AlertDialogTrigger asChild>
          {trigger ?? (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              data-cy={sel('patterns.deleteDialog.trigger')}
            >
              {t('trigger')}
            </Button>
          )}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent data-cy={sel('patterns.deleteDialog.container')}>
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
                  data-cy={sel('patterns.deleteDialog.loading')}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loading')}
                </div>
              ) : error ? (
                <div
                  className="text-sm text-destructive"
                  data-cy={sel('patterns.deleteDialog.error')}
                >
                  {t('error')}
                </div>
              ) : usageCount > 0 ? (
                <div
                  className="rounded-md border border-destructive/20 bg-destructive/5 p-3"
                  data-cy={sel('patterns.deleteDialog.warning')}
                >
                  <p className="font-medium text-destructive">
                    {t('inUse', { count: usageCount })}
                  </p>
                  <ul
                    className="mt-2 space-y-1 text-sm text-muted-foreground"
                    data-cy={sel('patterns.deleteDialog.usageList')}
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
                  data-cy={sel('patterns.deleteDialog.noUsage')}
                >
                  {t('notInUse')}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-cy={sel('patterns.deleteDialog.cancel')}>
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-cy={sel('patterns.deleteDialog.confirm')}
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

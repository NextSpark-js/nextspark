'use client'

/**
 * EntityDetailHeader Component
 *
 * Universal header for entity pages (view, edit, create).
 * Features:
 * - Back button with navigation
 * - Title with mode-aware resolution
 * - Copyable ID with visual feedback (view/edit modes only)
 * - Badges slot for status, type, etc. (view/edit modes only)
 * - Created/Updated dates display (view mode only)
 * - Edit/Delete action buttons with permission control (view mode only)
 * - AlertDialog for delete confirmation
 * - Custom actions slot
 *
 * Based on team-manager EntityDetailHeader, adapted for core entity system.
 */

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
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
} from '../ui/alert-dialog'
import { CopyableId } from '../shared/CopyableId'
import { sel } from '../../lib/test'
import { usePermissions } from '../../lib/permissions/hooks'
import type { EntityConfig } from '../../lib/entities/types'
import type { Permission } from '../../lib/permissions/types'

export interface EntityDetailHeaderProps {
  /** Entity configuration */
  entityConfig: EntityConfig

  /** Page mode - determines which features are shown */
  mode?: 'view' | 'edit' | 'create'

  /** Entity data (optional for create mode) */
  entity?: {
    id: string
    createdAt?: string
    updatedAt?: string
    title?: string
    name?: string
    displayName?: string
    [key: string]: unknown
  }

  /** Custom title override */
  title?: string
  /** Custom back URL (default: /dashboard/{entityConfig.slug}) */
  backHref?: string
  /** Custom back label (default: entityConfig.names.plural) */
  backLabel?: string

  /** Delete dialog title */
  deleteTitle?: string
  /** Delete dialog description */
  deleteDescription?: string

  /** Badges slot for status, type indicators (view/edit modes only) */
  badges?: React.ReactNode

  /** Whether to show created/updated dates (default: true, only in view mode) */
  showDates?: boolean

  /** Edit handler - if not provided, navigates to {backHref}/{id}/edit */
  onEdit?: () => void
  /** Delete handler - triggers AlertDialog confirmation */
  onDelete?: () => Promise<void>

  /** Permission overrides (default: checks {slug}.update and {slug}.delete) */
  canEdit?: boolean
  canDelete?: boolean

  /** Loading state for delete action */
  isDeleting?: boolean

  /** Custom action buttons to render before Edit/Delete */
  customActions?: React.ReactNode

  /** Optional className */
  className?: string
}

function formatDate(dateString?: string): string | null {
  if (!dateString) return null
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

export function EntityDetailHeader({
  entityConfig,
  mode = 'view',
  entity,
  title,
  backHref,
  backLabel,
  deleteTitle,
  deleteDescription,
  badges,
  showDates = true,
  onEdit,
  onDelete,
  canEdit: canEditProp,
  canDelete: canDeleteProp,
  isDeleting = false,
  customActions,
  className,
}: EntityDetailHeaderProps) {
  const router = useRouter()
  const tButtons = useTranslations('buttons')
  const tEntities = useTranslations('entities')

  const slug = entityConfig.slug

  // Check permissions (with prop overrides) - only relevant for view mode
  const { canUpdate, canDelete: canDeletePermission } = usePermissions({
    canUpdate: `${slug}.update` as Permission,
    canDelete: `${slug}.delete` as Permission,
  })

  const effectiveCanEdit = canEditProp ?? canUpdate
  const effectiveCanDelete = canDeleteProp ?? canDeletePermission

  // Resolve title based on mode
  const resolvedTitle = (() => {
    if (title) return title

    switch (mode) {
      case 'create':
        return tEntities('actions.create', { entity: entityConfig.names.singular })
      case 'edit':
        return entity?.title as string ||
          entity?.name as string ||
          tEntities('actions.edit', { entity: entityConfig.names.singular })
      case 'view':
      default:
        return entity?.title as string ||
          entity?.name as string ||
          entity?.displayName as string ||
          entityConfig.names.singular
    }
  })()

  // Resolve back navigation
  // In edit mode, default back to detail view; in view/create, default to list
  const defaultBackHref = mode === 'edit' && entity?.id
    ? `/dashboard/${slug}/${entity.id}`
    : `/dashboard/${slug}`
  const resolvedBackHref = backHref ?? defaultBackHref
  const resolvedBackLabel = backLabel ?? entityConfig.names.plural

  const handleEdit = () => {
    if (onEdit) {
      onEdit()
    } else if (entity?.id) {
      router.push(`${resolvedBackHref}/${entity.id}/edit`)
    }
  }

  const handleBack = () => {
    router.push(resolvedBackHref)
  }

  // Determine what to show based on mode
  const showActions = mode === 'view'
  const showId = mode !== 'create' && entity?.id
  const showDatesSection = mode === 'view' && showDates && entity && (entity.createdAt || entity.updatedAt)
  const showBadges = mode !== 'create' && badges

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${className || ''}`}
      data-cy={sel('entities.header.container', { slug, mode })}
    >
      {/* Left side: Back + Title */}
      <div className="space-y-2 flex-1">
        <div className="flex items-start justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2 -ml-2 cursor-pointer"
            data-cy={sel('entities.header.backButton', { slug })}
          >
            <ArrowLeft className="h-4 w-4" />
            {resolvedBackLabel}
          </Button>

          {/* Action buttons - top right (view mode only) */}
          <div className="flex items-center gap-2">
            {customActions}

            {showActions && effectiveCanEdit && (
              <Button
                variant="outline"
                onClick={handleEdit}
                className="gap-2 cursor-pointer"
                data-cy={sel('entities.header.editButton', { slug })}
              >
                <Edit className="h-4 w-4" />
                {tButtons('edit')}
              </Button>
            )}

            {showActions && effectiveCanDelete && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive border-destructive hover:bg-destructive/10 cursor-pointer"
                    data-cy={sel('entities.header.deleteButton', { slug })}
                  >
                    <Trash2 className="h-4 w-4" />
                    {tButtons('delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-cy={sel('entities.header.deleteDialog', { slug })}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {deleteTitle || tButtons('delete')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {deleteDescription || `Are you sure you want to delete "${resolvedTitle}"? This action cannot be undone.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-cy={sel('entities.header.deleteCancel', { slug })}>
                      {tButtons('cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-cy={sel('entities.header.deleteConfirm', { slug })}
                    >
                      {isDeleting ? '...' : tButtons('delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <h1
          className="text-2xl font-bold text-foreground"
          data-cy={sel('entities.header.title', { slug })}
        >
          {resolvedTitle}
        </h1>

        {/* Badges + ID (left) and Dates (right) - conditional based on mode */}
        {(showBadges || showId || showDatesSection) && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {showBadges}
              {showId && <CopyableId id={entity.id} entitySlug={slug} />}
            </div>
            {showDatesSection && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                {entity.createdAt && formatDate(entity.createdAt) && (
                  <span>Created {formatDate(entity.createdAt)}</span>
                )}
                {entity.updatedAt && formatDate(entity.updatedAt) && (
                  <span>Updated {formatDate(entity.updatedAt)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

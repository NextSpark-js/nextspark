/**
 * EntityBulkActions - Floating action bar for bulk operations
 *
 * Appears at the bottom of the screen when items are selected.
 * Provides bulk actions like Select All, Change Status, and Delete.
 *
 * Migrated from team-manager theme BulkActionsBar with entity system integration.
 */

'use client'

import { useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { CheckSquare, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { createCyId } from '../../lib/test'
import type { EntityBulkActionsProps } from './entity-table.types'

/**
 * EntityBulkActions - Floating action bar for bulk operations
 */
export function EntityBulkActions({
  entitySlug,
  selectedIds,
  onClearSelection,
  config,
}: EntityBulkActionsProps) {
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  const selectedCount = selectedIds.size
  const itemLabel = config.itemLabel || 'item'
  const itemLabelPlural = config.itemLabelPlural || 'items'

  // Don't render if nothing is selected
  if (selectedCount === 0) {
    return null
  }

  const handleChangeStatusClick = () => {
    setSelectedStatus('')
    setIsStatusDialogOpen(true)
  }

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmStatusChange = async () => {
    if (!selectedStatus || !config.onChangeStatus) return

    setIsProcessing(true)
    try {
      await config.onChangeStatus(selectedStatus, Array.from(selectedIds))
      setIsStatusDialogOpen(false)
      onClearSelection()
    } catch (error) {
      console.error('[EntityBulkActions] Error changing status:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!config.onDelete) return

    setIsProcessing(true)
    try {
      await config.onDelete(Array.from(selectedIds))
      setIsDeleteDialogOpen(false)
      onClearSelection()
    } catch (error) {
      console.error('[EntityBulkActions] Error deleting items:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      {/* Floating Bar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-2 px-4 py-3',
          'bg-background border rounded-lg shadow-lg',
          'animate-in slide-in-from-bottom-4 duration-200'
        )}
        data-cy={createCyId(entitySlug, 'bulk-bar')}
      >
        {/* Selection Count */}
        <span
          className="text-sm font-medium px-2 py-1 bg-primary/10 text-primary rounded"
          data-cy={createCyId(entitySlug, 'bulk-count')}
        >
          {selectedCount} selected
        </span>

        {/* Divider */}
        <div className="h-6 w-px bg-border mx-1" />

        {/* Select All */}
        {config.enableSelectAll && config.onSelectAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={config.onSelectAll}
            className="gap-2"
            data-cy={createCyId(entitySlug, 'bulk-select-all')}
          >
            <CheckSquare className="h-4 w-4" />
            Select all
            {config.totalItems !== undefined && (
              <span className="text-muted-foreground">({config.totalItems})</span>
            )}
          </Button>
        )}

        {/* Divider */}
        {config.enableSelectAll && (config.enableChangeStatus || config.enableDelete) && (
          <div className="h-6 w-px bg-border mx-1" />
        )}

        {/* Change Status */}
        {config.enableChangeStatus && config.statusOptions && config.statusOptions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleChangeStatusClick}
            className="gap-2"
            data-cy={createCyId(entitySlug, 'bulk-status')}
          >
            <Pencil className="h-4 w-4" />
            Change status
          </Button>
        )}

        {/* Delete */}
        {config.enableDelete && config.onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            data-cy={createCyId(entitySlug, 'bulk-delete')}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-border mx-1" />

        {/* Close / Clear Selection */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="h-8 w-8"
          aria-label="Clear selection"
          data-cy={createCyId(entitySlug, 'bulk-clear')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Change Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent data-cy={createCyId(entitySlug, 'bulk-status-dialog')}>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Change the status of {selectedCount}{' '}
              {selectedCount === 1 ? itemLabel : itemLabelPlural}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">New Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger data-cy={createCyId(entitySlug, 'bulk-status-select')}>
                <SelectValue placeholder="Select a status..." />
              </SelectTrigger>
              <SelectContent>
                {config.statusOptions?.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-cy={createCyId(entitySlug, `bulk-status-option-${option.value}`)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStatusDialogOpen(false)}
              disabled={isProcessing}
              data-cy={createCyId(entitySlug, 'bulk-status-cancel')}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStatusChange}
              disabled={!selectedStatus || isProcessing}
              data-cy={createCyId(entitySlug, 'bulk-status-confirm')}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-cy={createCyId(entitySlug, 'bulk-delete-dialog')}>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedCount} {selectedCount === 1 ? itemLabel : itemLabelPlural}?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount}{' '}
              {selectedCount === 1 ? itemLabel : itemLabelPlural}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isProcessing}
              data-cy={createCyId(entitySlug, 'bulk-delete-cancel')}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isProcessing}
              data-cy={createCyId(entitySlug, 'bulk-delete-confirm')}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

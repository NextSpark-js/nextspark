/**
 * Universal Entity List Component
 * 
 * Automatically generates list/table views for any entity based on configuration.
 * Supports filtering, sorting, pagination, and bulk operations.
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import { Alert, AlertDescription } from '../ui/alert'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import {
  Loader2,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlertCircle,
  MoreVertical,
  Edit,
  ExternalLink
} from 'lucide-react'
import { SkeletonEntityList } from '../ui/skeleton-list'
import type { EntityConfig } from '../../lib/entities/types'
import type { Permission } from '../../lib/permissions/types'
import { EntityFieldRenderer } from './EntityFieldRenderer'
import { createTestId, sel } from '../../lib/test'
import { usePermission } from '../../lib/permissions/hooks'

export interface EntityListProps {
  entityConfig: EntityConfig
  data: Record<string, unknown>[]
  isLoading?: boolean
  error?: string | null
  onSearch?: (query: string) => void
  onSort?: (field: string, direction: 'asc' | 'desc') => void
  onSelect?: (selectedIds: string[]) => void
  onBulkDelete?: (ids: string[]) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  enableBulkOperations?: boolean
  enableSearch?: boolean
  enableFilters?: boolean
  enableRowActions?: boolean
  getPublicUrl?: (item: Record<string, unknown>) => string | null
  currentSort?: { field: string; direction: 'asc' | 'desc' }
  searchQuery?: string
  selectedIds?: string[]
  pageSize?: number
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  headerActions?: React.ReactNode // Additional actions to display in the header
  className?: string
  teamId?: string // Team ID for relation resolution
}

/**
 * Generate test IDs for entity list
 */
function generateTestIds(entityName: string) {
  return {
    container: createTestId(entityName, 'list'),
    search: createTestId(entityName, 'search'),
    table: createTestId(entityName, 'table'),
    row: (id: string) => createTestId(entityName, 'row', id),
    actions: (id: string) => createTestId(entityName, 'actions', id),
    bulkSelect: createTestId(entityName, 'bulk', 'select'),
    addButton: createTestId(entityName, 'add', 'button'),
  }
}

export function EntityList({
  entityConfig,
  data,
  isLoading = false,
  error = null,
  onSearch,
  onSort,
  onSelect,
  onBulkDelete,
  onDelete,
  enableBulkOperations = false,
  enableSearch = true,
  enableRowActions = true,
  getPublicUrl,
  currentSort,
  searchQuery = '',
  selectedIds = [],
  pageSize = 10,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  headerActions,
  className,
  teamId,
}: EntityListProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isRowDeleting, setIsRowDeleting] = useState(false)

  // Check permissions for actions
  const canCreate = usePermission(`${entityConfig.slug}.create` as Permission)
  const canUpdate = usePermission(`${entityConfig.slug}.update` as Permission)
  const canDelete = usePermission(`${entityConfig.slug}.delete` as Permission)

  const testIds = generateTestIds(entityConfig.slug)

  // Get fields that should be shown in list view
  const listFields = useMemo(() => {
    return entityConfig.fields
      .filter(field => field.display.showInList)
      .sort((a, b) => a.display.order - b.display.order)
  }, [entityConfig.fields])

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setLocalSearchQuery(query)
    onSearch?.(query)
  }, [onSearch])

  // Handle sort
  const handleSort = useCallback((fieldName: string) => {
    if (!onSort) return
    
    let direction: 'asc' | 'desc' = 'asc'
    if (currentSort?.field === fieldName && currentSort.direction === 'asc') {
      direction = 'desc'
    }
    
    onSort(fieldName, direction)
  }, [onSort, currentSort])

  // Handle row selection
  const handleRowSelect = useCallback((id: string, checked: boolean) => {
    if (!onSelect) return
    
    let newSelectedIds: string[]
    if (checked) {
      newSelectedIds = [...selectedIds, id]
    } else {
      newSelectedIds = selectedIds.filter(selectedId => selectedId !== id)
    }
    
    onSelect(newSelectedIds)
  }, [onSelect, selectedIds])

  // Handle select all
  const handleSelectAll = useCallback((checked: boolean) => {
    if (!onSelect) return
    
    if (checked) {
      const allIds = data.map(item => String(item.id))
      onSelect(allIds)
    } else {
      onSelect([])
    }
  }, [onSelect, data])

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete || selectedIds.length === 0) return

    setIsDeleting(true)
    try {
      await onBulkDelete(selectedIds)
      onSelect?.([])
    } catch (error) {
      console.error('Bulk delete failed:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [onBulkDelete, selectedIds, onSelect])

  // Handle row delete - opens confirmation dialog
  const handleRowDeleteClick = useCallback((id: string, name: string) => {
    setItemToDelete({ id, name })
    setDeleteDialogOpen(true)
  }, [])

  // Confirm row delete
  const handleRowDeleteConfirm = useCallback(async () => {
    if (!onDelete || !itemToDelete) return

    setIsRowDeleting(true)
    try {
      await onDelete(itemToDelete.id)
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Row delete failed:', error)
    } finally {
      setIsRowDeleting(false)
    }
  }, [onDelete, itemToDelete])

  // Cancel row delete
  const handleRowDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false)
    setItemToDelete(null)
  }, [])

  // Get sort icon for column
  const getSortIcon = (fieldName: string) => {
    if (currentSort?.field !== fieldName) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    
    return currentSort.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />
  }

  if (isLoading) {
    // Calculate number of columns based on list fields + checkbox + actions
    const columnCount = entityConfig?.fields?.filter(field => field.display.showInList)?.length || 6
    const hasSelected = selectedIds.length > 0
    
    return (
      <SkeletonEntityList 
        rowCount={pageSize || 10} 
        columnCount={columnCount}
        showBulkActions={hasSelected}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div 
        className={`max-w-7xl mx-auto space-y-4 ${className || ''}`}
        data-testid={testIds.container}
        data-cy={sel('entities.list.container', { slug: entityConfig.slug })}
      >
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">{entityConfig.names.plural}</h2>
          <p className="text-muted-foreground">
            Manage your {entityConfig.names.plural.toLowerCase()}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {enableSearch && (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${entityConfig.names.plural.toLowerCase()}...`}
                value={localSearchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 w-full sm:w-[300px]"
                data-testid={testIds.search}
                data-cy={sel('entities.table.search', { slug: entityConfig.slug })}
              />
            </div>
          )}

          {headerActions}

          {canCreate && (
            <Button asChild>
              <Link
                href={`/dashboard/${entityConfig.slug}/create`}
                data-testid={testIds.addButton}
                data-cy={sel('entities.table.addButton', { slug: entityConfig.slug })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add {entityConfig.names.singular}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {enableBulkOperations && selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Badge variant="outline">
            {selectedIds.length} selected
          </Badge>
          
          {entityConfig.ui.features.bulkOperations && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Selected
            </Button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            {React.createElement(entityConfig.icon, { 
              className: "h-16 w-16 text-muted-foreground/50 mb-4" 
            })}
            <h3 className="text-lg font-medium mb-2">
              No {entityConfig.names.plural.toLowerCase()} found
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchQuery 
                ? `No ${entityConfig.names.plural.toLowerCase()} match your search criteria.`
                : `Get started by creating your first ${entityConfig.names.singular.toLowerCase()}.`
              }
            </p>
            {!searchQuery && canCreate && (
              <Button className="mt-4" asChild>
                <Link href={`/dashboard/${entityConfig.slug}/create`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add {entityConfig.names.singular}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table data-testid={testIds.table} data-cy={sel('entities.table.element', { slug: entityConfig.slug })}>
            <TableHeader>
              <TableRow>
                {enableBulkOperations && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === data.length && data.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all rows"
                      data-testid={testIds.bulkSelect}
                    />
                  </TableHead>
                )}
                
                {listFields.map((field) => (
                  <TableHead key={field.name} className="min-w-[100px]">
                    {field.api.sortable && onSort ? (
                      <Button
                        variant="ghost"
                        onClick={() => handleSort(field.name)}
                        className="-ml-3 h-8 font-medium"
                      >
                        {field.display.label}
                        {getSortIcon(field.name)}
                      </Button>
                    ) : (
                      <span className="font-medium">{field.display.label}</span>
                    )}
                  </TableHead>
                ))}

                {enableRowActions && (canUpdate || canDelete) && (
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {data.map((item) => {
                const itemId = String(item.id)
                const isSelected = selectedIds.includes(itemId)
                
                return (
                  <TableRow
                    key={itemId}
                    className={isSelected ? 'bg-muted/50' : ''}
                    data-testid={testIds.row(itemId)}
                    data-cy={sel('entities.table.row', { slug: entityConfig.slug, id: itemId })}
                  >
                    {enableBulkOperations && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked: boolean | 'indeterminate') => handleRowSelect(itemId, !!checked)}
                          aria-label={`Select row ${itemId}`}
                        />
                      </TableCell>
                    )}
                    
                    {listFields.map((field) => (
                      <TableCell key={field.name}>
                        {/* Make title field clickeable to detail page */}
                        {(field.name === 'title' || field.name === 'name') ? (
                          <Link
                            href={`/dashboard/${entityConfig.slug}/${itemId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            <EntityFieldRenderer
                              field={field}
                              value={item[field.name]}
                              mode="list"
                              context={{
                                entityType: entityConfig.slug,
                                formData: item, // Pass the record data so RelationDisplay can access parentId
                                teamId, // Pass teamId for relation resolution
                              }}
                            />
                          </Link>
                        ) : (
                          <EntityFieldRenderer
                            field={field}
                            value={item[field.name]}
                            mode="list"
                            context={{
                              entityType: entityConfig.slug,
                              formData: item, // Pass the record data so RelationDisplay can access parentId
                              teamId, // Pass teamId for relation resolution
                            }}
                          />
                        )}
                      </TableCell>
                    ))}

                    {/* Row Actions */}
                    {enableRowActions && (canUpdate || canDelete) && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              data-testid={testIds.actions(itemId)}
                              data-cy={sel('entities.table.rowActionsMenu', { slug: entityConfig.slug, id: itemId })}
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canUpdate && (
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/${entityConfig.slug}/${itemId}/edit`}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                            )}

                            {getPublicUrl && getPublicUrl(item) && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={getPublicUrl(item)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  View
                                </a>
                              </DropdownMenuItem>
                            )}

                            {canDelete && onDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleRowDeleteClick(
                                    itemId,
                                    String(item.title || item.name || itemId)
                                  )}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data.length)} of {data.length} entries
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="w-8 h-8 p-0"
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{itemToDelete?.name}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRowDeleteCancel} disabled={isRowDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRowDeleteConfirm}
              disabled={isRowDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRowDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  )
}
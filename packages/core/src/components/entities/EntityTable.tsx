/**
 * EntityTable - Advanced table component for entity list views
 *
 * Features:
 * - Row selection (single/all) with indeterminate state and shift-click
 * - Row click navigation to detail view
 * - Quick actions on hover (below primary column)
 * - Dropdown menu with configurable actions
 * - Delete confirmation modal
 * - Pagination with page size selector
 * - Server-side pagination support
 * - Permission-based action visibility
 * - Dynamic data-cy attributes
 *
 * Migrated from team-manager theme DataTable with entity system integration.
 */

'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardContent } from '../ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import {
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { SkeletonEntityList } from '../ui/skeleton-list'
import { EntityFieldRenderer } from './EntityFieldRenderer'
import { sel } from '../../lib/test'
import { usePermission } from '../../lib/permissions/hooks'
import type { Permission } from '../../lib/permissions/types'
import type {
  EntityTableProps,
  EntityTableColumn,
  QuickAction,
  DropdownAction,
  ConfirmDialogState,
  PaginationConfig,
} from './entity-table.types'

/**
 * EntityTable - Universal table component for any entity
 */
export function EntityTable<T extends { id: string } = { id: string }>({
  entityConfig,
  data,
  columns: customColumns,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  onRowClick,
  basePath,
  quickActions: customQuickActions,
  dropdownActions: customDropdownActions,
  useDefaultActions = true,
  pagination,
  currentSort,
  onSort,
  searchQuery = '',
  onSearch,
  enableSearch = true,
  getItemName,
  emptyState,
  loading = false,
  onDelete,
  getPublicUrl,
  className,
  teamId,
  headerActions,
  showHeader = true,
}: EntityTableProps<T>) {
  const router = useRouter()
  const slug = entityConfig.slug

  // Internal selection state (used when not controlled)
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set())

  // Internal pagination state (used when not controlled externally)
  const [internalPage, setInternalPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(pagination?.pageSize ?? 10)

  // Search state
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState<T>>({
    open: false,
    item: null,
    action: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // Track last clicked row index for shift-click selection
  const lastClickedIndexRef = useRef<number | null>(null)

  // Check permissions for actions
  const canCreate = usePermission(`${slug}.create` as Permission)
  const canUpdate = usePermission(`${slug}.update` as Permission)
  const canDelete = usePermission(`${slug}.delete` as Permission)

  // Use controlled or internal selection state
  const selectedIds = controlledSelectedIds ?? internalSelectedIds
  const setSelectedIds = useCallback(
    (ids: Set<string>) => {
      if (onSelectionChange) {
        onSelectionChange(ids)
      } else {
        setInternalSelectedIds(ids)
      }
    },
    [onSelectionChange]
  )

  // Generate columns from entity config if not provided
  const columns = useMemo<EntityTableColumn<T>[]>(() => {
    if (customColumns) return customColumns

    return entityConfig.fields
      .filter(field => field.display.showInList)
      .sort((a, b) => a.display.order - b.display.order)
      .map(field => ({
        key: field.name,
        header: field.display.label,
        sortable: field.api.sortable,
        className: field.display.className,
      }))
  }, [customColumns, entityConfig.fields])

  // Auto-detect public URL from entity config (access.basePath or deprecated builder.public.basePath)
  const publicBasePath = entityConfig.access?.basePath ?? entityConfig.builder?.public?.basePath

  // Internal function to generate public URL for an item
  const getPublicUrlForItem = useCallback((item: T): string | null => {
    // Use custom getPublicUrl if provided, otherwise auto-detect
    if (getPublicUrl) return getPublicUrl(item)
    if (!publicBasePath) return null
    const itemSlug = (item as Record<string, unknown>).slug as string
    if (!itemSlug) return null
    // Handle root basePath (/) vs subpath (/blog)
    return publicBasePath === '/' ? `/${itemSlug}` : `${publicBasePath}/${itemSlug}`
  }, [getPublicUrl, publicBasePath])

  // Check if item is published (for public view visibility)
  const isPublished = useCallback((item: T): boolean => {
    const status = (item as Record<string, unknown>).status
    return status === 'published'
  }, [])

  // Generate default actions based on permissions
  const defaultQuickActions = useMemo<QuickAction<T>[]>(() => {
    if (!useDefaultActions) return []

    const actions: QuickAction<T>[] = []

    // Edit quick action (first)
    if (canUpdate) {
      actions.push({
        id: 'edit',
        label: 'Edit',
        icon: <Edit className="h-3 w-3" />,
        onClick: (item) => {
          router.push(`${basePath || `/dashboard/${slug}`}/${item.id}/edit`)
        },
        dataCySuffix: 'edit',
      })
    }

    // View Public quick action - only for entities with public view and published items
    if (publicBasePath) {
      actions.push({
        id: 'view-public',
        label: 'View',
        icon: <ExternalLink className="h-3 w-3" />,
        onClick: (item) => {
          const url = getPublicUrlForItem(item)
          if (url) window.open(url, '_blank')
        },
        visible: (item) => isPublished(item) && !!getPublicUrlForItem(item),
        dataCySuffix: 'view-public',
      })
    }

    return actions
  }, [useDefaultActions, canUpdate, basePath, slug, router, publicBasePath, getPublicUrlForItem, isPublished])

  const defaultDropdownActions = useMemo<DropdownAction<T>[]>(() => {
    if (!useDefaultActions) return []

    const actions: DropdownAction<T>[] = []

    actions.push({
      id: 'view',
      label: 'View',
      icon: <Eye className="h-4 w-4" />,
      onClick: (item) => {
        router.push(`${basePath || `/dashboard/${slug}`}/${item.id}`)
      },
      dataCySuffix: 'view',
    })

    if (canUpdate) {
      actions.push({
        id: 'edit',
        label: 'Edit',
        icon: <Edit className="h-4 w-4" />,
        onClick: (item) => {
          router.push(`${basePath || `/dashboard/${slug}`}/${item.id}/edit`)
        },
        dataCySuffix: 'edit',
      })
    }

    // View Public in dropdown - only for non-published items that have a public URL
    // (Published items show as quick action instead)
    if (publicBasePath) {
      actions.push({
        id: 'view-public',
        label: 'View Public',
        icon: <ExternalLink className="h-4 w-4" />,
        onClick: (item) => {
          const url = getPublicUrlForItem(item)
          if (url) window.open(url, '_blank')
        },
        // Only show in dropdown for non-published items (published shows as quick action)
        visible: (item) => !isPublished(item) && !!getPublicUrlForItem(item),
        dataCySuffix: 'view-public',
      })
    }

    if (canDelete && onDelete) {
      actions.push({
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => {}, // Handled by confirmation
        variant: 'destructive',
        separator: true,
        requiresConfirmation: true,
        confirmationTitle: (item) =>
          `Delete ${entityConfig.names.singular}?`,
        confirmationDescription: (item) => {
          const name = getItemName?.(item) || (item as Record<string, unknown>).name || (item as Record<string, unknown>).title || item.id
          return `This will permanently delete "${name}". This action cannot be undone.`
        },
        dataCySuffix: 'delete',
      })
    }

    return actions
  }, [useDefaultActions, canUpdate, canDelete, onDelete, basePath, slug, router, entityConfig.names.singular, getItemName, publicBasePath, getPublicUrlForItem, isPublished])

  // Merge default and custom actions
  const quickActions = useMemo(() => {
    return [...defaultQuickActions, ...(customQuickActions || [])]
  }, [defaultQuickActions, customQuickActions])

  const dropdownActions = useMemo(() => {
    return [...defaultDropdownActions, ...(customDropdownActions || [])]
  }, [defaultDropdownActions, customDropdownActions])

  // Pagination logic
  const isPaginated = !!pagination
  const currentPage = pagination?.currentPage ?? internalPage
  const pageSize = pagination?.onPageSizeChange ? pagination.pageSize : internalPageSize
  const totalItems = pagination?.totalItems ?? data.length
  const totalPages = Math.ceil(totalItems / pageSize)

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    if (!isPaginated) return data
    // If server-side pagination, data is already paginated
    if (pagination?.totalItems !== undefined && pagination.totalItems !== data.length) {
      return data
    }
    // Client-side pagination
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return data.slice(startIndex, endIndex)
  }, [data, isPaginated, pagination?.totalItems, currentPage, pageSize])

  // Display data
  const displayData = isPaginated ? paginatedData : data

  // Selection helpers
  const allSelected = displayData.length > 0 && displayData.every(item => selectedIds.has(item.id))
  const someSelected = selectedIds.size > 0 && !allSelected && displayData.some(item => selectedIds.has(item.id))

  // Page change handlers
  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return
      if (pagination?.onPageChange) {
        pagination.onPageChange(page)
      } else {
        setInternalPage(page)
      }
    },
    [pagination, totalPages]
  )

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      if (pagination?.onPageSizeChange) {
        pagination.onPageSizeChange(newPageSize)
      } else {
        setInternalPageSize(newPageSize)
        setInternalPage(1)
      }
    },
    [pagination]
  )

  // Selection handlers
  const toggleAll = useCallback(() => {
    if (allSelected) {
      const newSet = new Set(selectedIds)
      displayData.forEach(item => newSet.delete(item.id))
      setSelectedIds(newSet)
    } else {
      const newSet = new Set(selectedIds)
      displayData.forEach(item => newSet.add(item.id))
      setSelectedIds(newSet)
    }
  }, [allSelected, displayData, selectedIds, setSelectedIds])

  const toggleOne = useCallback(
    (id: string, index: number, shiftKey: boolean) => {
      const newSet = new Set(selectedIds)

      // Shift-click: select range from last clicked to current
      if (shiftKey && lastClickedIndexRef.current !== null) {
        const start = Math.min(lastClickedIndexRef.current, index)
        const end = Math.max(lastClickedIndexRef.current, index)

        for (let i = start; i <= end; i++) {
          if (displayData[i]) {
            newSet.add(displayData[i].id)
          }
        }
      } else {
        // Normal click: toggle single item
        if (newSet.has(id)) {
          newSet.delete(id)
        } else {
          newSet.add(id)
        }
      }

      lastClickedIndexRef.current = index
      setSelectedIds(newSet)
    },
    [selectedIds, setSelectedIds, displayData]
  )

  // Search handler
  const handleSearch = useCallback(
    (query: string) => {
      setLocalSearchQuery(query)
      onSearch?.(query)
    },
    [onSearch]
  )

  // Row click handler
  const handleRowClick = useCallback(
    (item: T) => {
      if (onRowClick) {
        onRowClick(item)
      } else {
        router.push(`${basePath || `/dashboard/${slug}`}/${item.id}`)
      }
    },
    [onRowClick, router, basePath, slug]
  )

  // Handle dropdown action click
  const handleDropdownAction = useCallback(
    (action: DropdownAction<T>, item: T) => {
      if (action.requiresConfirmation) {
        setConfirmDialog({ open: true, item, action })
      } else {
        action.onClick(item)
      }
    },
    []
  )

  // Confirm the pending action
  const confirmAction = useCallback(async () => {
    if (confirmDialog.action && confirmDialog.item) {
      // Special handling for delete action
      if (confirmDialog.action.id === 'delete' && onDelete) {
        setIsDeleting(true)
        try {
          await onDelete(confirmDialog.item.id)
        } finally {
          setIsDeleting(false)
        }
      } else {
        confirmDialog.action.onClick(confirmDialog.item)
      }
    }
    setConfirmDialog({ open: false, item: null, action: null })
  }, [confirmDialog, onDelete])

  // Get confirmation dialog text
  const getConfirmationTitle = useCallback(() => {
    const { action, item } = confirmDialog
    if (!action || !item) return 'Are you sure?'
    if (typeof action.confirmationTitle === 'function') {
      return action.confirmationTitle(item)
    }
    return action.confirmationTitle || 'Are you sure?'
  }, [confirmDialog])

  const getConfirmationDescription = useCallback(() => {
    const { action, item } = confirmDialog
    if (!action || !item) return 'This action cannot be undone.'
    if (typeof action.confirmationDescription === 'function') {
      return action.confirmationDescription(item)
    }
    return action.confirmationDescription || 'This action cannot be undone.'
  }, [confirmDialog])

  // Loading state
  if (loading) {
    return <SkeletonEntityList rowCount={pageSize} columnCount={columns.length} />
  }

  // Check if we have actions column
  const hasActions = dropdownActions.length > 0

  return (
    <div
      className={cn(showHeader && 'p-6', 'space-y-4', className)}
      data-cy={sel('entities.table.container', { slug })}
    >
        {/* Header with search and actions - conditionally rendered */}
        {showHeader && (
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
                    data-cy={sel('entities.table.search', { slug })}
                  />
                </div>
              )}

              {headerActions}

              {canCreate && (
                <Button asChild>
                  <Link
                    href={`${basePath || `/dashboard/${slug}`}/create`}
                    data-cy={sel('entities.table.addButton', { slug })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add {entityConfig.names.singular}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Selection count */}
        {selectable && selectedIds.size > 0 && (
          <div
            className="text-sm text-muted-foreground"
            data-cy={sel('entities.table.selectionCount', { slug })}
          >
            {selectedIds.size} of {totalItems} selected
          </div>
        )}

        {/* Empty state */}
        {displayData.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              {entityConfig.icon &&
                typeof entityConfig.icon === 'function' &&
                entityConfig.icon({
                  className: 'h-16 w-16 text-muted-foreground/50 mb-4',
                })}
              <h3 className="text-lg font-medium mb-2">
                No {entityConfig.names.plural.toLowerCase()} found
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                {localSearchQuery
                  ? `No ${entityConfig.names.plural.toLowerCase()} match your search criteria.`
                  : `Get started by creating your first ${entityConfig.names.singular.toLowerCase()}.`}
              </p>
              {!localSearchQuery && canCreate && (
                <Button className="mt-4" asChild>
                  <Link href={`${basePath || `/dashboard/${slug}`}/create`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add {entityConfig.names.singular}
                  </Link>
                </Button>
              )}
              {emptyState}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Table */}
            <div
              className="overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10 rounded-lg"
              data-cy={sel('entities.table.container', { slug })}
            >
              <Table data-cy={sel('entities.table.element', { slug })}>
                <TableHeader className="bg-muted/50 dark:bg-muted/30">
                  <TableRow>
                    {selectable && (
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected
                          }}
                          onChange={toggleAll}
                          aria-label="Select all"
                          data-cy={sel('entities.table.selectAll', { slug })}
                        />
                      </TableHead>
                    )}
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={cn('min-w-[100px]', column.headerClassName)}
                        style={column.width ? { width: column.width } : undefined}
                      >
                        {column.sortable && onSort ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const direction =
                                currentSort?.field === column.key && currentSort.direction === 'asc'
                                  ? 'desc'
                                  : 'asc'
                              onSort(column.key, direction)
                            }}
                            className="-ml-3 h-8 font-medium"
                          >
                            {column.header}
                          </Button>
                        ) : (
                          <span className="font-medium">{column.header}</span>
                        )}
                      </TableHead>
                    ))}
                    {hasActions && (
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-border bg-card">
                  {displayData.map((item, rowIndex) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'group transition-colors cursor-pointer',
                        selectedIds.has(item.id) ? 'bg-primary/5' : 'hover:bg-muted/30'
                      )}
                      onClick={() => handleRowClick(item)}
                      data-cy={sel('entities.table.row', { slug, id: item.id })}
                    >
                      {selectable && (
                        <TableCell
                          className="w-12"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                            checked={selectedIds.has(item.id)}
                            onChange={() => {}}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleOne(item.id, rowIndex, e.shiftKey)
                            }}
                            aria-label={`Select row ${rowIndex + 1}`}
                            data-cy={sel('entities.table.rowSelect', { slug, id: item.id })}
                          />
                        </TableCell>
                      )}

                      {columns.map((column, colIndex) => {
                        const field = entityConfig.fields.find(f => f.name === column.key)
                        const cellValue = (item as Record<string, unknown>)[column.key]

                        // Render cell content helper
                        const renderCellContent = () => {
                          if (column.render) {
                            return column.render(item)
                          }
                          // If no field config found, render as string
                          if (!field) {
                            return <span className="text-muted-foreground">{String(cellValue ?? '-')}</span>
                          }
                          return (
                            <EntityFieldRenderer
                              field={field}
                              value={cellValue}
                              mode="list"
                              context={{
                                entityType: slug,
                                formData: item as Record<string, unknown>,
                                teamId,
                              }}
                            />
                          )
                        }

                        return (
                          <TableCell key={column.key} className={cn(column.className)}>
                            {/* First column gets quick actions */}
                            {colIndex === 0 && quickActions.length > 0 ? (
                              <div>
                                <div className="font-medium">
                                  {renderCellContent()}
                                </div>
                                {/* Quick Actions - visible on hover */}
                                <div
                                  className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {quickActions
                                    .filter((action) => !action.visible || action.visible(item))
                                    .map((action) => (
                                      <button
                                        key={action.id}
                                        onClick={() => action.onClick(item)}
                                        className={cn(
                                          'inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer',
                                          action.variant === 'destructive'
                                            ? 'text-destructive hover:bg-destructive/10'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        )}
                                        data-cy={sel('entities.table.quickAction', {
                                          slug,
                                          action: action.dataCySuffix || action.id,
                                          id: item.id,
                                        })}
                                      >
                                        {action.icon}
                                        {action.label}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            ) : (
                              renderCellContent()
                            )}
                          </TableCell>
                        )
                      })}

                      {hasActions && (
                        <TableCell
                          className="w-12 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                data-cy={sel('entities.table.rowMenu', { slug, id: item.id })}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {dropdownActions
                                .filter((action) => !action.visible || action.visible(item))
                                .map((action, actionIndex) => (
                                  <div key={action.id}>
                                    {action.separator && actionIndex > 0 && (
                                      <DropdownMenuSeparator />
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => handleDropdownAction(action, item)}
                                      className={cn(
                                        action.variant === 'destructive' &&
                                          'text-destructive focus:text-destructive'
                                      )}
                                      data-cy={sel('entities.table.rowAction', {
                                        slug,
                                        action: action.dataCySuffix || action.id,
                                        id: item.id,
                                      })}
                                    >
                                      <span className="mr-2 h-4 w-4">{action.icon}</span>
                                      {action.label}
                                    </DropdownMenuItem>
                                  </div>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {isPaginated && totalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-3 border rounded-lg bg-card"
                data-cy={sel('entities.pagination.container', { slug })}
              >
                {/* Page size selector */}
                <div className="flex items-center gap-2">
                  {pagination?.showPageSizeSelector && (
                    <>
                      <span className="text-sm text-muted-foreground">Rows per page:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value: string) => handlePageSizeChange(Number(value))}
                      >
                        <SelectTrigger
                          className="h-8 w-[70px]"
                          data-cy={sel('entities.pagination.pageSize', { slug })}
                        >
                          <SelectValue placeholder={String(pageSize)} />
                        </SelectTrigger>
                        <SelectContent>
                          {(pagination?.pageSizeOptions ?? [10, 20, 50, 100]).map((size) => (
                            <SelectItem
                              key={size}
                              value={String(size)}
                              data-cy={sel('entities.pagination.pageSizeOption', { slug, size })}
                            >
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>

                {/* Page info and navigation */}
                <div className="flex items-center gap-4">
                  <span
                    className="text-sm text-muted-foreground"
                    data-cy={sel('entities.pagination.pageInfo', { slug })}
                  >
                    Page {currentPage} of {totalPages}
                    <span className="ml-2 text-xs">
                      ({(currentPage - 1) * pageSize + 1}-
                      {Math.min(currentPage * pageSize, totalItems)} of {totalItems})
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    {/* First page */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      data-cy={sel('entities.pagination.first', { slug })}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                      <span className="sr-only">First page</span>
                    </Button>

                    {/* Previous page */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-cy={sel('entities.pagination.prev', { slug })}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only">Previous page</span>
                    </Button>

                    {/* Next page */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-cy={sel('entities.pagination.next', { slug })}
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Next page</span>
                    </Button>

                    {/* Last page */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      data-cy={sel('entities.pagination.last', { slug })}
                    >
                      <ChevronsRight className="h-4 w-4" />
                      <span className="sr-only">Last page</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            !open && setConfirmDialog({ open: false, item: null, action: null })
          }
        >
          <AlertDialogContent data-cy={sel('entities.confirm.dialog', { slug })}>
            <AlertDialogHeader>
              <AlertDialogTitle>{getConfirmationTitle()}</AlertDialogTitle>
              <AlertDialogDescription>{getConfirmationDescription()}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-cy={sel('entities.confirm.cancel', { slug })}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmAction}
                disabled={isDeleting}
                className={cn(
                  confirmDialog.action?.variant === 'destructive' &&
                    'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                )}
                data-cy={sel('entities.confirm.action', { slug })}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  confirmDialog.action?.label || 'Confirm'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  )
}

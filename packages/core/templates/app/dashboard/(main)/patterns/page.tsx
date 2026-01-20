/**
 * Patterns List Page
 *
 * Custom patterns list page with quickAction to view usage reports.
 * Uses EntityTable directly to enable custom quickActions.
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, BarChart3, Pencil, Trash2 } from 'lucide-react'
import { EntityTable } from '@nextsparkjs/core/components/entities/EntityTable'
import { EntityBulkActions } from '@nextsparkjs/core/components/entities/EntityBulkActions'
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { SkeletonEntityList } from '@nextsparkjs/core/components/ui/skeleton-list'
import { SearchInput } from '@nextsparkjs/core/components/shared/SearchInput'
import { MultiSelectFilter } from '@nextsparkjs/core/components/shared/MultiSelectFilter'
import { PatternDeleteDialog } from '@nextsparkjs/core/components/patterns'
import { useEntityConfig } from '@nextsparkjs/core/hooks/useEntityConfig'
import { useUrlFilters, type FilterSchema, type EntityFiltersReturn } from '@nextsparkjs/core/hooks/useUrlFilters'
import { listEntityData, deleteEntityData } from '@nextsparkjs/core/lib/api/entities'
import { useTeam } from '@nextsparkjs/core/hooks/useTeam'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'
import type { Permission } from '@nextsparkjs/core/lib/permissions/types'
import type { QuickAction, DropdownAction } from '@nextsparkjs/core/components/entities/entity-table.types'
import { sel } from '@nextsparkjs/core/lib/test'
import { toast } from 'sonner'

interface PatternItem {
  id: string
  name?: string
  title?: string
  usageCount?: number
  [key: string]: unknown
}

export default function PatternsListPage() {
  const entityType = 'patterns'
  const router = useRouter()

  // Use the new centralized hook for entity configuration
  const { config: entityConfig, isLoading, error: configError, isOverride } = useEntityConfig(entityType)

  // Get current team for relation resolution
  const { teamId } = useTeam()

  // Check permissions
  const canCreate = usePermission(`${entityType}.create` as Permission)

  // Generate filter schema dynamically from entityConfig
  const filterSchema = useMemo(() => {
    const schema: FilterSchema = {
      search: { type: 'search', urlParam: 'search' } as const
    }

    // Add filters from entity config
    entityConfig?.ui.dashboard.filters?.forEach(filterConfig => {
      if (filterConfig.type === 'multiSelect' || filterConfig.type === 'singleSelect') {
        schema[filterConfig.field] = {
          type: filterConfig.type,
          urlParam: filterConfig.urlParam || filterConfig.field
        }
      }
    })

    return schema
  }, [entityConfig?.ui.dashboard.filters])

  // Use URL-synchronized filters with dynamic schema
  const { filters, setFilter } = useUrlFilters(filterSchema) as unknown as EntityFiltersReturn

  // Data loading states
  const [data, setData] = useState<PatternItem[]>([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Delete dialog state for PatternDeleteDialog
  const [deleteTarget, setDeleteTarget] = useState<PatternItem | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Build API filters from URL filter state
  const buildApiFilters = useCallback(() => {
    const apiFilters: Record<string, string> = {}

    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      apiFilters.search = filters.search
    }

    entityConfig?.ui.dashboard.filters?.forEach(filterConfig => {
      const value = filters[filterConfig.field]
      if (Array.isArray(value) && value.length > 0) {
        apiFilters[filterConfig.field] = value.join(',')
      } else if (typeof value === 'string' && value) {
        apiFilters[filterConfig.field] = value
      }
    })

    return apiFilters
  }, [filters, entityConfig?.ui.dashboard.filters])

  // Load entity data function
  const loadData = useCallback(async (isInitial = false) => {
    if (!entityConfig) return
    if (!entityConfig.enabled) {
      setDataError(`Entity "${entityType}" is disabled`)
      return
    }

    try {
      if (isInitial) {
        setIsInitialLoad(true)
      } else {
        setIsSearching(true)
      }
      setDataError(null)

      const apiFilters = buildApiFilters()
      const result = await listEntityData(entityType, {
        limit: 50,
        includeMeta: true,
        ...(Object.keys(apiFilters).length > 0 && { filters: apiFilters })
      })

      setData(result.data as PatternItem[])
      setDataError(null)
    } catch (err) {
      console.error(`[PatternsListPage] Error loading data:`, err)
      setDataError(`Error loading data: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setData([])
    } finally {
      setIsInitialLoad(false)
      setIsSearching(false)
    }
  }, [entityConfig, entityType, buildApiFilters])

  // Track previous filters and schema to detect changes
  const filtersKey = JSON.stringify(filters)
  const prevFiltersKeyRef = useRef<string>('')
  const hasLoadedRef = useRef(false)
  const schemaKeysForSync = useMemo(
    () => Object.keys(filterSchema).sort().join(','),
    [filterSchema]
  )
  const prevSchemaKeysRef = useRef<string>(schemaKeysForSync)

  // Check if filters are synced with URL params
  const filtersMatchUrl = useMemo(() => {
    if (typeof window === 'undefined') return true

    if (schemaKeysForSync !== prevSchemaKeysRef.current) {
      prevSchemaKeysRef.current = schemaKeysForSync
      return false
    }

    const urlParams = new URLSearchParams(window.location.search)

    for (const filterConfig of entityConfig?.ui.dashboard.filters || []) {
      const urlValue = urlParams.get(filterConfig.field)
      const filterValue = filters[filterConfig.field]

      if (urlValue && (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0))) {
        return false
      }
    }
    return true
  }, [filters, entityConfig?.ui.dashboard.filters, schemaKeysForSync])

  // Load data when config is ready AND filters are synced with URL
  useEffect(() => {
    if (!entityConfig?.slug) return
    if (!filtersMatchUrl) return

    const isInitial = !hasLoadedRef.current
    const filtersChanged = prevFiltersKeyRef.current !== filtersKey

    if (isInitial || filtersChanged) {
      prevFiltersKeyRef.current = filtersKey
      hasLoadedRef.current = true
      loadData(isInitial)
    }
  }, [entityConfig?.slug, filtersKey, filtersMatchUrl, loadData])

  // Handle search input change
  const handleSearch = useCallback((query: string) => {
    setFilter('search', query)
  }, [setFilter])

  // Handler that opens the delete dialog (called from dropdown action)
  const handleDeleteClick = useCallback((item: PatternItem) => {
    setDeleteTarget(item)
    setIsDeleteDialogOpen(true)
  }, [])

  // Handler that executes the delete (called from PatternDeleteDialog)
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteEntityData(entityType, deleteTarget.id)
      toast.success(`Pattern deleted successfully`)
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deleteTarget.id)
        return newSet
      })
      await loadData(false)
    } catch (err) {
      console.error(`[PatternsListPage] Error deleting pattern:`, err)
      toast.error(`Error deleting: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget, entityType, loadData])

  // Handle bulk delete
  const handleBulkDelete = useCallback(async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => deleteEntityData(entityType, id)))
      toast.success(`${ids.length} pattern${ids.length === 1 ? '' : 's'} deleted successfully`)
      await loadData(false)
    } catch (err) {
      console.error(`[PatternsListPage] Error bulk deleting patterns:`, err)
      toast.error(`Error deleting: ${err instanceof Error ? err.message : 'Unknown error'}`)
      throw err
    }
  }, [entityType, loadData])

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const allIds = new Set(data.map(item => String(item.id)))
    setSelectedIds(allIds)
  }, [data])

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Get item name for confirmations
  const getItemName = useCallback((item: PatternItem): string => {
    return String(item.name || item.title || item.id)
  }, [])

  // Custom quickActions for patterns - includes "View Usages" action
  const quickActions: QuickAction<PatternItem>[] = useMemo(
    () => [
      {
        id: 'view-usages',
        label: 'View Usages',
        icon: <BarChart3 className="h-4 w-4" />,
        onClick: (item: PatternItem) => {
          router.push(`/dashboard/patterns/${item.id}/reports`)
        },
        dataCySuffix: 'usages',
      },
    ],
    [router]
  )

  // Custom dropdownActions - replace default delete with PatternDeleteDialog
  const dropdownActions: DropdownAction<PatternItem>[] = useMemo(
    () => [
      {
        id: 'edit',
        label: 'Edit',
        icon: <Pencil className="h-4 w-4" />,
        onClick: (item) => router.push(`/dashboard/patterns/${item.id}/edit`),
        dataCySuffix: 'edit',
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: handleDeleteClick,
        variant: 'destructive',
        separator: true,
        dataCySuffix: 'delete',
      },
    ],
    [router, handleDeleteClick]
  )

  if (isLoading) {
    return <SkeletonEntityList />
  }

  if (configError || !entityConfig) {
    return (
      <Alert>
        <AlertDescription>
          {configError || `Could not load configuration for entity "${entityType}".`}
        </AlertDescription>
      </Alert>
    )
  }

  if (dataError) {
    return (
      <Alert>
        <AlertDescription>
          {dataError}
        </AlertDescription>
      </Alert>
    )
  }

  const bulkOperationsEnabled = entityConfig.ui.features.bulkOperations
  const enableSearch = entityConfig.ui.features.searchable
  const enableFilters = entityConfig.ui.features.filterable && entityConfig.ui.dashboard.filters?.length
  const searchValue = typeof filters.search === 'string' ? filters.search : ''

  return (
    <div className="p-6 space-y-6" data-cy={sel('entities.list.container', { slug: entityConfig.slug })}>
      {/* Row 1: Title + Create button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight" data-cy={sel('entities.page.title', { slug: entityConfig.slug })}>
            {entityConfig.names.plural}
          </h1>
          <p className="text-muted-foreground">
            Manage your {entityConfig.names.plural.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button asChild data-cy={sel('entities.list.addButton', { slug: entityConfig.slug })}>
              <Link href={`/dashboard/${entityConfig.slug}/create`}>
                <Plus className="h-4 w-4 mr-2" />
                Add {entityConfig.names.singular}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Search + Filters */}
      {(enableSearch || enableFilters) && (
        <div className="flex flex-col sm:flex-row gap-3 items-center flex-wrap">
          {enableSearch && (
            <SearchInput
              placeholder={`Search ${entityConfig.names.plural.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              containerClassName="flex-1 max-w-md"
              data-cy={sel('entities.list.search.container', { slug: entityConfig.slug })}
            />
          )}

          {enableFilters && entityConfig.ui.dashboard.filters?.map(filterConfig => {
            const field = entityConfig.fields.find(f => f.name === filterConfig.field)
            if (!field?.options) return null

            const filterValues = filters[filterConfig.field]
            const values = Array.isArray(filterValues) ? filterValues : []

            return (
              <MultiSelectFilter
                key={filterConfig.field}
                label={filterConfig.label || field.display.label}
                options={field.options.map(opt => ({
                  value: String(opt.value),
                  label: opt.label
                }))}
                values={values}
                onChange={(newValues) => setFilter(filterConfig.field, newValues)}
                data-cy={sel('entities.list.filters.trigger', { slug: entityConfig.slug, field: filterConfig.field })}
              />
            )
          })}

          {isSearching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* Row 3: Data Table with custom quickActions and dropdownActions */}
      <EntityTable
        entityConfig={entityConfig}
        data={data as Array<{ id: string }>}
        loading={isInitialLoad}
        selectable={bulkOperationsEnabled}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        enableSearch={false}
        searchQuery={searchValue}
        onSearch={handleSearch}
        getItemName={getItemName}
        teamId={teamId}
        useDefaultActions={false}
        quickActions={quickActions}
        dropdownActions={dropdownActions}
        showHeader={false}
        pagination={{
          pageSize: 10,
          showPageSizeSelector: true,
          pageSizeOptions: [10, 20, 50, 100],
        }}
      />

      {/* Floating Bulk Actions Bar */}
      {bulkOperationsEnabled && (
        <EntityBulkActions
          entitySlug={entityConfig.slug}
          selectedIds={selectedIds}
          onClearSelection={handleClearSelection}
          config={{
            enableSelectAll: true,
            totalItems: data.length,
            onSelectAll: handleSelectAll,
            enableDelete: true,
            onDelete: handleBulkDelete,
            itemLabel: entityConfig.names.singular,
            itemLabelPlural: entityConfig.names.plural,
          }}
        />
      )}

      {/* Pattern Delete Dialog - shows usage warning before deleting */}
      {deleteTarget && (
        <PatternDeleteDialog
          patternId={deleteTarget.id}
          patternTitle={getItemName(deleteTarget)}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        />
      )}
    </div>
  )
}

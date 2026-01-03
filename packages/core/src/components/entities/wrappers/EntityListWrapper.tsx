/**
 * Entity List Wrapper
 *
 * High-level wrapper that converts entityType string to entityConfig
 * and handles data loading logic.
 *
 * Uses EntityTable for rendering with advanced features:
 * - Row click navigation
 * - Quick actions on hover
 * - Dropdown menu with configurable actions
 * - Pagination with page size selector
 * - Bulk actions with floating bar
 * - URL-synchronized filters (search + configurable field filters)
 *
 * Refactored to use useEntityConfig hook for better performance and consistency
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import { EntityTable } from '../EntityTable'
import { EntityBulkActions } from '../EntityBulkActions'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { SkeletonEntityList } from '../../ui/skeleton-list'
import { SearchInput } from '../../shared/SearchInput'
import { MultiSelectFilter } from '../../shared/MultiSelectFilter'
import { useEntityConfig } from '../../../hooks/useEntityConfig'
import { useUrlFilters, type FilterSchema, type EntityFiltersReturn } from '../../../hooks/useUrlFilters'
import { listEntityData, deleteEntityData } from '../../../lib/api/entities'
import { useTeam } from '../../../hooks/useTeam'
import { usePermission } from '../../../lib/permissions/hooks'
import type { Permission } from '../../../lib/permissions/types'
import { createCyId } from '../../../lib/test'
import { toast } from 'sonner'

export interface EntityListWrapperProps {
  entityType: string
  className?: string
  headerActions?: React.ReactNode // Additional actions to display in the header
}

export function EntityListWrapper({
  entityType,
  className,
  headerActions
}: EntityListWrapperProps) {
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
      // Future: handle dateRange and numberRange filters
    })

    return schema
  }, [entityConfig?.ui.dashboard.filters])

  // Use URL-synchronized filters with dynamic schema
  // EntityFiltersReturn provides documented type interface for runtime-built schemas
  // The 'as unknown as' is required because TypeScript cannot verify runtime-built schema types
  const { filters, setFilter } = useUrlFilters(filterSchema) as unknown as EntityFiltersReturn

  // Data loading states
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [isInitialLoad, setIsInitialLoad] = useState(true) // Only true for first load
  const [isSearching, setIsSearching] = useState(false) // Subtle indicator for search
  const [dataError, setDataError] = useState<string | null>(null)

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Build API filters from URL filter state
  const buildApiFilters = useCallback(() => {
    const apiFilters: Record<string, string> = {}

    // Add search filter
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      apiFilters.search = filters.search
    }

    // Add field filters from entity config
    entityConfig?.ui.dashboard.filters?.forEach(filterConfig => {
      const value = filters[filterConfig.field]
      if (Array.isArray(value) && value.length > 0) {
        // Join array values with comma for API
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
      setDataError(`Entidad "${entityType}" está deshabilitada`)
      return
    }

    try {
      // Only show skeleton on initial load, not on filter changes
      if (isInitial) {
        setIsInitialLoad(true)
      } else {
        setIsSearching(true)
      }
      setDataError(null)

      const apiFilters = buildApiFilters()
      console.log(`[EntityListWrapper] Loading data for "${entityType}" (override: ${isOverride}, filters:`, apiFilters, ')')

      const result = await listEntityData(entityType, {
        limit: 50,
        includeMeta: true,
        ...(Object.keys(apiFilters).length > 0 && { filters: apiFilters })
      })

      console.log(`[EntityListWrapper] Loaded ${result.data.length} items for "${entityType}"`)
      setData(result.data as Record<string, unknown>[])
      setDataError(null)
    } catch (err) {
      console.error(`[EntityListWrapper] Error loading data for "${entityType}":`, err)
      setDataError(`Error cargando datos: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      setData([])
    } finally {
      setIsInitialLoad(false)
      setIsSearching(false)
    }
  }, [entityConfig, entityType, isOverride, buildApiFilters])

  // Track previous filters and schema to detect changes
  const filtersKey = JSON.stringify(filters)
  const prevFiltersKeyRef = useRef<string>('')
  const hasLoadedRef = useRef(false)

  // Track schema changes to handle race condition
  const schemaKeysForSync = useMemo(
    () => Object.keys(filterSchema).sort().join(','),
    [filterSchema]
  )
  const prevSchemaKeysRef = useRef<string>(schemaKeysForSync)

  // Check if filters are synced with URL params
  // This prevents loading with stale filters during the schema expansion race condition
  const filtersMatchUrl = useMemo(() => {
    if (typeof window === 'undefined') return true

    // If schema just changed, wait for useUrlFilters to re-parse
    // This gives time for the filter state to update
    if (schemaKeysForSync !== prevSchemaKeysRef.current) {
      prevSchemaKeysRef.current = schemaKeysForSync
      return false // Wait for next render
    }

    const urlParams = new URLSearchParams(window.location.search)

    // Check each filter field defined in entity config
    for (const filterConfig of entityConfig?.ui.dashboard.filters || []) {
      const urlValue = urlParams.get(filterConfig.field)
      const filterValue = filters[filterConfig.field]

      // If URL has a value but filter state doesn't, filters aren't synced yet
      if (urlValue && (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0))) {
        return false
      }
    }
    return true
  }, [filters, entityConfig?.ui.dashboard.filters, schemaKeysForSync])

  // Load data when config is ready AND filters are synced with URL
  useEffect(() => {
    if (!entityConfig?.slug) return

    // Wait for filters to sync with URL params before loading
    if (!filtersMatchUrl) return

    const isInitial = !hasLoadedRef.current
    const filtersChanged = prevFiltersKeyRef.current !== filtersKey

    // Load on initial render or when filters change
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

  // Handle single item delete - deletes item and reloads data
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteEntityData(entityType, id)
      toast.success(`${entityConfig?.names.singular || 'Item'} deleted successfully`)
      // Clear selection if deleted item was selected
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      // Reload data after delete (preserving current filters)
      await loadData(false)
    } catch (err) {
      console.error(`[EntityListWrapper] Error deleting ${entityType}:`, err)
      toast.error(`Error deleting: ${err instanceof Error ? err.message : 'Unknown error'}`)
      throw err
    }
  }, [entityType, entityConfig?.names.singular, loadData])

  // Handle bulk delete
  const handleBulkDelete = useCallback(async (ids: string[]) => {
    try {
      // Delete all selected items
      await Promise.all(ids.map(id => deleteEntityData(entityType, id)))
      toast.success(`${ids.length} ${ids.length === 1 ? entityConfig?.names.singular || 'item' : entityConfig?.names.plural || 'items'} deleted successfully`)
      // Reload data after delete (preserving current filters)
      await loadData(false)
    } catch (err) {
      console.error(`[EntityListWrapper] Error bulk deleting ${entityType}:`, err)
      toast.error(`Error deleting: ${err instanceof Error ? err.message : 'Unknown error'}`)
      throw err
    }
  }, [entityType, entityConfig?.names.singular, entityConfig?.names.plural, loadData])

  // Handle select all (for bulk actions bar)
  const handleSelectAll = useCallback(() => {
    const allIds = new Set(data.map(item => String(item.id)))
    setSelectedIds(allIds)
  }, [data])

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Get item name for confirmations
  const getItemName = useCallback((item: Record<string, unknown>): string => {
    return String(item.name || item.title || item.id)
  }, [])

  if (isLoading) {
    return <SkeletonEntityList />
  }

  if (configError || !entityConfig) {
    return (
      <Alert>
        <AlertDescription>
          {configError || `No se pudo cargar la configuración para la entidad "${entityType}".`}
        </AlertDescription>
      </Alert>
    )
  }

  // Show data error if present
  if (dataError) {
    return (
      <Alert>
        <AlertDescription>
          {dataError}
        </AlertDescription>
      </Alert>
    )
  }

  // Check if bulk operations are enabled
  const bulkOperationsEnabled = entityConfig.ui.features.bulkOperations
  const enableSearch = entityConfig.ui.features.searchable
  const enableFilters = entityConfig.ui.features.filterable && entityConfig.ui.dashboard.filters?.length

  // Get search value from filters (with proper type handling)
  const searchValue = typeof filters.search === 'string' ? filters.search : ''

  return (
    <div className="p-6 space-y-6" data-cy={createCyId(entityConfig.slug, 'page')}>
      {/* Row 1: Title + Create button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight" data-cy={createCyId(entityConfig.slug, 'title')}>
            {entityConfig.names.plural}
          </h1>
          <p className="text-muted-foreground">
            Manage your {entityConfig.names.plural.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {canCreate && (
            <Button asChild data-cy={createCyId(entityConfig.slug, 'add')}>
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
              data-cy={createCyId(entityConfig.slug, 'search')}
            />
          )}

          {/* Dynamic filters from entity config */}
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
                data-cy={createCyId(entityConfig.slug, `filter-${filterConfig.field}`)}
              />
            )
          })}

          {/* Subtle loading indicator during search/filter */}
          {isSearching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* Row 3: Data Table */}
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
        onDelete={handleDelete}
        getItemName={getItemName}
        className={className}
        teamId={teamId}
        useDefaultActions={true}
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
    </div>
  )
}

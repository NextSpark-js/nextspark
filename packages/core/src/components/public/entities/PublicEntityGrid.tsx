/**
 * Public Entity Grid
 * 
 * Generic grid component for displaying public entities in a website-friendly layout.
 * Handles loading, pagination, and responsive grid display.
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PublicEntityCard } from './PublicEntityCard'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Skeleton } from '../../ui/skeleton'
import { Alert, AlertDescription } from '../../ui/alert'
import { Search, SortAsc, SortDesc, Grid, List } from 'lucide-react'
import { entityApi } from '../../../lib/api/entities'
import { getAllEntityConfigs } from '../../../lib/entities/registry.client'
import type { EntityConfig } from '../../../lib/entities/types'
import type { EntityListResponse } from '../../../lib/api/entities'
import { SYSTEM_TIMESTAMP_FIELDS } from '../../../lib/entities/system-fields'

interface PublicEntityGridProps {
  entityType: string
  entitySlug: string
  searchParams: { [key: string]: string | string[] | undefined }
  className?: string
}

export function PublicEntityGrid({ entityType, entitySlug, searchParams, className }: PublicEntityGridProps) {
  const [data, setData] = useState<EntityListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState(searchParams.search as string || '')
  const [sortField, setSortField] = useState(searchParams.sort as string || 'createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    (searchParams.order as string) === 'asc' ? 'asc' : 'desc'
  )
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.page as string) || 1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [entityConfig, setEntityConfig] = useState<EntityConfig | null>(null)

  const pageSize = 12 // Public pages typically show more items

  // Load entity configuration from client registry
  useEffect(() => {
    try {
      const configs = getAllEntityConfigs()
      const config = configs.find(c => c.slug === entitySlug)
      setEntityConfig(config || null)
    } catch (err) {
      console.error('Failed to load entity config:', err)
    }
  }, [entitySlug])

  // Get sortable fields from entity config, including implicit system timestamp fields
  const sortableFields = useMemo(() => {
    const configFields = entityConfig?.fields.filter(field =>
      field.api?.sortable && field.display.showInList
    ) || []

    // Add implicit timestamp fields that are always sortable (if not already in config)
    const implicitFields = SYSTEM_TIMESTAMP_FIELDS.filter(field =>
      !configFields.some(f => f.name === field.name)
    )

    return [...configFields, ...implicitFields]
  }, [entityConfig])

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const params: Record<string, unknown> = {
          page: currentPage,
          limit: pageSize,
        }

        // Add search if provided
        if (searchTerm.trim()) {
          params.search = searchTerm.trim()
        }

        // Add sorting
        if (sortField) {
          params.sort = sortField
          params.order = sortDirection
        }

        const result = await entityApi.list(entityType, params)
        setData(result)
      } catch (err) {
        console.error('Error loading public entities:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [entityType, currentPage, searchTerm, sortField, sortDirection])

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page on search
  }

  // Handle sort change
  // const handleSortChange = (field: string) => {
  //   if (field === sortField) {
  //     setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
  //   } else {
  //     setSortField(field)
  //     setSortDirection('desc')
  //   }
  //   setCurrentPage(1)
  // }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={entityConfig ? `Search ${entityConfig.names.plural.toLowerCase()}...` : 'Search...'}
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          {sortableFields.length > 0 && (
            <Select value={sortField} onValueChange={setSortField}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {sortableFields.map((field) => (
                  <SelectItem key={field.name} value={field.name}>
                    {field.display.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort Direction */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          >
            {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>

          {/* View Mode Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      {data && data.info && entityConfig && (
        <div className="text-sm text-muted-foreground">
          Showing {data.data.length} of {data.info.total} {entityConfig.names.plural.toLowerCase()}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {Array.from({ length: pageSize }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {/* Data Grid */}
      {data && data.data.length > 0 && (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {data.data.map((item) => (
            <PublicEntityCard
              key={`${item.id}-${entityConfig ? 'loaded' : 'loading'}`}
              entityConfig={entityConfig}
              entitySlug={entitySlug}
              data={item}
              className={viewMode === 'list' ? 'flex-row' : ''}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {data && data.data.length === 0 && entityConfig && (
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg mb-2">
            No {entityConfig.names.plural.toLowerCase()} found
          </div>
          {searchTerm && (
            <div className="text-sm text-muted-foreground">
              Try adjusting your search terms
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.info && data.info.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            disabled={!data.info.hasPrevPage}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, data.info.totalPages) }, (_, i) => {
              const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i
              if (page > data.info.totalPages) return null
              
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            disabled={!data.info.hasNextPage}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
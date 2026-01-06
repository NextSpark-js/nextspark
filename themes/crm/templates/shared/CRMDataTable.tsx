/**
 * CRM Data Table Component
 * Professional data table with selection, sorting, bulk actions, and pagination
 */

'use client'

import React, { useState, useMemo } from 'react'
import {
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    ChevronLeft,
    ChevronRight,
    Trash2,
    Download,
    MoreHorizontal,
    Search,
    X,
    Inbox
} from 'lucide-react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { cn } from '@nextsparkjs/core/lib/utils'

// Types
export interface Column<T> {
    key: keyof T | string
    header: string
    width?: string
    sortable?: boolean
    render?: (value: any, row: T) => React.ReactNode
    className?: string
}

export interface BulkAction {
    id: string
    label: string
    icon?: React.ReactNode
    variant?: 'default' | 'destructive'
    onClick: (selectedIds: string[]) => void | Promise<void>
}

interface CRMDataTableProps<T extends { id: string }> {
    data: T[]
    columns: Column<T>[]
    bulkActions?: BulkAction[]
    onRowClick?: (row: T) => void
    isLoading?: boolean
    searchPlaceholder?: string
    searchFields?: (keyof T)[]
    pageSize?: number
    emptyMessage?: string
    emptyDescription?: string
    /** Entity slug for data-cy selectors (e.g., 'leads', 'contacts') */
    entitySlug?: string
}

// Sorting
type SortDirection = 'asc' | 'desc' | null
interface SortState {
    key: string | null
    direction: SortDirection
}

export function CRMDataTable<T extends { id: string }>({
    data,
    columns,
    bulkActions = [],
    onRowClick,
    isLoading = false,
    searchPlaceholder = 'Search...',
    searchFields = [],
    pageSize = 10,
    emptyMessage = 'No data found',
    emptyDescription = 'Try adjusting your filters or add new records.',
    entitySlug,
}: CRMDataTableProps<T>) {
    // Generate data-cy attribute with entity-specific or generic prefix
    const dataCy = (suffix: string) => entitySlug ? `${entitySlug}-${suffix}` : `crm-datatable-${suffix}`
    // State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [sort, setSort] = useState<SortState>({ key: null, direction: null })
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    // Filter and sort data
    const processedData = useMemo(() => {
        let result = [...data]

        // Search filter
        if (searchQuery && searchFields.length > 0) {
            const query = searchQuery.toLowerCase()
            result = result.filter((row) =>
                searchFields.some((field) => {
                    const value = row[field]
                    return value && String(value).toLowerCase().includes(query)
                })
            )
        }

        // Sort
        if (sort.key && sort.direction) {
            result.sort((a, b) => {
                const aVal = (a as any)[sort.key!]
                const bVal = (b as any)[sort.key!]

                if (aVal === bVal) return 0
                if (aVal == null) return 1
                if (bVal == null) return -1

                const comparison = aVal < bVal ? -1 : 1
                return sort.direction === 'asc' ? comparison : -comparison
            })
        }

        return result
    }, [data, searchQuery, searchFields, sort])

    // Pagination
    const totalPages = Math.ceil(processedData.length / pageSize)
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return processedData.slice(start, start + pageSize)
    }, [processedData, currentPage, pageSize])

    // Selection handlers
    const isAllSelected = paginatedData.length > 0 && paginatedData.every(row => selectedIds.has(row.id))
    const isSomeSelected = paginatedData.some(row => selectedIds.has(row.id))

    const toggleSelectAll = () => {
        if (isAllSelected) {
            const newSelected = new Set(selectedIds)
            paginatedData.forEach(row => newSelected.delete(row.id))
            setSelectedIds(newSelected)
        } else {
            const newSelected = new Set(selectedIds)
            paginatedData.forEach(row => newSelected.add(row.id))
            setSelectedIds(newSelected)
        }
    }

    const toggleSelectRow = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const clearSelection = () => {
        setSelectedIds(new Set())
    }

    // Sort handler
    const handleSort = (key: string) => {
        setSort((prev) => {
            if (prev.key !== key) {
                return { key, direction: 'asc' }
            }
            if (prev.direction === 'asc') {
                return { key, direction: 'desc' }
            }
            return { key: null, direction: null }
        })
    }

    // Get cell value
    const getCellValue = (row: T, column: Column<T>): any => {
        const keys = String(column.key).split('.')
        let value: any = row
        for (const key of keys) {
            value = value?.[key]
        }
        return value
    }

    // Render sort icon
    const renderSortIcon = (columnKey: string) => {
        if (sort.key !== columnKey) {
            return <ChevronsUpDown className="w-4 h-4 text-muted-foreground/50" />
        }
        if (sort.direction === 'asc') {
            return <ChevronUp className="w-4 h-4 text-primary" />
        }
        return <ChevronDown className="w-4 h-4 text-primary" />
    }

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-72 bg-muted animate-pulse rounded-lg" />
                <div className="border rounded-xl overflow-hidden">
                    <div className="bg-muted/50 h-12" />
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-16 border-t bg-card animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4" data-cy={dataCy('list')}>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                {/* Search */}
                {searchFields.length > 0 && (
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1)
                            }}
                            placeholder={searchPlaceholder}
                            className="w-full pl-10 pr-10 py-2 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            data-cy={dataCy('search')}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {/* Bulk Actions Bar */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2" data-cy={dataCy('bulk-actions')}>
                        <span className="text-sm text-muted-foreground">
                            {selectedIds.size} selected
                        </span>
                        <div className="flex items-center gap-2">
                            {bulkActions.map((action) => (
                                <Button
                                    key={action.id}
                                    variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                                    size="sm"
                                    onClick={() => action.onClick(Array.from(selectedIds))}
                                    className="gap-2"
                                >
                                    {action.icon}
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                        <button
                            onClick={clearSelection}
                            className="text-sm text-muted-foreground hover:text-foreground"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="border rounded-xl overflow-hidden">
                <table className="w-full" data-cy={dataCy('table')}>
                    <thead>
                        <tr className="bg-muted/50">
                            {/* Checkbox column */}
                            <th className="w-12 px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = !isAllSelected && isSomeSelected
                                    }}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                                />
                            </th>
                            {columns.map((column) => (
                                <th
                                    key={String(column.key)}
                                    className={cn(
                                        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                                        column.sortable && 'cursor-pointer hover:text-foreground select-none',
                                        column.className
                                    )}
                                    style={{ width: column.width }}
                                    onClick={() => column.sortable && handleSort(String(column.key))}
                                >
                                    <div className="flex items-center gap-1">
                                        {column.header}
                                        {column.sortable && renderSortIcon(String(column.key))}
                                    </div>
                                </th>
                            ))}
                            {/* Actions column */}
                            <th className="w-12 px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {paginatedData.length > 0 ? (
                            paginatedData.map((row, index) => (
                                <tr
                                    key={row.id}
                                    data-cy={dataCy(`row-${row.id}`)}
                                    className={cn(
                                        'bg-card transition-colors',
                                        onRowClick && 'cursor-pointer hover:bg-muted/50',
                                        selectedIds.has(row.id) && 'bg-primary/5',
                                        'animate-in fade-in'
                                    )}
                                    style={{ animationDelay: `${index * 20}ms`, animationFillMode: 'backwards' }}
                                >
                                    {/* Checkbox */}
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(row.id)}
                                            onChange={(e) => {
                                                e.stopPropagation()
                                                toggleSelectRow(row.id)
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                                        />
                                    </td>
                                    {columns.map((column) => (
                                        <td
                                            key={String(column.key)}
                                            className={cn('px-4 py-3 text-sm', column.className)}
                                            onClick={() => onRowClick?.(row)}
                                        >
                                            {column.render
                                                ? column.render(getCellValue(row, column), row)
                                                : getCellValue(row, column) ?? '-'}
                                        </td>
                                    ))}
                                    {/* Row actions */}
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onRowClick?.(row)
                                            }}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length + 2} className="px-4 py-16">
                                    <div className="flex flex-col items-center justify-center text-center" data-cy={dataCy('empty')}>
                                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                                            <Inbox className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground mb-1">
                                            {emptyMessage}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {emptyDescription}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between" data-cy={dataCy('pagination')}>
                    <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} results
                    </p>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="gap-1"
                            data-cy={dataCy('pagination-prev')}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter((page) => {
                                    if (totalPages <= 5) return true
                                    if (page === 1 || page === totalPages) return true
                                    return Math.abs(page - currentPage) <= 1
                                })
                                .map((page, index, arr) => (
                                    <React.Fragment key={page}>
                                        {index > 0 && arr[index - 1] !== page - 1 && (
                                            <span className="px-2 text-muted-foreground">...</span>
                                        )}
                                        <button
                                            onClick={() => setCurrentPage(page)}
                                            className={cn(
                                                'w-8 h-8 rounded-md text-sm font-medium transition-colors',
                                                page === currentPage
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'hover:bg-muted text-muted-foreground'
                                            )}
                                        >
                                            {page}
                                        </button>
                                    </React.Fragment>
                                ))}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                            data-cy={dataCy('pagination-next')}
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CRMDataTable

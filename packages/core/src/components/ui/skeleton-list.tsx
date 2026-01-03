/**
 * Skeleton components specifically for entity list pages
 * Provides realistic loading states that match the actual list content structure
 */

'use client'

import React from 'react'
import { Card, CardContent } from './card'
import { Skeleton } from './skeleton'

/**
 * Skeleton for the list page header with title and actions
 */
export function SkeletonListHeader() {
  return (
    <div className="flex items-center justify-between mb-8">
      {/* Title section */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-5 w-48" />
      </div>
      
      {/* Search and Add button */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/**
 * Skeleton for table headers
 */
export function SkeletonTableHeader({ columnCount = 6 }: { columnCount?: number }) {
  return (
    <thead className="border-b bg-muted/50">
      <tr>
        {/* Checkbox column */}
        <th className="w-12 px-4 py-3">
          <Skeleton className="h-4 w-4" />
        </th>
        {/* Data columns */}
        {Array.from({ length: columnCount }).map((_, index) => (
          <th key={index} className="px-4 py-3 text-left">
            <Skeleton className="h-4 w-24" />
          </th>
        ))}
        {/* Actions column */}
        <th className="w-16 px-4 py-3">
          <Skeleton className="h-4 w-16" />
        </th>
      </tr>
    </thead>
  )
}

/**
 * Skeleton for a single table row
 */
export function SkeletonTableRow({ columnCount = 6 }: { columnCount?: number }) {
  return (
    <tr className="border-b hover:bg-muted/50">
      {/* Checkbox column */}
      <td className="w-12 px-4 py-3">
        <Skeleton className="h-4 w-4" />
      </td>
      {/* Data columns */}
      {Array.from({ length: columnCount }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <Skeleton className={`h-4 ${
            index === 0 ? 'w-40' : // First column (name) - wider
            index === 1 ? 'w-32' : // Second column (category/type) - medium
            index === 2 ? 'w-48' : // Third column (url/email) - wider
            index === 3 ? 'w-24' : // Fourth column (status/short) - narrow
            index === 4 ? 'w-28' : // Fifth column (medium)
            'w-36' // Other columns
          }`} />
        </td>
      ))}
      {/* Actions column */}
      <td className="w-16 px-4 py-3">
        <Skeleton className="h-6 w-6 rounded" />
      </td>
    </tr>
  )
}

/**
 * Skeleton for the complete table
 */
export function SkeletonTable({ 
  rowCount = 8, 
  columnCount = 6 
}: { 
  rowCount?: number
  columnCount?: number 
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <SkeletonTableHeader columnCount={columnCount} />
          <tbody>
            {Array.from({ length: rowCount }).map((_, index) => (
              <SkeletonTableRow key={index} columnCount={columnCount} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/**
 * Skeleton for pagination at the bottom
 */
export function SkeletonPagination() {
  return (
    <div className="flex items-center justify-between mt-6">
      {/* Results info */}
      <Skeleton className="h-4 w-48" />
      
      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

/**
 * Skeleton for bulk actions bar (when items are selected)
 */
export function SkeletonBulkActions() {
  return (
    <Card className="mb-4">
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Complete skeleton for entity list page
 * Matches the layout of EntityListWrapper (p-6 space-y-6, full width)
 */
export function SkeletonEntityList({
  rowCount = 8,
  columnCount = 6,
  showBulkActions = false
}: {
  rowCount?: number
  columnCount?: number
  showBulkActions?: boolean
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <SkeletonListHeader />

      {/* Bulk actions (optional) */}
      {showBulkActions && <SkeletonBulkActions />}

      {/* Table */}
      <SkeletonTable rowCount={rowCount} columnCount={columnCount} />

      {/* Pagination */}
      <SkeletonPagination />
    </div>
  )
}

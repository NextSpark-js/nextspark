'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nextsparkjs/core/components/ui/table'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton'
import { ExternalLink, FileText, LayoutGrid, Newspaper } from 'lucide-react'
import type { PatternUsage } from '@nextsparkjs/core/hooks/usePatternUsages'

interface PatternUsageTableProps {
  usages: PatternUsage[]
  isLoading?: boolean
  emptyMessage?: string
}

/**
 * Icon mapping for common entity types
 */
const entityIcons: Record<string, React.ElementType> = {
  pages: FileText,
  posts: Newspaper,
  patterns: LayoutGrid,
}

/**
 * Get status badge variant
 */
function getStatusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'published':
      return 'default'
    case 'draft':
      return 'secondary'
    case 'archived':
      return 'outline'
    default:
      return 'secondary'
  }
}

/**
 * Format date for display
 */
function formatDate(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * PatternUsageTable
 *
 * Displays a table of entities that use a specific pattern,
 * with links to navigate to each entity.
 */
export function PatternUsageTable({
  usages,
  isLoading,
  emptyMessage = 'No usages found',
}: PatternUsageTableProps) {
  const router = useRouter()

  // Navigate to entity detail page
  const handleNavigateToEntity = (usage: PatternUsage) => {
    const url = `/dashboard/${usage.entityType}/${usage.entityId}`
    router.push(url)
  }

  if (isLoading) {
    return (
      <div className="rounded-md border" data-cy="pattern-usage-table-loading">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (usages.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center"
        data-cy="pattern-usage-table-empty"
      >
        <LayoutGrid className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No Usages Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border" data-cy="pattern-usage-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usages.map((usage) => {
            const Icon = entityIcons[usage.entityType] || FileText
            return (
              <TableRow key={usage.id} data-cy={`pattern-usage-row-${usage.id}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{usage.entityTitle || usage.entitySlug || usage.entityId}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="capitalize">{usage.entityType}</span>
                </TableCell>
                <TableCell>
                  {usage.entityStatus ? (
                    <Badge variant={getStatusVariant(usage.entityStatus)}>
                      {usage.entityStatus}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(usage.entityUpdatedAt || usage.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleNavigateToEntity(usage)}
                    title="View entity"
                    data-cy={`pattern-usage-view-${usage.id}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

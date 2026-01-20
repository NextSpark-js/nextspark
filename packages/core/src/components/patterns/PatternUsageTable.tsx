'use client'

import Link from 'next/link'
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
import { sel } from '@nextsparkjs/core/lib/test'
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
 * Get display name for entity
 * Priority: title > name > firstName+lastName > email > slug > id
 */
function getEntityDisplayName(usage: PatternUsage): string {
  if (usage.entityTitle) return usage.entityTitle
  if (usage.entityName) return usage.entityName
  if (usage.entityFirstName || usage.entityLastName) {
    return [usage.entityFirstName, usage.entityLastName].filter(Boolean).join(' ')
  }
  if (usage.entityEmail) return usage.entityEmail
  if (usage.entitySlug) return usage.entitySlug
  return usage.entityId
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
  if (isLoading) {
    return (
      <div className="rounded-md border" data-cy={sel('patterns.usageTable.loading')}>
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
        data-cy={sel('patterns.usageTable.empty')}
      >
        <LayoutGrid className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No Usages Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border" data-cy={sel('patterns.usageTable.container')}>
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
            const displayName = getEntityDisplayName(usage)
            const entityUrl = `/dashboard/${usage.entityType}/${usage.entityId}`
            return (
              <TableRow key={usage.id} data-cy={sel('patterns.usageTable.row', { id: usage.id })}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{displayName}</span>
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
                    asChild
                    data-cy={sel('patterns.usageTable.viewLink', { id: usage.id })}
                  >
                    <Link
                      href={entityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View entity (opens in new tab)"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
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

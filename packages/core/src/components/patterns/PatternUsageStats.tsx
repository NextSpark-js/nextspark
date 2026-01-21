'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { FileText, LayoutGrid, Newspaper, Hash } from 'lucide-react'
import { sel } from '@nextsparkjs/core/lib/test'
import type { PatternUsageCount } from '@nextsparkjs/core/hooks/usePatternUsages'

interface PatternUsageStatsProps {
  counts: PatternUsageCount[]
  total: number
  isLoading?: boolean
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
 * Get the icon for an entity type
 */
function getEntityIcon(entityType: string): React.ElementType {
  return entityIcons[entityType] || Hash
}

/**
 * Format entity type name for display
 */
function formatEntityType(entityType: string): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1)
}

/**
 * PatternUsageStats
 *
 * Displays usage count statistics as cards grouped by entity type.
 */
export function PatternUsageStats({ counts, total, isLoading }: PatternUsageStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-cy={sel('patterns.usageStats.loading')}>
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-cy={sel('patterns.usageStats.container')}>
      {/* Total Usage Card */}
      <Card data-cy={sel('patterns.usageStats.total')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
          <Hash className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{total}</div>
          <p className="text-xs text-muted-foreground">
            Across {counts.length} entity type{counts.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Individual Entity Type Cards */}
      {counts.map((item) => {
        const Icon = getEntityIcon(item.entityType)
        return (
          <Card key={item.entityType} data-cy={sel('patterns.usageStats.byType', { entityType: item.entityType })}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {formatEntityType(item.entityType)}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.count}</div>
              <p className="text-xs text-muted-foreground">
                {((item.count / total) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

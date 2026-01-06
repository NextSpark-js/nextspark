'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { cn } from '@nextsparkjs/core/lib/utils'
import {
  CheckSquare,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  CheckSquare,
  CheckCircle,
  AlertCircle,
  Clock,
}

interface StatsCardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: keyof typeof iconMap
}

export function StatsCard({ title, value, change, trend, icon }: StatsCardProps) {
  const Icon = iconMap[icon] || CheckSquare
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown
  const isPositive = trend === 'up'

  return (
    <Card data-cy="stats-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          <span
            className={cn(
              'inline-flex items-center gap-1',
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {change}
          </span>{' '}
          from last period
        </p>
      </CardContent>
    </Card>
  )
}

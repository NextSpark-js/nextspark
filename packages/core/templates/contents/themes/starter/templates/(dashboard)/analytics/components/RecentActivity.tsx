'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { cn } from '@nextsparkjs/core/lib/utils'
import { CheckCircle, Plus, Pencil, type LucideIcon } from 'lucide-react'

interface ActivityItem {
  id: string
  action: 'created' | 'completed' | 'updated'
  task: string
  time: string
}

// Sample activity data
const recentActivities: ActivityItem[] = [
  { id: '1', action: 'completed', task: 'Update user authentication flow', time: '5 minutes ago' },
  { id: '2', action: 'created', task: 'Design new dashboard layout', time: '12 minutes ago' },
  { id: '3', action: 'updated', task: 'Fix pagination bug in reports', time: '28 minutes ago' },
  { id: '4', action: 'completed', task: 'Write API documentation', time: '1 hour ago' },
  { id: '5', action: 'created', task: 'Implement dark mode toggle', time: '2 hours ago' },
  { id: '6', action: 'completed', task: 'Code review for PR #42', time: '3 hours ago' },
]

const actionConfig: Record<ActivityItem['action'], { icon: LucideIcon; color: string }> = {
  completed: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  },
  created: {
    icon: Plus,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  },
  updated: {
    icon: Pencil,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
  },
}

export function RecentActivity() {
  const t = useTranslations('analytics')

  return (
    <Card data-cy="recent-activity">
      <CardHeader>
        <CardTitle>{t('activity.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivities.map((activity) => {
            const config = actionConfig[activity.action]
            const Icon = config.icon

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3"
                data-cy="activity-item"
              >
                <div className={cn('p-1.5 rounded-full', config.color)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">
                    {activity.task}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(`activity.actions.${activity.action}`)} - {activity.time}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { cn } from '@nextsparkjs/core/lib/utils'

// Sample data for the chart
const weeklyData = [
  { day: 'Mon', completed: 12, created: 8 },
  { day: 'Tue', completed: 18, created: 14 },
  { day: 'Wed', completed: 15, created: 12 },
  { day: 'Thu', completed: 22, created: 16 },
  { day: 'Fri', completed: 28, created: 20 },
  { day: 'Sat', completed: 8, created: 4 },
  { day: 'Sun', completed: 5, created: 2 },
]

// Calculate max value for scaling
const maxValue = Math.max(...weeklyData.flatMap((d) => [d.completed, d.created]))

export function TasksChart() {
  const t = useTranslations('analytics')

  return (
    <Card data-cy="tasks-chart">
      <CardHeader>
        <CardTitle>{t('chart.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">{t('chart.completed')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-muted-foreground/40" />
              <span className="text-muted-foreground">{t('chart.created')}</span>
            </div>
          </div>

          {/* Simple Bar Chart */}
          <div className="flex items-end gap-2 h-[200px]">
            {weeklyData.map((data) => (
              <div key={data.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-0.5 h-[160px] w-full">
                  {/* Completed bar */}
                  <div
                    className={cn(
                      'flex-1 bg-primary rounded-t-sm transition-all duration-300',
                      'hover:bg-primary/80'
                    )}
                    style={{ height: `${(data.completed / maxValue) * 100}%` }}
                    title={`${t('chart.completed')}: ${data.completed}`}
                  />
                  {/* Created bar */}
                  <div
                    className={cn(
                      'flex-1 bg-muted-foreground/40 rounded-t-sm transition-all duration-300',
                      'hover:bg-muted-foreground/60'
                    )}
                    style={{ height: `${(data.created / maxValue) * 100}%` }}
                    title={`${t('chart.created')}: ${data.created}`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{data.day}</span>
              </div>
            ))}
          </div>

          {/* Chart note */}
          <p className="text-xs text-muted-foreground text-center">
            {t('chart.note')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

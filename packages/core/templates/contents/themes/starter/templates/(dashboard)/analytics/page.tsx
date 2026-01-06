import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { StatsCard, TasksChart, RecentActivity } from '../../../components/analytics'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('analytics')
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function AnalyticsPage() {
  const t = await getTranslations('analytics')

  return (
    <div className="space-y-6" data-cy="analytics-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Stats Grid - 4 cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title={t('stats.totalTasks')} value="128" change="+12%" trend="up" icon="CheckSquare" />
        <StatsCard title={t('stats.completedToday')} value="24" change="+8%" trend="up" icon="CheckCircle" />
        <StatsCard title={t('stats.overdue')} value="3" change="-25%" trend="down" icon="AlertCircle" />
        <StatsCard title={t('stats.avgCompletionTime')} value="2.4h" change="-10%" trend="down" icon="Clock" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <TasksChart />
        </div>
        <div className="col-span-3">
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}

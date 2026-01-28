'use client'

import { useUserProfile } from '@nextsparkjs/core/hooks/useUserProfile'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

import {
  Loader2,
  User,
  Activity,
  Settings,
  CreditCard,
  Users,
  BarChart3,
  ListTodo
} from 'lucide-react'

// Default dashboard page component
function DefaultDashboardPage() {
  const { user, isLoading } = useUserProfile()
  const router = useRouter()
  const t = useTranslations('dashboard')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const stats = [
    { 
      title: t('stats.accountStatus'), 
      value: t('stats.active'), 
      icon: <Activity className="h-4 w-4" />,
      trend: t('badges.verified')
    },
    { 
      title: t('stats.plan'), 
      value: t('stats.free'), 
      icon: <CreditCard className="h-4 w-4" />,
      trend: t('badges.basic')
    },
    { 
      title: t('stats.teamMembers'), 
      value: '1', 
      icon: <Users className="h-4 w-4" />,
      trend: t('badges.solo')
    },
    { 
      title: t('stats.usage'), 
      value: '0%', 
      icon: <BarChart3 className="h-4 w-4" />,
      trend: t('badges.low')
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-8" data-cy="dashboard-welcome">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('welcome', { name: user.firstName || user.email })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                {stat.icon}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <Badge variant="secondary" className="mt-1">
                  {stat.trend}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quickActions.title')}</CardTitle>
            <CardDescription>
              {t('quickActions.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-start gap-2"
                onClick={() => router.push('/dashboard/tasks')}
              >
                <ListTodo className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium">{t('quickActions.myTasks')}</p>
                  <p className="text-xs text-muted-foreground">{t('quickActions.myTasksDescription')}</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-start gap-2"
                onClick={() => router.push('/dashboard/settings/profile')}
              >
                <User className="h-5 w-5 text-green-500" />
                <div className="text-left">
                  <p className="font-medium">{t('quickActions.myProfile')}</p>
                  <p className="text-xs text-muted-foreground">{t('quickActions.myProfileDescription')}</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-start gap-2"
                onClick={() => router.push('/dashboard/settings')}
              >
                <Settings className="h-5 w-5 text-purple-500" />
                <div className="text-left">
                  <p className="font-medium">{t('quickActions.settings')}</p>
                  <p className="text-xs text-muted-foreground">{t('quickActions.settingsDescription')}</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-start gap-2"
                onClick={() => router.push('/dashboard/settings/billing')}
              >
                <CreditCard className="h-5 w-5 text-yellow-500" />
                <div className="text-left">
                  <p className="font-medium">{t('quickActions.billing')}</p>
                  <p className="text-xs text-muted-foreground">{t('quickActions.billingDescription')}</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('activity.title')}</CardTitle>
            <CardDescription>
              {t('activity.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 bg-blue-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('activity.signedIn')}</p>
                  <p className="text-xs text-muted-foreground">{t('activity.justNow')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('activity.accountCreated')}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(user.createdAt || '').toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Export the resolved component (theme override or default)
export default getTemplateOrDefaultClient('app/dashboard/(main)/page.tsx', DefaultDashboardPage)
/**
 * Activities Page
 * Professional activities management with timeline view and stats
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ActivityTimeline } from './components/ActivityTimeline'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
    Plus,
    CalendarDays,
    LayoutList,
    Phone,
    Mail,
    Users,
    CheckSquare,
    FileText,
    Activity,
    Clock,
    CheckCircle2
} from 'lucide-react'
import type { Activity as ActivityType } from './components/ActivityCard'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'

type ViewMode = 'timeline' | 'list'
type FilterType = 'all' | 'call' | 'email' | 'meeting' | 'task' | 'note'

// Filter configuration with icons
const filterConfig: Record<FilterType, { icon: typeof Phone; label: string }> = {
    all: { icon: Activity, label: 'All' },
    call: { icon: Phone, label: 'Calls' },
    email: { icon: Mail, label: 'Emails' },
    meeting: { icon: Users, label: 'Meetings' },
    task: { icon: CheckSquare, label: 'Tasks' },
    note: { icon: FileText, label: 'Notes' },
}

export default function ActivitiesPage() {
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [activities, setActivities] = useState<ActivityType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [viewMode, setViewMode] = useState<ViewMode>('timeline')
    const [filter, setFilter] = useState<FilterType>('all')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchActivities() {
            try {
                const response = await fetchWithTeam('/api/v1/activities')
                if (!response.ok) throw new Error('Failed to fetch activities')
                const result = await response.json()
                const data = result.data || []

                const transformedActivities: ActivityType[] = data
                    .map((act: any) => ({
                        id: act.id,
                        type: act.type,
                        subject: act.subject,
                        description: act.description,
                        status: act.status,
                        priority: act.priority || 'medium',
                        dueDate: act.dueDate,
                        completedAt: act.completedAt,
                        assignedTo: act.assignedTo,
                        assignedToName: act.assignedToName,
                        contactId: act.contactId,
                        contactName: act.contactName,
                        companyId: act.companyId,
                        companyName: act.companyName,
                    }))
                    .sort((a: ActivityType, b: ActivityType) =>
                        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                    )

                setActivities(transformedActivities)
            } catch (error) {
                console.error('Error loading activities:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchActivities()
    }, [teamLoading, currentTeam])

    const handleActivityClick = (activity: ActivityType) => {
        router.push(`/dashboard/activities/${activity.id}`)
    }

    const handleAddActivity = () => {
        router.push('/dashboard/activities/create')
    }

    // Filter activities by type
    const filteredActivities = filter === 'all'
        ? activities
        : activities.filter(act => act.type === filter)

    // Calculate stats
    const stats = {
        total: activities.length,
        scheduled: activities.filter(a => a.status === 'scheduled').length,
        completed: activities.filter(a => a.status === 'completed').length,
        overdue: activities.filter(a => a.status === 'overdue').length,
    }

    // Calculate filter counts
    const filterCounts: Record<FilterType, number> = {
        all: activities.length,
        call: activities.filter(a => a.type === 'call').length,
        email: activities.filter(a => a.type === 'email').length,
        meeting: activities.filter(a => a.type === 'meeting').length,
        task: activities.filter(a => a.type === 'task').length,
        note: activities.filter(a => a.type === 'note').length,
    }

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
                        <div className="h-4 w-64 bg-muted animate-pulse rounded-md" />
                    </div>
                    <div className="h-10 w-36 bg-muted animate-pulse rounded-lg" />
                </div>

                {/* Stats skeleton */}
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
                    ))}
                </div>

                {/* Content skeleton */}
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Activities
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Track and manage your sales activities
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* View toggle */}
                    <div className="flex p-1 bg-muted rounded-lg">
                        <button
                            className={cn(
                                'flex items-center justify-center w-9 h-9 rounded-md transition-all',
                                viewMode === 'timeline'
                                    ? 'bg-background shadow-sm text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                            onClick={() => setViewMode('timeline')}
                            title="Timeline view"
                        >
                            <CalendarDays className="w-4 h-4" />
                        </button>
                        <button
                            className={cn(
                                'flex items-center justify-center w-9 h-9 rounded-md transition-all',
                                viewMode === 'list'
                                    ? 'bg-background shadow-sm text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                            onClick={() => setViewMode('list')}
                            title="List view"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                    </div>

                    <Button onClick={handleAddActivity} className="gap-2" data-cy="activities-add">
                        <Plus className="w-4 h-4" />
                        New Activity
                    </Button>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Total Activities</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.scheduled}</p>
                            <p className="text-xs text-muted-foreground">Scheduled</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                            <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.overdue}</p>
                            <p className="text-xs text-muted-foreground">Overdue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
                {(Object.keys(filterConfig) as FilterType[]).map((key) => {
                    const config = filterConfig[key]
                    const Icon = config.icon
                    const count = filterCounts[key]
                    const isActive = filter === key

                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={cn(
                                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {config.label}
                            <span className={cn(
                                'ml-1 px-1.5 py-0.5 rounded text-xs',
                                isActive
                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                    : 'bg-background text-muted-foreground'
                            )}>
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Timeline */}
            <div className="mt-2" data-cy="activities-list">
                <ActivityTimeline
                    activities={filteredActivities}
                    onActivityClick={handleActivityClick}
                    groupByDate={viewMode === 'timeline'}
                />
            </div>
        </div>
    )
}

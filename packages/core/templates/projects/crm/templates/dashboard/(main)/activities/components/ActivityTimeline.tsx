/**
 * Activity Timeline Component
 * Professional timeline view with grouped dates and animations
 */

'use client'

import React from 'react'
import { ActivityCard, type Activity } from './ActivityCard'
import { CalendarDays, Inbox } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

interface ActivityTimelineProps {
    activities: Activity[]
    onActivityClick?: (activity: Activity) => void
    groupByDate?: boolean
}

export function ActivityTimeline({
    activities,
    onActivityClick,
    groupByDate = true,
}: ActivityTimelineProps) {
    // Group activities by date
    const groupedActivities = activities.reduce((acc, activity) => {
        const date = new Date(activity.dueDate)
        const dateKey = date.toDateString()

        if (!acc[dateKey]) {
            acc[dateKey] = []
        }
        acc[dateKey].push(activity)
        return acc
    }, {} as Record<string, Activity[]>)

    // Sort date keys
    const sortedDates = Object.keys(groupedActivities).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime()
    })

    const formatDateHeader = (dateStr: string): { main: string; sub?: string; isToday?: boolean; isPast?: boolean } => {
        const date = new Date(dateStr)
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        const isToday = date.toDateString() === today.toDateString()
        const isPast = date < today && !isToday

        if (isToday) {
            return { main: 'Today', sub: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), isToday: true }
        }
        if (date.toDateString() === tomorrow.toDateString()) {
            return { main: 'Tomorrow', sub: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
        }
        if (date.toDateString() === yesterday.toDateString()) {
            return { main: 'Yesterday', sub: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), isPast: true }
        }

        return {
            main: date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
            sub: date.getFullYear() !== today.getFullYear() ? date.getFullYear().toString() : undefined,
            isPast
        }
    }

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    No activities yet
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Schedule calls, meetings, and tasks to keep track of your sales activities.
                </p>
            </div>
        )
    }

    if (!groupByDate) {
        return (
            <div className="space-y-0">
                {activities.map((activity, index) => (
                    <div
                        key={activity.id}
                        className="animate-in fade-in slide-in-from-bottom-2"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                    >
                        <ActivityCard
                            activity={activity}
                            onClick={() => onActivityClick?.(activity)}
                        />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {sortedDates.map((dateKey, groupIndex) => {
                const dateInfo = formatDateHeader(dateKey)

                return (
                    <div
                        key={dateKey}
                        className="animate-in fade-in slide-in-from-bottom-3"
                        style={{ animationDelay: `${groupIndex * 100}ms`, animationFillMode: 'backwards' }}
                    >
                        {/* Date header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className={cn(
                                'flex items-center justify-center w-9 h-9 rounded-lg',
                                dateInfo.isToday ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            )}>
                                <CalendarDays className={cn(
                                    'w-4 h-4',
                                    dateInfo.isToday ? 'text-primary-foreground' : 'text-muted-foreground'
                                )} />
                            </div>
                            <div>
                                <h3 className={cn(
                                    'text-base font-semibold',
                                    dateInfo.isToday ? 'text-primary' : dateInfo.isPast ? 'text-muted-foreground' : 'text-foreground'
                                )}>
                                    {dateInfo.main}
                                </h3>
                                {dateInfo.sub && (
                                    <p className="text-xs text-muted-foreground">{dateInfo.sub}</p>
                                )}
                            </div>
                            <div className="flex-1 h-px bg-border ml-2" />
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                {groupedActivities[dateKey].length} {groupedActivities[dateKey].length === 1 ? 'activity' : 'activities'}
                            </span>
                        </div>

                        {/* Activities list */}
                        <div className="space-y-0 pl-1">
                            {groupedActivities[dateKey].map((activity, index) => (
                                <div
                                    key={activity.id}
                                    className="animate-in fade-in slide-in-from-left-2"
                                    style={{ animationDelay: `${(groupIndex * 100) + (index * 50)}ms`, animationFillMode: 'backwards' }}
                                >
                                    <ActivityCard
                                        activity={activity}
                                        onClick={() => onActivityClick?.(activity)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default ActivityTimeline

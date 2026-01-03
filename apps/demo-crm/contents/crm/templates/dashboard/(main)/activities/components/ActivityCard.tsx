/**
 * Activity Card Component
 * Professional card design for activities with modern styling
 */

'use client'

import React from 'react'
import { formatRelativeDate } from '@/themes/crm/lib/crm-utils'
import {
    Phone,
    Mail,
    Users,
    CheckSquare,
    FileText,
    Presentation,
    Monitor,
    Clock,
    Building2,
    User,
    type LucideIcon
} from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

export interface Activity {
    id: string
    type: 'call' | 'email' | 'meeting' | 'task' | 'note' | 'demo' | 'presentation'
    subject: string
    description?: string
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    dueDate: string | Date
    completedAt?: string | Date
    assignedTo?: string
    assignedToName?: string
    contactId?: string
    contactName?: string
    companyId?: string
    companyName?: string
}

interface ActivityCardProps {
    activity: Activity
    onClick?: () => void
}

// Type configuration with icons and colors
const activityTypeConfig: Record<Activity['type'], { icon: LucideIcon; bgClass: string; textClass: string }> = {
    call: { icon: Phone, bgClass: 'bg-[oklch(0.55_0.22_286/0.15)]', textClass: 'text-[oklch(0.55_0.22_286)]' },
    email: { icon: Mail, bgClass: 'bg-[oklch(0.55_0.18_150/0.15)]', textClass: 'text-[oklch(0.55_0.18_150)]' },
    meeting: { icon: Users, bgClass: 'bg-[oklch(0.65_0.18_80/0.15)]', textClass: 'text-[oklch(0.65_0.18_80)]' },
    task: { icon: CheckSquare, bgClass: 'bg-[oklch(0.55_0.2_320/0.15)]', textClass: 'text-[oklch(0.55_0.2_320)]' },
    note: { icon: FileText, bgClass: 'bg-muted', textClass: 'text-muted-foreground' },
    demo: { icon: Monitor, bgClass: 'bg-[oklch(0.55_0.22_286/0.15)]', textClass: 'text-[oklch(0.55_0.22_286)]' },
    presentation: { icon: Presentation, bgClass: 'bg-[oklch(0.65_0.18_80/0.15)]', textClass: 'text-[oklch(0.65_0.18_80)]' },
}

// Status badge configuration
const statusConfig: Record<Activity['status'], { label: string; className: string }> = {
    scheduled: { label: 'Scheduled', className: 'bg-primary/10 text-primary' },
    in_progress: { label: 'In Progress', className: 'bg-amber-500/10 text-amber-600' },
    completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-600' },
    cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
    overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive' },
}

// Priority indicator configuration
const priorityConfig: Record<Activity['priority'], { className: string }> = {
    low: { className: 'bg-muted-foreground/50' },
    medium: { className: 'bg-amber-500' },
    high: { className: 'bg-destructive' },
    urgent: { className: 'bg-destructive shadow-[0_0_8px_oklch(0.55_0.22_25)]' },
}

// Default fallback config for unknown activity types
const defaultTypeConfig = { icon: FileText, bgClass: 'bg-muted', textClass: 'text-muted-foreground' }
const defaultStatusConfig = { label: 'Unknown', className: 'bg-muted text-muted-foreground' }
const defaultPriorityConfig = { className: 'bg-muted-foreground/50' }

export function ActivityCard({ activity, onClick }: ActivityCardProps) {
    const typeConfig = activityTypeConfig[activity.type] || defaultTypeConfig
    const status = statusConfig[activity.status] || defaultStatusConfig
    const priority = priorityConfig[activity.priority] || defaultPriorityConfig
    const Icon = typeConfig.icon

    return (
        <div className="relative flex gap-4 pb-6 last:pb-0 group">
            {/* Timeline line */}
            <div className="absolute left-5 top-10 bottom-0 w-px bg-border group-last:hidden" />

            {/* Icon marker */}
            <div className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
                typeConfig.bgClass
            )}>
                <Icon className={cn('h-5 w-5', typeConfig.textClass)} />
            </div>

            {/* Content card */}
            <div
                className={cn(
                    'flex-1 rounded-xl border bg-card p-4 shadow-sm transition-all duration-200',
                    onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30'
                )}
                onClick={onClick}
                role={onClick ? 'button' : undefined}
                tabIndex={onClick ? 0 : undefined}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', priority.className)} />
                            <h4 className="font-semibold text-sm text-foreground truncate">
                                {activity.subject}
                            </h4>
                        </div>

                        {activity.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                {activity.description}
                            </p>
                        )}
                    </div>

                    <span className={cn(
                        'shrink-0 px-2.5 py-1 rounded-md text-xs font-medium capitalize',
                        status.className
                    )}>
                        {status.label}
                    </span>
                </div>

                {/* Meta information */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border/50">
                    {activity.assignedToName && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                                {activity.assignedToName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span>{activity.assignedToName}</span>
                        </div>
                    )}

                    {activity.companyName && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{activity.companyName}</span>
                        </div>
                    )}

                    {activity.contactName && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            <span>{activity.contactName}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatRelativeDate(activity.dueDate)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActivityCard

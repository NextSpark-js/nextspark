/**
 * CRM Dashboard Component
 * Professional dashboard with KPIs and Pipeline Summary
 *
 * Use this component in your dashboard page to display CRM metrics
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
    DollarSign,
    Users,
    UserPlus,
    Target,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    Flame,
    Building2,
    Activity,
    BarChart3
} from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

// Types
interface KPIData {
    totalRevenue: number
    revenueTrend: number
    totalDeals: number
    dealsTrend: number
    activeLeads: number
    leadsTrend: number
    conversionRate: number
    conversionTrend: number
}

interface PipelineStage {
    id: string
    name: string
    value: number
    count: number
    color: string
}

interface ActivityItem {
    id: string
    type: 'call' | 'email' | 'meeting' | 'task'
    title: string
    time: string
    status: 'scheduled' | 'completed' | 'overdue'
}

interface Deal {
    id: string
    name: string
    value: number
    company?: string
    probability: number
    stage: string
}

// KPI Card component
function KPICard({
    title,
    value,
    trend,
    icon: Icon,
    iconBg,
    prefix = '',
    suffix = '',
}: {
    title: string
    value: number | string
    trend?: number
    icon: React.ElementType
    iconBg: string
    prefix?: string
    suffix?: string
}) {
    const isPositive = trend && trend > 0
    const TrendIcon = isPositive ? TrendingUp : TrendingDown

    return (
        <div className="bg-card border rounded-xl p-5 transition-all hover:shadow-md hover:border-primary/20">
            <div className="flex items-start justify-between">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', iconBg)}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend !== undefined && (
                    <div className={cn(
                        'flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full',
                        isPositive
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-destructive/10 text-destructive'
                    )}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>
            <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">
                    {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
            </div>
        </div>
    )
}

// Pipeline Funnel component
function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
    const maxValue = Math.max(...stages.map(s => s.value), 1)

    return (
        <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="font-semibold text-foreground">Pipeline Overview</h3>
                    <p className="text-sm text-muted-foreground">Current deal distribution</p>
                </div>
                <Link href="/dashboard/pipelines">
                    <Button variant="ghost" size="sm" className="gap-1">
                        View All
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
            </div>

            <div className="space-y-3">
                {stages.map((stage) => (
                    <div key={stage.id} className="group">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="font-medium text-foreground">{stage.name}</span>
                            <span className="text-muted-foreground">
                                {stage.count} deals · ${stage.value.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-8 bg-muted/50 rounded-lg overflow-hidden relative">
                            <div
                                className={cn(
                                    'h-full rounded-lg transition-all duration-500 ease-out',
                                    stage.color
                                )}
                                style={{
                                    width: `${Math.max((stage.value / maxValue) * 100, 5)}%`,
                                }}
                            />
                            <div className="absolute inset-0 flex items-center px-3">
                                <span className="text-xs font-medium text-white drop-shadow-sm">
                                    ${stage.value.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Total Pipeline Value</p>
                        <p className="text-xl font-bold text-foreground">
                            ${stages.reduce((sum, s) => sum + s.value, 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Deals</p>
                        <p className="text-xl font-bold text-foreground">
                            {stages.reduce((sum, s) => sum + s.count, 0)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Activity status icon
function ActivityStatusIcon({ status }: { status: ActivityItem['status'] }) {
    if (status === 'completed') {
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />
    }
    if (status === 'overdue') {
        return <AlertCircle className="w-4 h-4 text-destructive" />
    }
    return <Clock className="w-4 h-4 text-amber-600" />
}

// Recent Activities component
function RecentActivities({ activities }: { activities: ActivityItem[] }) {
    const typeIcons = {
        call: '📞',
        email: '✉️',
        meeting: '📅',
        task: '✓',
    }

    return (
        <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="font-semibold text-foreground">Upcoming Activities</h3>
                    <p className="text-sm text-muted-foreground">Your schedule for today</p>
                </div>
                <Link href="/dashboard/activities">
                    <Button variant="ghost" size="sm" className="gap-1">
                        View All
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
            </div>

            <div className="space-y-3">
                {activities.length > 0 ? (
                    activities.map((activity) => (
                        <div
                            key={activity.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">
                                {typeIcons[activity.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">
                                    {activity.title}
                                </p>
                                <p className="text-xs text-muted-foreground">{activity.time}</p>
                            </div>
                            <ActivityStatusIcon status={activity.status} />
                        </div>
                    ))
                ) : (
                    <div className="py-8 text-center">
                        <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No activities scheduled</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// Hot Deals component
function HotDeals({ deals }: { deals: Deal[] }) {
    return (
        <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-destructive" />
                    <div>
                        <h3 className="font-semibold text-foreground">Hot Deals</h3>
                        <p className="text-sm text-muted-foreground">High-value opportunities</p>
                    </div>
                </div>
                <Link href="/dashboard/pipelines">
                    <Button variant="ghost" size="sm" className="gap-1">
                        View All
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
            </div>

            <div className="space-y-3">
                {deals.length > 0 ? (
                    deals.map((deal) => (
                        <div
                            key={deal.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">
                                    {deal.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    {deal.company && (
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Building2 className="w-3 h-3" />
                                            {deal.company}
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                        {deal.stage}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-primary text-sm">
                                    ${deal.value.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {deal.probability}% likely
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-8 text-center">
                        <Target className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No hot deals yet</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// Quick Stats Bar
function QuickStatsBar() {
    return (
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground">Welcome back!</p>
                        <p className="text-xs text-muted-foreground">Here's what's happening with your sales today.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/leads/create">
                        <Button size="sm" variant="outline" className="gap-2">
                            <UserPlus className="w-4 h-4" />
                            Add Lead
                        </Button>
                    </Link>
                    <Link href="/dashboard/pipelines">
                        <Button size="sm" className="gap-2">
                            <BarChart3 className="w-4 h-4" />
                            View Pipeline
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}

// Sales Performance Chart
function SalesPerformanceChart() {
    return (
        <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="font-semibold text-foreground">Sales Performance</h3>
                    <p className="text-sm text-muted-foreground">Monthly revenue trend</p>
                </div>
                <Button variant="ghost" size="sm">
                    This Month
                </Button>
            </div>

            {/* Simple bar chart visualization */}
            <div className="flex items-end gap-2 h-40 mt-4">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => {
                    const heights = [45, 60, 55, 75, 85, 70]
                    return (
                        <div key={month} className="flex-1 flex flex-col items-center gap-2">
                            <div
                                className="w-full bg-primary/80 rounded-t-md transition-all hover:bg-primary"
                                style={{ height: `${heights[i]}%` }}
                            />
                            <span className="text-xs text-muted-foreground">{month}</span>
                        </div>
                    )
                })}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">vs. Last Month</p>
                    <p className="text-lg font-semibold text-emerald-600">+18.2%</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Forecast</p>
                    <p className="text-lg font-semibold text-foreground">$312,000</p>
                </div>
            </div>
        </div>
    )
}

// Main CRM Dashboard Component
export interface CRMDashboardProps {
    kpis?: KPIData
    pipelineStages?: PipelineStage[]
    activities?: ActivityItem[]
    hotDeals?: Deal[]
    isLoading?: boolean
}

export function CRMDashboard({
    kpis,
    pipelineStages,
    activities,
    hotDeals,
    isLoading = false,
}: CRMDashboardProps) {
    // Default mock data if not provided
    const defaultKPIs: KPIData = kpis || {
        totalRevenue: 284500,
        revenueTrend: 12.5,
        totalDeals: 47,
        dealsTrend: 8,
        activeLeads: 156,
        leadsTrend: -3,
        conversionRate: 24,
        conversionTrend: 5,
    }

    const defaultPipelineStages: PipelineStage[] = pipelineStages || [
        { id: '1', name: 'Discovery', value: 125000, count: 18, color: 'bg-violet-500' },
        { id: '2', name: 'Qualification', value: 89000, count: 12, color: 'bg-primary' },
        { id: '3', name: 'Proposal', value: 67000, count: 8, color: 'bg-amber-500' },
        { id: '4', name: 'Negotiation', value: 45000, count: 5, color: 'bg-orange-500' },
        { id: '5', name: 'Closed Won', value: 284500, count: 4, color: 'bg-emerald-500' },
    ]

    const defaultActivities: ActivityItem[] = activities || [
        { id: '1', type: 'call', title: 'Follow up with Acme Corp', time: '10:00 AM', status: 'scheduled' },
        { id: '2', type: 'meeting', title: 'Demo with Tech Solutions', time: '2:00 PM', status: 'scheduled' },
        { id: '3', type: 'email', title: 'Send proposal to GlobalTech', time: '4:00 PM', status: 'scheduled' },
        { id: '4', type: 'task', title: 'Update CRM records', time: 'Yesterday', status: 'overdue' },
    ]

    const defaultHotDeals: Deal[] = hotDeals || [
        { id: '1', name: 'Enterprise License Deal', value: 85000, company: 'Acme Corp', probability: 85, stage: 'Negotiation' },
        { id: '2', name: 'Annual Subscription', value: 45000, company: 'Tech Solutions', probability: 75, stage: 'Proposal' },
        { id: '3', name: 'Consulting Package', value: 32000, company: 'GlobalTech', probability: 70, stage: 'Qualification' },
    ]

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <div className="h-16 bg-muted animate-pulse rounded-xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
                    ))}
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="h-80 bg-muted animate-pulse rounded-xl" />
                    <div className="h-80 bg-muted animate-pulse rounded-xl" />
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Quick Stats Bar */}
            <QuickStatsBar />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Total Revenue"
                    value={defaultKPIs.totalRevenue}
                    trend={defaultKPIs.revenueTrend}
                    icon={DollarSign}
                    iconBg="bg-emerald-500/10 text-emerald-600"
                    prefix="$"
                />
                <KPICard
                    title="Active Deals"
                    value={defaultKPIs.totalDeals}
                    trend={defaultKPIs.dealsTrend}
                    icon={Target}
                    iconBg="bg-primary/10 text-primary"
                />
                <KPICard
                    title="Active Leads"
                    value={defaultKPIs.activeLeads}
                    trend={defaultKPIs.leadsTrend}
                    icon={Users}
                    iconBg="bg-amber-500/10 text-amber-600"
                />
                <KPICard
                    title="Conversion Rate"
                    value={defaultKPIs.conversionRate}
                    trend={defaultKPIs.conversionTrend}
                    icon={TrendingUp}
                    iconBg="bg-violet-500/10 text-violet-600"
                    suffix="%"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Pipeline Funnel */}
                <PipelineFunnel stages={defaultPipelineStages} />

                {/* Hot Deals */}
                <HotDeals deals={defaultHotDeals} />
            </div>

            {/* Bottom Section */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Activities */}
                <RecentActivities activities={defaultActivities} />

                {/* Performance Chart */}
                <SalesPerformanceChart />
            </div>
        </div>
    )
}

export default CRMDashboard

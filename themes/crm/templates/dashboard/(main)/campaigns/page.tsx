/**
 * Campaigns Page
 * Professional marketing campaigns management with data table
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/themes/crm/templates/shared/CRMDataTable'
import {
    Plus,
    Megaphone,
    Trash2,
    Download,
    Calendar,
    Target,
    Users,
    TrendingUp,
    Mail,
    MousePointerClick,
    DollarSign,
    Pause,
    Play
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

interface Campaign {
    id: string
    name: string
    description?: string
    type: 'email' | 'social' | 'ads' | 'content' | 'event'
    status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed'
    startDate?: string
    endDate?: string
    budget?: number
    spent?: number
    leads?: number
    conversions?: number
    clickRate?: number
    createdAt: string
}

// Campaign type badge
function TypeBadge({ type }: { type: Campaign['type'] }) {
    const config = {
        email: { label: 'Email', icon: Mail, className: 'bg-primary/10 text-primary' },
        social: { label: 'Social', icon: Users, className: 'bg-violet-500/10 text-violet-600' },
        ads: { label: 'Ads', icon: MousePointerClick, className: 'bg-amber-500/10 text-amber-600' },
        content: { label: 'Content', icon: Megaphone, className: 'bg-emerald-500/10 text-emerald-600' },
        event: { label: 'Event', icon: Calendar, className: 'bg-rose-500/10 text-rose-600' },
    }

    const { label, icon: Icon, className } = config[type] || config.email

    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium', className)}>
            <Icon className="w-3 h-3" />
            {label}
        </span>
    )
}

// Status badge
function StatusBadge({ status }: { status: Campaign['status'] }) {
    const config = {
        draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
        scheduled: { label: 'Scheduled', className: 'bg-amber-500/10 text-amber-600' },
        active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600' },
        paused: { label: 'Paused', className: 'bg-orange-500/10 text-orange-600' },
        completed: { label: 'Completed', className: 'bg-primary/10 text-primary' },
    }

    const { label, className } = config[status] || config.draft

    return (
        <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', className)}>
            {label}
        </span>
    )
}

// Budget progress bar
function BudgetProgress({ budget, spent }: { budget?: number; spent?: number }) {
    if (!budget) return <span className="text-muted-foreground">-</span>

    const percentage = spent ? Math.min((spent / budget) * 100, 100) : 0
    let barColor = 'bg-emerald-500'
    if (percentage >= 90) barColor = 'bg-destructive'
    else if (percentage >= 75) barColor = 'bg-amber-500'

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                    ${(spent || 0).toLocaleString()} / ${budget.toLocaleString()}
                </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all', barColor)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    )
}

export default function CampaignsPage() {
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Permission checks for bulk actions
    const canDeleteCampaigns = usePermission('campaigns.delete')
    const canUpdateCampaigns = usePermission('campaigns.update')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchCampaigns() {
            try {
                const response = await fetchWithTeam('/api/v1/campaigns')
                if (!response.ok) throw new Error('Failed to fetch campaigns')
                const result = await response.json()
                setCampaigns(result.data || [])
            } catch (error) {
                console.error('Error loading campaigns:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchCampaigns()
    }, [teamLoading, currentTeam])

    // Stats
    const stats = useMemo(() => {
        const active = campaigns.filter(c => c.status === 'active').length
        const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads || 0), 0)
        const totalSpent = campaigns.reduce((sum, c) => sum + (c.spent || 0), 0)
        const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0)

        return {
            total: campaigns.length,
            active,
            totalLeads,
            totalSpent,
            totalConversions,
        }
    }, [campaigns])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const formatDate = (date?: string) => {
        if (!date) return '-'
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }

    // Column definitions
    const columns: Column<Campaign>[] = [
        {
            key: 'name',
            header: 'Campaign',
            sortable: true,
            render: (_, campaign) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Megaphone className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{campaign.name}</p>
                        {campaign.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {campaign.description}
                            </p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'type',
            header: 'Type',
            sortable: true,
            render: (value) => <TypeBadge type={value} />,
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (value) => <StatusBadge status={value} />,
        },
        {
            key: 'dates',
            header: 'Duration',
            render: (_, campaign) => (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                        {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                    </span>
                </div>
            ),
        },
        {
            key: 'budget',
            header: 'Budget',
            sortable: true,
            render: (_, campaign) => (
                <BudgetProgress budget={campaign.budget} spent={campaign.spent} />
            ),
            width: '150px',
        },
        {
            key: 'leads',
            header: 'Leads',
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{value || 0}</span>
                </div>
            ),
        },
        {
            key: 'conversions',
            header: 'Conversions',
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-medium text-emerald-600">{value || 0}</span>
                </div>
            ),
        },
    ]

    // Bulk actions - filtered by permissions
    const bulkActions: BulkAction[] = [
        {
            id: 'export',
            label: 'Export',
            icon: <Download className="w-4 h-4" />,
            onClick: (ids) => console.log('Export:', ids),
        },
        // Only show pause action if user has update permission
        ...(canUpdateCampaigns ? [{
            id: 'pause',
            label: 'Pause',
            icon: <Pause className="w-4 h-4" />,
            onClick: (ids: string[]) => { if (confirm(`Pause ${ids.length} campaigns?`)) console.log('Pause:', ids) },
        }] : []),
        // Only show delete action if user has permission
        ...(canDeleteCampaigns ? [{
            id: 'delete',
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: (ids: string[]) => { if (confirm(`Delete ${ids.length} campaigns?`)) console.log('Delete:', ids) },
        }] : []),
    ]

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Campaigns</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage and track your marketing campaigns
                    </p>
                </div>
                <PermissionGate permission="campaigns.create">
                    <Button onClick={() => router.push('/dashboard/campaigns/create')} className="gap-2" data-cy="campaigns-add">
                        <Plus className="w-4 h-4" />
                        New Campaign
                    </Button>
                </PermissionGate>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Campaigns</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Play className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                            <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalLeads}</p>
                            <p className="text-xs text-muted-foreground">Leads</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalConversions}</p>
                            <p className="text-xs text-muted-foreground">Conversions</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalSpent)}</p>
                            <p className="text-xs text-muted-foreground">Spent</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CRMDataTable
                data={campaigns}
                columns={columns}
                bulkActions={bulkActions}
                onRowClick={(c) => router.push(`/dashboard/campaigns/${c.id}`)}
                isLoading={isLoading}
                searchPlaceholder="Search campaigns..."
                searchFields={['name', 'description', 'type']}
                pageSize={15}
                emptyMessage="No campaigns yet"
                emptyDescription="Start creating campaigns to track your marketing efforts."
                entitySlug="campaigns"
            />
        </div>
    )
}

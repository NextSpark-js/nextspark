/**
 * Opportunities Page
 * Professional opportunities management with data table and bulk actions
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/themes/crm/templates/shared/CRMDataTable'
import {
    Plus,
    Target,
    Trash2,
    Download,
    DollarSign,
    Building2,
    Calendar,
    TrendingUp,
    Clock,
    CheckCircle2
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

interface Opportunity {
    id: string
    name: string
    amount: number
    currency?: string
    probability?: number
    stage?: string
    stageId?: string
    pipelineId?: string
    pipelineName?: string
    companyId?: string
    companyName?: string
    expectedCloseDate?: string
    status?: 'open' | 'won' | 'lost'
    createdAt: string
    updatedAt: string
}

// Stage badge component
function StageBadge({ stage }: { stage?: string }) {
    if (!stage) return <span className="text-muted-foreground">-</span>

    return (
        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary capitalize">
            {stage}
        </span>
    )
}

// Status badge component
function StatusBadge({ status }: { status?: Opportunity['status'] }) {
    const config = {
        open: { label: 'Open', className: 'bg-amber-500/10 text-amber-600', icon: Clock },
        won: { label: 'Won', className: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
        lost: { label: 'Lost', className: 'bg-muted text-muted-foreground', icon: Target },
    }

    const statusConfig = config[status || 'open'] || config.open
    const Icon = statusConfig.icon

    return (
        <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium', statusConfig.className)}>
            <Icon className="w-3 h-3" />
            <span>{statusConfig.label}</span>
        </div>
    )
}

// Probability indicator
function ProbabilityIndicator({ probability }: { probability?: number }) {
    const value = probability || 0

    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all',
                        value >= 80 ? 'bg-emerald-500' :
                            value >= 50 ? 'bg-amber-500' : 'bg-muted-foreground'
                    )}
                    style={{ width: `${value}%` }}
                />
            </div>
            <span className="text-sm text-muted-foreground">{value}%</span>
        </div>
    )
}

export default function OpportunitiesPage() {
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [opportunities, setOpportunities] = useState<Opportunity[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Permission checks for bulk actions
    const canDeleteOpportunities = usePermission('opportunities.delete')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchOpportunities() {
            try {
                const response = await fetchWithTeam('/api/v1/opportunities')
                if (!response.ok) throw new Error('Failed to fetch opportunities')
                const result = await response.json()
                setOpportunities(result.data || [])
            } catch (error) {
                console.error('Error loading opportunities:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchOpportunities()
    }, [teamLoading, currentTeam])

    // Stats
    const stats = useMemo(() => {
        const totalValue = opportunities.reduce((sum, o) => sum + (o.amount || 0), 0)
        const openCount = opportunities.filter(o => o.status !== 'won' && o.status !== 'lost').length
        const wonCount = opportunities.filter(o => o.status === 'won').length
        const avgProbability = opportunities.length > 0
            ? Math.round(opportunities.reduce((sum, o) => sum + (o.probability || 0), 0) / opportunities.length)
            : 0

        return {
            total: opportunities.length,
            totalValue,
            openCount,
            wonCount,
            avgProbability,
        }
    }, [opportunities])

    const formatCurrency = (value: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    // Column definitions
    const columns: Column<Opportunity>[] = [
        {
            key: 'name',
            header: 'Opportunity',
            sortable: true,
            render: (_, opportunity) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        <Target className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{opportunity.name}</p>
                        {opportunity.pipelineName && (
                            <p className="text-xs text-muted-foreground">{opportunity.pipelineName}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'companyName',
            header: 'Company',
            sortable: true,
            render: (value, opportunity) => value ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        if (opportunity.companyId) {
                            router.push(`/dashboard/companies/${opportunity.companyId}`)
                        }
                    }}
                    className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className={opportunity.companyId ? 'hover:underline' : ''}>{value}</span>
                </button>
            ) : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'amount',
            header: 'Value',
            sortable: true,
            render: (value, opportunity) => (
                <span className="font-semibold text-primary">
                    {formatCurrency(value || 0, opportunity.currency)}
                </span>
            ),
        },
        {
            key: 'stage',
            header: 'Stage',
            sortable: true,
            render: (value) => <StageBadge stage={value} />,
        },
        {
            key: 'probability',
            header: 'Probability',
            sortable: true,
            render: (value) => <ProbabilityIndicator probability={value} />,
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (value) => <StatusBadge status={value} />,
        },
        {
            key: 'expectedCloseDate',
            header: 'Expected Close',
            sortable: true,
            render: (value) => value ? (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(value).toLocaleDateString()}</span>
                </div>
            ) : <span className="text-muted-foreground">-</span>,
        },
    ]

    // Bulk actions - filtered by permissions
    const bulkActions: BulkAction[] = [
        {
            id: 'export',
            label: 'Export',
            icon: <Download className="w-4 h-4" />,
            onClick: (ids) => {
                console.log('Export opportunities:', ids)
            },
        },
        // Only show delete action if user has permission
        ...(canDeleteOpportunities ? [{
            id: 'delete',
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: async (ids: string[]) => {
                if (confirm(`Delete ${ids.length} opportunity(ies)?`)) {
                    console.log('Delete opportunities:', ids)
                }
            },
        }] : []),
    ]

    const handleRowClick = (opportunity: Opportunity) => {
        router.push(`/dashboard/opportunities/${opportunity.id}`)
    }

    const handleAddOpportunity = () => {
        router.push('/dashboard/opportunities/create')
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Opportunities
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Track and manage your sales opportunities
                    </p>
                </div>
                <Button onClick={handleAddOpportunity} className="gap-2" data-cy="opportunities-add">
                    <Plus className="w-4 h-4" />
                    Add Opportunity
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Total Opportunities</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalValue)}</p>
                            <p className="text-xs text-muted-foreground">Pipeline Value</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.wonCount}</p>
                            <p className="text-xs text-muted-foreground">Won</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.avgProbability}%</p>
                            <p className="text-xs text-muted-foreground">Avg. Probability</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CRMDataTable
                data={opportunities}
                columns={columns}
                bulkActions={bulkActions}
                onRowClick={handleRowClick}
                isLoading={isLoading}
                searchPlaceholder="Search opportunities..."
                searchFields={['name', 'companyName', 'stage']}
                pageSize={15}
                emptyMessage="No opportunities yet"
                emptyDescription="Start adding opportunities to track your sales pipeline."
                entitySlug="opportunities"
            />
        </div>
    )
}

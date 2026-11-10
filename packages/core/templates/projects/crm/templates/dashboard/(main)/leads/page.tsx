/**
 * Leads Page
 * Professional leads management with data table and bulk actions
 */

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatLocaleDate } from '@nextsparkjs/core/lib/i18n/format'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/templates/shared/CRMDataTable'
import {
    Plus,
    UserPlus,
    Flame,
    ThermometerSun,
    Snowflake,
    Trash2,
    Download,
    ArrowRightCircle,
    Mail,
    Phone,
    Building2,
    Calendar
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

interface Lead {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string
    companyName?: string
    title?: string
    source?: string
    status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
    score?: number
    createdAt: string
    updatedAt: string
}

// Score badge component
function LeadScoreBadge({ score }: { score?: number }) {
    const t = useTranslations('crm.list')
    if (!score) return <span className="text-muted-foreground">-</span>

    let Icon = Snowflake
    let bgClass = 'bg-muted'
    let textClass = 'text-muted-foreground'
    let label = t('leads.score.cold')

    if (score >= 80) {
        Icon = Flame
        bgClass = 'bg-destructive/10'
        textClass = 'text-destructive'
        label = t('leads.score.hot')
    } else if (score >= 50) {
        Icon = ThermometerSun
        bgClass = 'bg-amber-500/10'
        textClass = 'text-amber-600'
        label = t('leads.score.warm')
    }

    return (
        <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium', bgClass, textClass)}>
            <Icon className="w-3 h-3" />
            <span>{score}</span>
            <span className="opacity-70">({label})</span>
        </div>
    )
}

// Status badge component
function StatusBadge({ status }: { status: Lead['status'] }) {
    const t = useTranslations('crm.list')
    const config = {
        new: { label: t('leads.status.new'), className: 'bg-primary/10 text-primary' },
        contacted: { label: t('leads.status.contacted'), className: 'bg-amber-500/10 text-amber-600' },
        qualified: { label: t('leads.status.qualified'), className: 'bg-emerald-500/10 text-emerald-600' },
        converted: { label: t('leads.status.converted'), className: 'bg-violet-500/10 text-violet-600' },
        lost: { label: t('leads.status.lost'), className: 'bg-muted text-muted-foreground' },
    }

    const { label, className } = config[status] || config.new

    return (
        <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', className)}>
            {label}
        </span>
    )
}

export default function LeadsPage() {
    const t = useTranslations('crm.list')
    const locale = useLocale()
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [leads, setLeads] = useState<Lead[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Permission checks for bulk actions
    const canDeleteLeads = usePermission('leads.delete')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchLeads() {
            try {
                const response = await fetchWithTeam('/api/v1/leads')
                if (!response.ok) throw new Error('Failed to fetch leads')
                const result = await response.json()
                setLeads(result.data || [])
            } catch (error) {
                console.error('Error loading leads:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchLeads()
    }, [teamLoading, currentTeam])

    // Stats
    const stats = useMemo(() => ({
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        hot: leads.filter(l => (l.score || 0) >= 80).length,
    }), [leads])

    // Column definitions
    const columns: Column<Lead>[] = [
        {
            key: 'name',
            header: t('leads.columns.name'),
            sortable: true,
            render: (_, lead) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {lead.firstName?.[0]?.toUpperCase()}{lead.lastName?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-foreground">
                            {lead.firstName} {lead.lastName}
                        </p>
                        {lead.title && (
                            <p className="text-xs text-muted-foreground">{lead.title}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'contact',
            header: t('leads.columns.contact'),
            render: (_, lead) => (
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[180px]">{lead.email}</span>
                    </div>
                    {lead.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{lead.phone}</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'companyName',
            header: t('leads.columns.company'),
            sortable: true,
            render: (value) => value ? (
                <div className="flex items-center gap-1.5 text-sm">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{value}</span>
                </div>
            ) : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'score',
            header: t('leads.columns.score'),
            sortable: true,
            render: (value) => <LeadScoreBadge score={value} />,
        },
        {
            key: 'status',
            header: t('leads.columns.status'),
            sortable: true,
            render: (value) => <StatusBadge status={value} />,
        },
        {
            key: 'createdAt',
            header: t('leads.columns.created'),
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatLocaleDate(value, locale)}</span>
                </div>
            ),
        },
    ]

    // Bulk actions - filtered by permissions
    const bulkActions: BulkAction[] = [
        {
            id: 'export',
            label: t('common.export'),
            icon: <Download className="w-4 h-4" />,
            onClick: (ids) => {
                console.log('Export leads:', ids)
                // Implement export logic
            },
        },
        {
            id: 'convert',
            label: t('leads.convert'),
            icon: <ArrowRightCircle className="w-4 h-4" />,
            onClick: (ids) => {
                console.log('Convert leads:', ids)
                // Implement convert logic
            },
        },
        // Only show delete action if user has permission
        ...(canDeleteLeads ? [{
            id: 'delete',
            label: t('common.delete'),
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: async (ids: string[]) => {
                if (confirm(t('leads.deleteConfirm', { count: ids.length }))) {
                    console.log('Delete leads:', ids)
                    // Implement delete logic
                }
            },
        }] : []),
    ]

    const handleRowClick = (lead: Lead) => {
        router.push(`/dashboard/leads/${lead.id}`)
    }

    const handleAddLead = () => {
        router.push('/dashboard/leads/create')
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        {t('leads.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('leads.subtitle')}
                    </p>
                </div>
                <Button onClick={handleAddLead} className="gap-2" data-cy="leads-add">
                    <UserPlus className="w-4 h-4" />
                    {t('leads.add')}
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">{t('leads.stats.total')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.new}</p>
                            <p className="text-xs text-muted-foreground">{t('leads.stats.new')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <ArrowRightCircle className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.qualified}</p>
                            <p className="text-xs text-muted-foreground">{t('leads.stats.qualified')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <Flame className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.hot}</p>
                            <p className="text-xs text-muted-foreground">{t('leads.stats.hot')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CRMDataTable
                data={leads}
                columns={columns}
                bulkActions={bulkActions}
                onRowClick={handleRowClick}
                isLoading={isLoading}
                searchPlaceholder={t('leads.search')}
                searchFields={['firstName', 'lastName', 'email', 'companyName']}
                pageSize={15}
                emptyMessage={t('leads.empty')}
                emptyDescription={t('leads.emptyDescription')}
                entitySlug="leads"
            />
        </div>
    )
}

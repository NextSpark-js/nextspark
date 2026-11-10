/**
 * Companies Page
 * Professional companies management with data table
 */

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/templates/shared/CRMDataTable'
import {
    Plus,
    Building2,
    Trash2,
    Download,
    Globe,
    Users,
    Target,
    DollarSign
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { fetchRows, sumNumeric, withCompanyCounts } from '@/lib/crm-utils'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

interface Company {
    id: string
    name: string
    industry?: string
    website?: string
    size?: 'startup' | 'small' | 'medium' | 'enterprise'
    employeeCount?: number
    contactCount?: number
    opportunityCount?: number
    totalPipelineValue?: number
    createdAt: string
}

// Size badge component
function SizeBadge({ size }: { size?: Company['size'] | string }) {
    const t = useTranslations('crm.list')
    const config: Record<string, { label: string; className: string }> = {
        startup: { label: t('companies.size.startup'), className: 'bg-violet-500/10 text-violet-600' },
        small: { label: t('companies.size.small'), className: 'bg-amber-500/10 text-amber-600' },
        medium: { label: t('companies.size.medium'), className: 'bg-emerald-500/10 text-emerald-600' },
        enterprise: { label: t('companies.size.enterprise'), className: 'bg-primary/10 text-primary' },
    }

    if (!size) return <span className="text-muted-foreground">-</span>

    const sizeConfig = config[size]
    if (!sizeConfig) {
        // Fallback for unknown size values
        return (
            <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground capitalize')}>
                {size}
            </span>
        )
    }

    return (
        <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', sizeConfig.className)}>
            {sizeConfig.label}
        </span>
    )
}

export default function CompaniesPage() {
    const t = useTranslations('crm.list')
    const locale = useLocale()
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [companies, setCompanies] = useState<Company[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Permission checks for bulk actions
    const canDeleteCompanies = usePermission('companies.delete')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchCompanies() {
            try {
                const response = await fetchWithTeam('/api/v1/companies')
                if (!response.ok) throw new Error('Failed to fetch companies')
                const result = await response.json()
                // the companies table has no counters: they come from the contacts and the opportunities that point to each company
                const [contacts, opportunities] = await Promise.all([
                    fetchRows<{ companyId?: string }>('/api/v1/contacts'),
                    fetchRows<{ companyId?: string; amount?: unknown; status?: string }>('/api/v1/opportunities'),
                ])
                setCompanies(withCompanyCounts<Company>(result.data || [], contacts, opportunities))
            } catch (error) {
                console.error('Error loading companies:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchCompanies()
    }, [teamLoading, currentTeam])

    // Stats
    const stats = useMemo(() => {
        const totalContacts = sumNumeric(companies.map(c => c.contactCount))
        const totalOpportunities = sumNumeric(companies.map(c => c.opportunityCount))
        const totalPipeline = sumNumeric(companies.map(c => c.totalPipelineValue))

        return {
            total: companies.length,
            totalContacts,
            totalOpportunities,
            totalPipeline,
        }
    }, [companies])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    // Column definitions
    const columns: Column<Company>[] = [
        {
            key: 'name',
            header: t('companies.columns.company'),
            sortable: true,
            render: (_, company) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {company.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{company.name}</p>
                        {company.industry && (
                            <p className="text-xs text-muted-foreground">{company.industry}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'website',
            header: t('companies.columns.website'),
            render: (value: string) => value ? (
                <a
                    href={value.startsWith('http') ? value : `https://${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                    <Globe className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[150px]">{value.replace(/^https?:\/\//, '')}</span>
                </a>
            ) : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'size',
            header: t('companies.columns.size'),
            sortable: true,
            render: (value) => <SizeBadge size={value} />,
        },
        {
            key: 'contactCount',
            header: t('companies.columns.contacts'),
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{value || 0}</span>
                </div>
            ),
        },
        {
            key: 'opportunityCount',
            header: t('companies.columns.opportunities'),
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{value || 0}</span>
                </div>
            ),
        },
        {
            key: 'totalPipelineValue',
            header: t('companies.columns.pipelineValue'),
            sortable: true,
            render: (value) => (
                <span className="font-medium text-primary">
                    {value ? formatCurrency(sumNumeric([value])) : '-'}
                </span>
            ),
        },
    ]

    // Bulk actions - filtered by permissions
    const bulkActions: BulkAction[] = [
        {
            id: 'export',
            label: t('common.export'),
            icon: <Download className="w-4 h-4" />,
            onClick: (ids) => console.log('Export:', ids),
        },
        // Only show delete action if user has permission
        ...(canDeleteCompanies ? [{
            id: 'delete',
            label: t('common.delete'),
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: (ids: string[]) => { if (confirm(t('companies.deleteConfirm', { count: ids.length }))) console.log('Delete:', ids) },
        }] : []),
    ]

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('companies.title')}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('companies.subtitle')}
                    </p>
                </div>
                <PermissionGate permission="companies.create">
                    <Button onClick={() => router.push('/dashboard/companies/create')} className="gap-2" data-cy="companies-add">
                        <Plus className="w-4 h-4" />
                        {t('companies.add')}
                    </Button>
                </PermissionGate>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">{t('companies.stats.total')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalContacts}</p>
                            <p className="text-xs text-muted-foreground">{t('companies.stats.contacts')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalOpportunities}</p>
                            <p className="text-xs text-muted-foreground">{t('companies.stats.opportunities')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalPipeline)}</p>
                            <p className="text-xs text-muted-foreground">{t('companies.stats.pipelineValue')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CRMDataTable
                data={companies}
                columns={columns}
                bulkActions={bulkActions}
                onRowClick={(c) => router.push(`/dashboard/companies/${c.id}`)}
                isLoading={isLoading}
                searchPlaceholder={t('companies.search')}
                searchFields={['name', 'industry', 'website']}
                pageSize={15}
                emptyMessage={t('companies.empty')}
                emptyDescription={t('companies.emptyDescription')}
                entitySlug="companies"
            />
        </div>
    )
}

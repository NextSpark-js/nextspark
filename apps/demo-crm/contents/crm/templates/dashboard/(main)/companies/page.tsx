/**
 * Companies Page
 * Professional companies management with data table
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/themes/crm/templates/shared/CRMDataTable'
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
    const config: Record<string, { label: string; className: string }> = {
        startup: { label: 'Startup', className: 'bg-violet-500/10 text-violet-600' },
        small: { label: 'Small', className: 'bg-amber-500/10 text-amber-600' },
        medium: { label: 'Medium', className: 'bg-emerald-500/10 text-emerald-600' },
        enterprise: { label: 'Enterprise', className: 'bg-primary/10 text-primary' },
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
                setCompanies(result.data || [])
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
        const totalContacts = companies.reduce((sum, c) => sum + (c.contactCount || 0), 0)
        const totalOpportunities = companies.reduce((sum, c) => sum + (c.opportunityCount || 0), 0)
        const totalPipeline = companies.reduce((sum, c) => sum + (c.totalPipelineValue || 0), 0)

        return {
            total: companies.length,
            totalContacts,
            totalOpportunities,
            totalPipeline,
        }
    }, [companies])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
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
            header: 'Company',
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
            header: 'Website',
            render: (value) => value ? (
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
            header: 'Size',
            sortable: true,
            render: (value) => <SizeBadge size={value} />,
        },
        {
            key: 'contactCount',
            header: 'Contacts',
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
            header: 'Opportunities',
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
            header: 'Pipeline Value',
            sortable: true,
            render: (value) => (
                <span className="font-medium text-primary">
                    {value ? formatCurrency(value) : '-'}
                </span>
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
        // Only show delete action if user has permission
        ...(canDeleteCompanies ? [{
            id: 'delete',
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: (ids: string[]) => { if (confirm(`Delete ${ids.length} companies?`)) console.log('Delete:', ids) },
        }] : []),
    ]

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Companies</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your business accounts and organizations
                    </p>
                </div>
                <PermissionGate permission="companies.create">
                    <Button onClick={() => router.push('/dashboard/companies/create')} className="gap-2" data-cy="companies-add">
                        <Plus className="w-4 h-4" />
                        Add Company
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
                            <p className="text-xs text-muted-foreground">Companies</p>
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
                            <p className="text-xs text-muted-foreground">Contacts</p>
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
                            <p className="text-xs text-muted-foreground">Opportunities</p>
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
                            <p className="text-xs text-muted-foreground">Pipeline Value</p>
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
                searchPlaceholder="Search companies..."
                searchFields={['name', 'industry', 'website']}
                pageSize={15}
                emptyMessage="No companies yet"
                emptyDescription="Start adding companies to manage your accounts."
                entitySlug="companies"
            />
        </div>
    )
}

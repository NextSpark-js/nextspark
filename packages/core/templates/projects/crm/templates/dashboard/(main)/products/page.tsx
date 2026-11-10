/**
 * Products Page
 * Professional products catalog management with data table
 */

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/templates/shared/CRMDataTable'
import {
    Plus,
    Package,
    Trash2,
    Download,
    DollarSign,
    Tag,
    Archive,
    TrendingUp,
    Percent
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { formatLocaleNumber } from '@nextsparkjs/core/lib/i18n/format'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { sumNumeric, toNumber } from '@/lib/crm-utils'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

interface Product {
    id: string
    name: string
    description?: string
    sku?: string
    category?: string
    price: number
    cost?: number
    status: 'active' | 'inactive' | 'discontinued'
    stock?: number
    salesCount?: number
    createdAt: string
}

// Status badge component
function StatusBadge({ status }: { status: Product['status'] }) {
    const t = useTranslations('crm.list')
    const config = {
        active: { label: t('products.status.active'), className: 'bg-emerald-500/10 text-emerald-600' },
        inactive: { label: t('products.status.inactive'), className: 'bg-amber-500/10 text-amber-600' },
        discontinued: { label: t('products.status.discontinued'), className: 'bg-muted text-muted-foreground' },
    }

    const { label, className } = config[status] || config.active

    return (
        <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', className)}>
            {label}
        </span>
    )
}

// Margin indicator
function MarginIndicator({ price: rawPrice, cost: rawCost, locale }: { price: number | string; cost?: number | string; locale: string }) {
    const price = toNumber(rawPrice)
    const cost = toNumber(rawCost)
    if (!price || !cost) return <span className="text-muted-foreground">-</span>

    const margin = ((price - cost) / price) * 100

    let colorClass = 'text-muted-foreground'
    if (margin >= 50) colorClass = 'text-emerald-600'
    else if (margin >= 30) colorClass = 'text-amber-600'
    else if (margin >= 0) colorClass = 'text-orange-600'
    else colorClass = 'text-destructive'

    return (
        <div className={cn('flex items-center gap-1.5 text-sm font-medium', colorClass)}>
            <Percent className="w-3.5 h-3.5" />
            <span>{formatLocaleNumber(margin / 100, locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
        </div>
    )
}

export default function ProductsPage() {
    const t = useTranslations('crm.list')
    const locale = useLocale()
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Permission checks for bulk actions
    const canDeleteProducts = usePermission('products.delete')
    const canUpdateProducts = usePermission('products.update')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchProducts() {
            try {
                const response = await fetchWithTeam('/api/v1/products')
                if (!response.ok) throw new Error('Failed to fetch products')
                const result = await response.json()
                setProducts(result.data || [])
            } catch (error) {
                console.error('Error loading products:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProducts()
    }, [teamLoading, currentTeam])

    // Stats
    const stats = useMemo(() => {
        const active = products.filter(p => p.status === 'active').length
        // price and salesCount are NUMERIC columns: strings when they reach the page
        const totalRevenue = sumNumeric(products.map(p => (toNumber(p.price) ?? 0) * (toNumber(p.salesCount) ?? 0)))
        const prices = products.map(p => toNumber(p.price)).filter((price): price is number => price !== null)
        const avgPrice = prices.length > 0 ? sumNumeric(prices) / prices.length : 0

        return {
            total: products.length,
            active,
            totalRevenue,
            avgPrice,
        }
    }, [products])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    // Column definitions
    const columns: Column<Product>[] = [
        {
            key: 'name',
            header: t('products.columns.product'),
            sortable: true,
            render: (_, product) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        {product.sku && (
                            <p className="text-xs text-muted-foreground">{t('products.sku', { sku: product.sku })}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'category',
            header: t('products.columns.category'),
            sortable: true,
            render: (value) => value ? (
                <div className="flex items-center gap-1.5 text-sm">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{value}</span>
                </div>
            ) : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'price',
            header: t('products.columns.price'),
            sortable: true,
            render: (value) => (
                <span className="font-medium text-primary">
                    {formatCurrency(toNumber(value) ?? 0)}
                </span>
            ),
        },
        {
            key: 'margin',
            header: t('products.columns.margin'),
            render: (_, product) => (
                <MarginIndicator price={product.price} cost={product.cost} locale={locale} />
            ),
        },
        {
            key: 'salesCount',
            header: t('products.columns.sales'),
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{value || 0}</span>
                </div>
            ),
        },
        {
            key: 'status',
            header: t('products.columns.status'),
            sortable: true,
            render: (value) => <StatusBadge status={value} />,
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
        // Only show archive action if user has update permission
        ...(canUpdateProducts ? [{
            id: 'archive',
            label: t('products.archive'),
            icon: <Archive className="w-4 h-4" />,
            onClick: (ids: string[]) => { if (confirm(t('products.archiveConfirm', { count: ids.length }))) console.log('Archive:', ids) },
        }] : []),
        // Only show delete action if user has permission
        ...(canDeleteProducts ? [{
            id: 'delete',
            label: t('common.delete'),
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: (ids: string[]) => { if (confirm(t('products.deleteConfirm', { count: ids.length }))) console.log('Delete:', ids) },
        }] : []),
    ]

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('products.title')}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('products.subtitle')}
                    </p>
                </div>
                <PermissionGate permission="products.create">
                    <Button onClick={() => router.push('/dashboard/products/create')} className="gap-2" data-cy="products-add">
                        <Plus className="w-4 h-4" />
                        {t('products.add')}
                    </Button>
                </PermissionGate>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">{t('products.stats.total')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                            <p className="text-xs text-muted-foreground">{t('products.stats.active')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
                            <p className="text-xs text-muted-foreground">{t('products.stats.totalRevenue')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Tag className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.avgPrice)}</p>
                            <p className="text-xs text-muted-foreground">{t('products.stats.avgPrice')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CRMDataTable
                data={products}
                columns={columns}
                bulkActions={bulkActions}
                onRowClick={(p) => router.push(`/dashboard/products/${p.id}`)}
                isLoading={isLoading}
                searchPlaceholder={t('products.search')}
                searchFields={['name', 'sku', 'category']}
                pageSize={15}
                emptyMessage={t('products.empty')}
                emptyDescription={t('products.emptyDescription')}
                entitySlug="products"
            />
        </div>
    )
}
